
-- Helpers to evaluate teacher's class assignment
CREATE OR REPLACE FUNCTION public.teacher_handles_class(_class_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND _class_id::text = ANY(COALESCE(assigned_classes, ARRAY[]::text[]))
  )
$$;

CREATE OR REPLACE FUNCTION public.teacher_handles_student(_student_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE s.id = _student_id
      AND s.class_id::text = ANY(COALESCE(p.assigned_classes, ARRAY[]::text[]))
  )
$$;

-- STUDENTS: teachers only see their assigned-class students
DROP POLICY IF EXISTS "school staff read students" ON public.students;
CREATE POLICY "scoped read students" ON public.students
FOR SELECT TO authenticated
USING (
  school_id = get_user_school_id(auth.uid())
  AND (
    has_role(auth.uid(), 'school_admin'::app_role)
    OR (has_role(auth.uid(), 'teacher'::app_role) AND class_id IS NOT NULL AND teacher_handles_class(class_id))
    OR id = get_user_student_id(auth.uid())
    OR is_parent_of_student(id)
  )
);

-- GRADES: teachers only for their handled students
DROP POLICY IF EXISTS "scoped read grades" ON public.grades;
DROP POLICY IF EXISTS "staff insert grades" ON public.grades;
DROP POLICY IF EXISTS "staff update grades" ON public.grades;
DROP POLICY IF EXISTS "staff delete grades" ON public.grades;

CREATE POLICY "scoped read grades" ON public.grades
FOR SELECT TO authenticated
USING (
  school_id = get_user_school_id(auth.uid())
  AND (
    has_role(auth.uid(), 'school_admin'::app_role)
    OR (has_role(auth.uid(), 'teacher'::app_role) AND teacher_handles_student(student_id))
    OR student_id = get_user_student_id(auth.uid())
    OR is_parent_of_student(student_id)
  )
);
CREATE POLICY "staff insert grades" ON public.grades
FOR INSERT TO authenticated
WITH CHECK (
  school_id = get_user_school_id(auth.uid())
  AND (
    has_role(auth.uid(), 'school_admin'::app_role)
    OR (has_role(auth.uid(), 'teacher'::app_role) AND teacher_handles_student(student_id))
  )
);
CREATE POLICY "staff update grades" ON public.grades
FOR UPDATE TO authenticated
USING (
  school_id = get_user_school_id(auth.uid())
  AND (
    has_role(auth.uid(), 'school_admin'::app_role)
    OR (has_role(auth.uid(), 'teacher'::app_role) AND teacher_handles_student(student_id))
  )
);
CREATE POLICY "staff delete grades" ON public.grades
FOR DELETE TO authenticated
USING (
  school_id = get_user_school_id(auth.uid())
  AND (
    has_role(auth.uid(), 'school_admin'::app_role)
    OR (has_role(auth.uid(), 'teacher'::app_role) AND teacher_handles_student(student_id))
  )
);

-- ATTENDANCE
DROP POLICY IF EXISTS "scoped read attendance" ON public.attendance;
DROP POLICY IF EXISTS "staff insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "staff update attendance" ON public.attendance;
DROP POLICY IF EXISTS "staff delete attendance" ON public.attendance;

CREATE POLICY "scoped read attendance" ON public.attendance
FOR SELECT TO authenticated
USING (
  school_id = get_user_school_id(auth.uid())
  AND (
    has_role(auth.uid(), 'school_admin'::app_role)
    OR (has_role(auth.uid(), 'teacher'::app_role) AND teacher_handles_student(student_id))
    OR student_id = get_user_student_id(auth.uid())
    OR is_parent_of_student(student_id)
  )
);
CREATE POLICY "staff insert attendance" ON public.attendance
FOR INSERT TO authenticated
WITH CHECK (
  school_id = get_user_school_id(auth.uid())
  AND (
    has_role(auth.uid(), 'school_admin'::app_role)
    OR (has_role(auth.uid(), 'teacher'::app_role) AND teacher_handles_student(student_id))
  )
);
CREATE POLICY "staff update attendance" ON public.attendance
FOR UPDATE TO authenticated
USING (
  school_id = get_user_school_id(auth.uid())
  AND (
    has_role(auth.uid(), 'school_admin'::app_role)
    OR (has_role(auth.uid(), 'teacher'::app_role) AND teacher_handles_student(student_id))
  )
);
CREATE POLICY "staff delete attendance" ON public.attendance
FOR DELETE TO authenticated
USING (
  school_id = get_user_school_id(auth.uid())
  AND (
    has_role(auth.uid(), 'school_admin'::app_role)
    OR (has_role(auth.uid(), 'teacher'::app_role) AND teacher_handles_student(student_id))
  )
);

-- PARENTS (contact info): teachers only see parents of students they handle
DROP POLICY IF EXISTS "scoped read parents" ON public.parents;
CREATE POLICY "scoped read parents" ON public.parents
FOR SELECT TO authenticated
USING (
  school_id = get_user_school_id(auth.uid())
  AND (
    has_role(auth.uid(), 'school_admin'::app_role)
    OR (has_role(auth.uid(), 'teacher'::app_role) AND teacher_handles_student(student_id))
    OR student_id = get_user_student_id(auth.uid())
    OR is_parent_of_student(student_id)
  )
);

-- PROFILES: restrict teacher reads to own + same-school staff (no parent PII)
DROP POLICY IF EXISTS "read profiles scoped" ON public.profiles;
CREATE POLICY "read profiles scoped" ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR (
    school_id = get_user_school_id(auth.uid())
    AND (
      has_role(auth.uid(), 'school_admin'::app_role)
      OR (
        has_role(auth.uid(), 'teacher'::app_role)
        AND role IN ('teacher'::app_role, 'school_admin'::app_role)
      )
    )
  )
);
