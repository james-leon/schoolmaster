
-- 1) Add must_change_password to protected columns in the self-update policy
DROP POLICY IF EXISTS "update own profile non-privileged" ON public.profiles;

CREATE POLICY "update own profile non-privileged"
ON public.profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND NOT (school_id IS DISTINCT FROM (SELECT p.school_id FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (role IS DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (student_id IS DISTINCT FROM (SELECT p.student_id FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (student_ids IS DISTINCT FROM (SELECT p.student_ids FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (assigned_classes IS DISTINCT FROM (SELECT p.assigned_classes FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (assigned_subjects IS DISTINCT FROM (SELECT p.assigned_subjects FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (is_active IS DISTINCT FROM (SELECT p.is_active FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (must_change_password IS DISTINCT FROM (SELECT p.must_change_password FROM public.profiles p WHERE p.id = auth.uid()))
);

-- 2) Secure RPC: clears must_change_password only if the auth password was
--    actually changed recently (auth.users.updated_at bumps when the user
--    calls supabase.auth.updateUser({ password })).
CREATE OR REPLACE FUNCTION public.clear_must_change_password()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT updated_at INTO v_updated FROM auth.users WHERE id = auth.uid();
  IF v_updated IS NULL OR v_updated < now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'Password change not detected';
  END IF;

  UPDATE public.profiles
     SET must_change_password = false
   WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.clear_must_change_password() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_must_change_password() TO authenticated;
