CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own push subscriptions"
ON public.push_subscriptions FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions(user_id);

CREATE OR REPLACE FUNCTION public.touch_push_subscriptions_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$fn$;

CREATE TRIGGER update_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.touch_push_subscriptions_updated_at();

-- Internal config store (no grants: only security-definer functions read it)
CREATE TABLE IF NOT EXISTS public.internal_config (
  key text PRIMARY KEY,
  value text NOT NULL
);
ALTER TABLE public.internal_config ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.internal_config TO service_role;

CREATE OR REPLACE FUNCTION public.dispatch_push_for_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  SELECT value INTO v_url FROM public.internal_config WHERE key = 'push_dispatch_url';
  SELECT value INTO v_secret FROM public.internal_config WHERE key = 'push_dispatch_secret';
  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body := jsonb_build_object('notification_id', NEW.id),
    timeout_milliseconds := 5000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE TRIGGER notifications_dispatch_push
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_for_notification();