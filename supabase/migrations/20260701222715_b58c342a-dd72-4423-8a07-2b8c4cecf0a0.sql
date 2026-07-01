
-- Rate limit event log
CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL,
  action TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_events_lookup
  ON public.rate_limit_events (action, key, occurred_at DESC);

GRANT SELECT ON public.rate_limit_events TO authenticated;
GRANT ALL ON public.rate_limit_events TO service_role;

ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

-- Only school_admin and super_admin can inspect
DROP POLICY IF EXISTS "admins read rate limit events" ON public.rate_limit_events;
CREATE POLICY "admins read rate limit events"
  ON public.rate_limit_events FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'school_admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- No client writes; only definer functions / service role
DROP POLICY IF EXISTS "no client writes" ON public.rate_limit_events;
CREATE POLICY "no client writes"
  ON public.rate_limit_events FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Core rate-limit function.
-- Returns (allowed boolean, retry_after integer seconds).
CREATE OR REPLACE FUNCTION public.check_and_record_rate_limit(
  _key TEXT,
  _action TEXT,
  _max INTEGER,
  _window_seconds INTEGER
) RETURNS TABLE(allowed BOOLEAN, retry_after INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key   TEXT := coalesce(nullif(trim(_key), ''), 'anon');
  v_count INTEGER;
  v_oldest TIMESTAMPTZ;
  v_window INTERVAL := make_interval(secs => greatest(_window_seconds, 1));
BEGIN
  -- Housekeeping: prune old rows for this (action, key)
  DELETE FROM public.rate_limit_events
   WHERE action = _action AND key = v_key
     AND occurred_at < now() - v_window - interval '1 hour';

  SELECT count(*), min(occurred_at)
    INTO v_count, v_oldest
    FROM public.rate_limit_events
   WHERE action = _action AND key = v_key
     AND occurred_at >= now() - v_window;

  IF v_count >= _max THEN
    RETURN QUERY SELECT false,
      GREATEST(1,
        EXTRACT(EPOCH FROM (v_oldest + v_window - now()))::INTEGER
      );
    RETURN;
  END IF;

  INSERT INTO public.rate_limit_events (key, action) VALUES (v_key, _action);
  RETURN QUERY SELECT true, 0;
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_record_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_record_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO authenticated, service_role;

-- Generic trigger enforcing a per-user, per-table INSERT limit.
-- Applied on payment_records and transactions to guard runaway bulk writes
-- from a compromised session or a client bug looping the same action.
CREATE OR REPLACE FUNCTION public.enforce_write_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT := coalesce(auth.uid()::text, 'anon');
  v_action TEXT := 'write:' || TG_TABLE_NAME;
  v_allowed BOOLEAN;
  v_retry INTEGER;
BEGIN
  -- Service role bypass (server-side admin tasks, seeders, migrations)
  IF current_setting('request.jwt.claims', true) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT allowed, retry_after
    INTO v_allowed, v_retry
    FROM public.check_and_record_rate_limit(v_uid, v_action, 60, 300);

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Trop de requêtes. Réessayez dans % secondes.', v_retry
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rl_payment_records ON public.payment_records;
CREATE TRIGGER rl_payment_records
  BEFORE INSERT ON public.payment_records
  FOR EACH ROW EXECUTE FUNCTION public.enforce_write_rate_limit();

DROP TRIGGER IF EXISTS rl_transactions ON public.transactions;
CREATE TRIGGER rl_transactions
  BEFORE INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_write_rate_limit();
