
-- ============ FIX: profile school_id pivot attack ============
DROP POLICY IF EXISTS "insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "update own profile" ON public.profiles;
DROP POLICY IF EXISTS "read own profile" ON public.profiles;

CREATE POLICY "insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND school_id IS NULL AND role IS NULL);

CREATE POLICY "update own profile non-privileged" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND school_id IS NOT DISTINCT FROM (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND role IS NOT DISTINCT FROM (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND student_id IS NOT DISTINCT FROM (SELECT student_id FROM public.profiles WHERE id = auth.uid())
    AND student_ids IS NOT DISTINCT FROM (SELECT student_ids FROM public.profiles WHERE id = auth.uid())
    AND assigned_classes IS NOT DISTINCT FROM (SELECT assigned_classes FROM public.profiles WHERE id = auth.uid())
    AND assigned_subjects IS NOT DISTINCT FROM (SELECT assigned_subjects FROM public.profiles WHERE id = auth.uid())
    AND is_active IS NOT DISTINCT FROM (SELECT is_active FROM public.profiles WHERE id = auth.uid())
  );

-- Read own profile, or if you're admin/teacher you can read profiles in your school
CREATE POLICY "read profiles scoped" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (
      school_id = public.get_user_school_id(auth.uid())
      AND (
        public.has_role(auth.uid(), 'school_admin')
        OR public.has_role(auth.uid(), 'teacher')
      )
    )
  );

-- ============ FIX: tighten reads on student-sensitive tables ============
DROP POLICY IF EXISTS "school read attendance" ON public.attendance;
CREATE POLICY "scoped read attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'school_admin')
      OR public.has_role(auth.uid(), 'teacher')
      OR student_id = public.get_user_student_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "school read grades" ON public.grades;
CREATE POLICY "scoped read grades" ON public.grades
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'school_admin')
      OR public.has_role(auth.uid(), 'teacher')
      OR student_id = public.get_user_student_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "school read invoices" ON public.invoices;
CREATE POLICY "scoped read invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'school_admin')
      OR student_id = public.get_user_student_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "school read payment_records" ON public.payment_records;
CREATE POLICY "scoped read payment_records" ON public.payment_records
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'school_admin')
      OR student_id = public.get_user_student_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "school read parents" ON public.parents;
CREATE POLICY "scoped read parents" ON public.parents
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'school_admin')
      OR public.has_role(auth.uid(), 'teacher')
      OR student_id = public.get_user_student_id(auth.uid())
    )
  );

-- ============ FIX: storage school-logos policies ============
-- Make bucket non-public-listable; keep public read via getPublicUrl (which works without SELECT policy for public buckets, but listing requires SELECT policy)
UPDATE storage.buckets SET public = true WHERE id = 'school-logos';

DROP POLICY IF EXISTS "Public read school logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload school logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update school logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete school logos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view school logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view school logos" ON storage.objects;

-- Public read of individual files (via direct/public URL) — no listing
CREATE POLICY "school logos public read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'school-logos');

CREATE POLICY "school admins insert own school logo" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'school-logos'
    AND public.has_role(auth.uid(), 'school_admin')
    AND (storage.foldername(name))[1] = public.get_user_school_id(auth.uid())::text
  );

CREATE POLICY "school admins update own school logo" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'school-logos'
    AND public.has_role(auth.uid(), 'school_admin')
    AND (storage.foldername(name))[1] = public.get_user_school_id(auth.uid())::text
  );

CREATE POLICY "school admins delete own school logo" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'school-logos'
    AND public.has_role(auth.uid(), 'school_admin')
    AND (storage.foldername(name))[1] = public.get_user_school_id(auth.uid())::text
  );

-- ============ FIX: SECURITY DEFINER function exposure ============
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_school_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_student_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
