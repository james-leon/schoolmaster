DROP POLICY IF EXISTS "update own profile non-privileged" ON public.profiles;

CREATE POLICY "update own profile non-privileged"
ON public.profiles FOR UPDATE
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND NOT (school_id       IS DISTINCT FROM (SELECT p.school_id       FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (role             IS DISTINCT FROM (SELECT p.role             FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (student_id       IS DISTINCT FROM (SELECT p.student_id       FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (student_ids      IS DISTINCT FROM (SELECT p.student_ids      FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (assigned_classes IS DISTINCT FROM (SELECT p.assigned_classes FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (assigned_subjects IS DISTINCT FROM (SELECT p.assigned_subjects FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (is_active        IS DISTINCT FROM (SELECT p.is_active        FROM public.profiles p WHERE p.id = auth.uid()))
);