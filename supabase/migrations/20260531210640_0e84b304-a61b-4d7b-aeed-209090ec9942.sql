
-- Subscription columns on schools (status, subscription_plan, trial_ends_at already exist)
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS subscription_start date,
  ADD COLUMN IF NOT EXISTS subscription_end date;

-- Allow 'expired' as a status value
-- (status is a free-text column with default 'active'; no enum to alter)

-- Placeholder table for future automatic payment integration
CREATE TABLE IF NOT EXISTS public.payment_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  plan text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  payment_date timestamptz NOT NULL DEFAULT now(),
  payment_method text,
  status text NOT NULL DEFAULT 'pending',
  period_start date,
  period_end date,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_subscriptions TO authenticated;
GRANT ALL ON public.payment_subscriptions TO service_role;

ALTER TABLE public.payment_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school read own payment_subscriptions"
  ON public.payment_subscriptions FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()));

CREATE POLICY "super admin all payment_subscriptions"
  ON public.payment_subscriptions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
