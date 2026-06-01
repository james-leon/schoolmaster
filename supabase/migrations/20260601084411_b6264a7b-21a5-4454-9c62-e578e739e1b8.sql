
-- 1. parent_students link table
CREATE TABLE IF NOT EXISTS public.parent_students (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_profile_id uuid NOT NULL,
  student_id uuid NOT NULL,
  school_id uuid NOT NULL,
  relationship text DEFAULT 'Tuteur',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_profile_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_students_parent ON public.parent_students(parent_profile_id);
CREATE INDEX IF NOT EXISTS idx_parent_students_student ON public.parent_students(student_id);
CREATE INDEX IF NOT EXISTS idx_parent_students_school ON public.parent_students(school_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_students TO authenticated;
GRANT ALL ON public.parent_students TO service_role;

ALTER TABLE public.parent_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admin all parent_students" ON public.parent_students
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "admin all parent_students" ON public.parent_students
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'school_admin'::app_role) AND school_id = get_user_school_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'school_admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "parent read own parent_students" ON public.parent_students
  FOR SELECT TO authenticated
  USING (parent_profile_id = auth.uid());

-- 2. Helper: is the authed user a parent of this student?
CREATE OR REPLACE FUNCTION public.is_parent_of_student(_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_students
    WHERE parent_profile_id = auth.uid() AND student_id = _student_id
  )
$$;

-- 3. Extend SELECT policies so parents can read data for ALL linked children
-- students
DROP POLICY IF EXISTS "school staff read students" ON public.students;
CREATE POLICY "school staff read students" ON public.students
  FOR SELECT TO authenticated
  USING (
    school_id = get_user_school_id(auth.uid())
    AND (
      has_role(auth.uid(), 'school_admin'::app_role)
      OR has_role(auth.uid(), 'teacher'::app_role)
      OR id = get_user_student_id(auth.uid())
      OR public.is_parent_of_student(id)
    )
  );

-- grades
DROP POLICY IF EXISTS "scoped read grades" ON public.grades;
CREATE POLICY "scoped read grades" ON public.grades
  FOR SELECT TO authenticated
  USING (
    school_id = get_user_school_id(auth.uid())
    AND (
      has_role(auth.uid(), 'school_admin'::app_role)
      OR has_role(auth.uid(), 'teacher'::app_role)
      OR student_id = get_user_student_id(auth.uid())
      OR public.is_parent_of_student(student_id)
    )
  );

-- attendance
DROP POLICY IF EXISTS "scoped read attendance" ON public.attendance;
CREATE POLICY "scoped read attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    school_id = get_user_school_id(auth.uid())
    AND (
      has_role(auth.uid(), 'school_admin'::app_role)
      OR has_role(auth.uid(), 'teacher'::app_role)
      OR student_id = get_user_student_id(auth.uid())
      OR public.is_parent_of_student(student_id)
    )
  );

-- invoices
DROP POLICY IF EXISTS "scoped read invoices" ON public.invoices;
CREATE POLICY "scoped read invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    school_id = get_user_school_id(auth.uid())
    AND (
      has_role(auth.uid(), 'school_admin'::app_role)
      OR student_id = get_user_student_id(auth.uid())
      OR public.is_parent_of_student(student_id)
    )
  );

-- payment_records
DROP POLICY IF EXISTS "scoped read payment_records" ON public.payment_records;
CREATE POLICY "scoped read payment_records" ON public.payment_records
  FOR SELECT TO authenticated
  USING (
    school_id = get_user_school_id(auth.uid())
    AND (
      has_role(auth.uid(), 'school_admin'::app_role)
      OR student_id = get_user_student_id(auth.uid())
      OR public.is_parent_of_student(student_id)
    )
  );

-- parents (contact info table)
DROP POLICY IF EXISTS "scoped read parents" ON public.parents;
CREATE POLICY "scoped read parents" ON public.parents
  FOR SELECT TO authenticated
  USING (
    school_id = get_user_school_id(auth.uid())
    AND (
      has_role(auth.uid(), 'school_admin'::app_role)
      OR has_role(auth.uid(), 'teacher'::app_role)
      OR student_id = get_user_student_id(auth.uid())
      OR public.is_parent_of_student(student_id)
    )
  );

-- 4. Backfill: from profiles.student_id and profiles.student_ids[]
INSERT INTO public.parent_students (parent_profile_id, student_id, school_id, relationship)
SELECT p.id, s.id, s.school_id, 'Tuteur'
FROM public.profiles p
JOIN public.students s ON s.id = p.student_id
WHERE p.role = 'parent' AND p.student_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.parent_students (parent_profile_id, student_id, school_id, relationship)
SELECT p.id, s.id, s.school_id, 'Tuteur'
FROM public.profiles p
CROSS JOIN LATERAL unnest(p.student_ids) AS sid
JOIN public.students s ON s.id = sid
WHERE p.role = 'parent'
ON CONFLICT DO NOTHING;
