
CREATE TABLE public.login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX login_attempts_email_time_idx ON public.login_attempts (lower(email), attempted_at DESC);

GRANT ALL ON public.login_attempts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.login_attempts_id_seq TO service_role;

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- No policies: table is only accessible via SECURITY DEFINER functions below.

CREATE OR REPLACE FUNCTION public.check_login_lockout(_email TEXT)
RETURNS TABLE(locked BOOLEAN, seconds_remaining INTEGER)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(_email));
  v_fail_count INTEGER;
  v_last_fail TIMESTAMPTZ;
  v_last_success TIMESTAMPTZ;
  v_window_start TIMESTAMPTZ;
BEGIN
  IF v_email IS NULL OR v_email = '' THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  SELECT max(attempted_at) INTO v_last_success
  FROM public.login_attempts
  WHERE lower(email) = v_email AND success = true;

  v_window_start := greatest(now() - interval '15 minutes', coalesce(v_last_success, 'epoch'::timestamptz));

  SELECT count(*), max(attempted_at)
    INTO v_fail_count, v_last_fail
  FROM public.login_attempts
  WHERE lower(email) = v_email
    AND success = false
    AND attempted_at >= v_window_start;

  IF v_fail_count >= 5 THEN
    RETURN QUERY SELECT true,
      GREATEST(1, EXTRACT(EPOCH FROM (v_last_fail + interval '15 minutes' - now()))::INTEGER);
  ELSE
    RETURN QUERY SELECT false, 0;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_login_attempt(_email TEXT, _success BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(_email));
BEGIN
  IF v_email IS NULL OR v_email = '' THEN RETURN; END IF;

  INSERT INTO public.login_attempts (email, success)
  VALUES (v_email, coalesce(_success, false));

  -- Housekeeping: drop rows older than 24h for this email.
  DELETE FROM public.login_attempts
   WHERE lower(email) = v_email
     AND attempted_at < now() - interval '24 hours';
END;
$$;

REVOKE ALL ON FUNCTION public.check_login_lockout(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_login_attempt(TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_login_lockout(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_login_attempt(TEXT, BOOLEAN) TO service_role;
