CREATE TABLE public.timetable (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL,
  class_id uuid NOT NULL,
  subject_id uuid,
  subject_name text NOT NULL,
  teacher_id uuid,
  teacher_name text,
  day_of_week text NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  room text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_timetable_school ON public.timetable(school_id);
CREATE INDEX idx_timetable_class ON public.timetable(class_id);
CREATE INDEX idx_timetable_teacher ON public.timetable(teacher_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.timetable TO authenticated;
GRANT ALL ON public.timetable TO service_role;

ALTER TABLE public.timetable ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admin all timetable"
ON public.timetable
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "scoped read timetable"
ON public.timetable
FOR SELECT
TO authenticated
USING (
  school_id = get_user_school_id(auth.uid())
  AND (
    has_role(auth.uid(), 'school_admin'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.class_id = timetable.class_id
        AND (s.id = get_user_student_id(auth.uid()) OR is_parent_of_student(s.id))
    )
  )
);

CREATE POLICY "admin insert timetable"
ON public.timetable
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'school_admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "admin update timetable"
ON public.timetable
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'school_admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "admin delete timetable"
ON public.timetable
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'school_admin'::app_role) AND school_id = get_user_school_id(auth.uid()));