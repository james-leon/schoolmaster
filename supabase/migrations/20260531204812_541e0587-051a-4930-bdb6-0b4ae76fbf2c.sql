-- 1) School lifecycle columns
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS trial_ends_at date;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schools_status_check') THEN
    ALTER TABLE public.schools
      ADD CONSTRAINT schools_status_check
      CHECK (status IN ('active','trial','suspended'));
  END IF;
END $$;

-- 2) is_super_admin helper
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'::app_role
  )
$$;

-- 3) Super admin RLS overrides
DROP POLICY IF EXISTS "super admin all schools" ON public.schools;
CREATE POLICY "super admin all schools" ON public.schools
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "super admin read all profiles" ON public.profiles;
CREATE POLICY "super admin read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "super admin update all profiles" ON public.profiles;
CREATE POLICY "super admin update all profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "super admin delete all profiles" ON public.profiles;
CREATE POLICY "super admin delete all profiles" ON public.profiles
  FOR DELETE TO authenticated USING (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "super admin read user_roles" ON public.user_roles;
CREATE POLICY "super admin read user_roles" ON public.user_roles
  FOR SELECT TO authenticated USING (is_super_admin(auth.uid()));

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'classes','students','teachers','class_subjects','grades','attendance',
    'fee_types','invoices','payment_records','parents','announcements','academic_years'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'super admin all ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()))',
      'super admin all ' || t, t
    );
  END LOOP;
END $$;
