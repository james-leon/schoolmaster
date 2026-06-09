
-- 1) Medical fields on students
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS blood_group text,
  ADD COLUMN IF NOT EXISTS allergies text,
  ADD COLUMN IF NOT EXISTS chronic_conditions text,
  ADD COLUMN IF NOT EXISTS medications text,
  ADD COLUMN IF NOT EXISTS vaccinations text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS emergency_contact_relation text,
  ADD COLUMN IF NOT EXISTS medical_notes text;

-- 2) Discipline records table
CREATE TABLE IF NOT EXISTS public.discipline_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  type text NOT NULL CHECK (type IN ('incident','sanction','observation_positive','avertissement')),
  title text NOT NULL,
  description text,
  severity text CHECK (severity IS NULL OR severity IN ('faible','moyen','grave')),
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discipline_records_student_idx ON public.discipline_records(student_id, date DESC);
CREATE INDEX IF NOT EXISTS discipline_records_school_idx ON public.discipline_records(school_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.discipline_records TO authenticated;
GRANT ALL ON public.discipline_records TO service_role;

ALTER TABLE public.discipline_records ENABLE ROW LEVEL SECURITY;

-- Read: super admin OR (in same school AND (admin OR teacher-of-class OR parent-of-student))
CREATE POLICY "discipline read scoped" ON public.discipline_records
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    school_id = public.get_user_school_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'school_admin'::app_role)
      OR public.teacher_handles_student(student_id)
      OR public.is_parent_of_student(student_id)
    )
  )
);

-- Insert: admin in same school, OR teacher for their student; recorded_by must be self
CREATE POLICY "discipline insert" ON public.discipline_records
FOR INSERT TO authenticated
WITH CHECK (
  school_id = public.get_user_school_id(auth.uid())
  AND recorded_by = auth.uid()
  AND (
    public.has_role(auth.uid(), 'school_admin'::app_role)
    OR (public.has_role(auth.uid(), 'teacher'::app_role) AND public.teacher_handles_student(student_id))
  )
);

-- Update: admin OR teacher on their own record
CREATE POLICY "discipline update" ON public.discipline_records
FOR UPDATE TO authenticated
USING (
  school_id = public.get_user_school_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'school_admin'::app_role)
    OR (public.has_role(auth.uid(), 'teacher'::app_role) AND recorded_by = auth.uid())
  )
);

-- Delete: admin OR teacher on their own record
CREATE POLICY "discipline delete" ON public.discipline_records
FOR DELETE TO authenticated
USING (
  school_id = public.get_user_school_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'school_admin'::app_role)
    OR (public.has_role(auth.uid(), 'teacher'::app_role) AND recorded_by = auth.uid())
  )
);

-- Super admin all
CREATE POLICY "super admin discipline all" ON public.discipline_records
FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_discipline_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_discipline_updated_at ON public.discipline_records;
CREATE TRIGGER trg_discipline_updated_at
BEFORE UPDATE ON public.discipline_records
FOR EACH ROW EXECUTE FUNCTION public.touch_discipline_updated_at();

-- Notification trigger to parents
CREATE OR REPLACE FUNCTION public.notify_discipline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first text;
  v_parent_id uuid;
  v_type_fr text;
  v_date_fr text;
BEGIN
  SELECT first_name INTO v_first FROM public.students WHERE id = NEW.student_id;
  IF v_first IS NULL THEN RETURN NEW; END IF;

  v_type_fr := CASE NEW.type
    WHEN 'incident' THEN 'Incident'
    WHEN 'sanction' THEN 'Sanction'
    WHEN 'avertissement' THEN 'Avertissement'
    WHEN 'observation_positive' THEN 'Observation positive'
    ELSE NEW.type
  END;
  v_date_fr := to_char(NEW.date, 'DD/MM/YYYY');

  FOR v_parent_id IN
    SELECT parent_profile_id FROM public.parent_students WHERE student_id = NEW.student_id
  LOOP
    INSERT INTO public.notifications (school_id, recipient_id, type, title, message, link)
    VALUES (
      NEW.school_id, v_parent_id, 'custom',
      v_type_fr || ' : ' || v_first,
      NEW.title || ' (le ' || v_date_fr || ')',
      '/parent'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_discipline ON public.discipline_records;
CREATE TRIGGER trg_notify_discipline
AFTER INSERT ON public.discipline_records
FOR EACH ROW EXECUTE FUNCTION public.notify_discipline();
