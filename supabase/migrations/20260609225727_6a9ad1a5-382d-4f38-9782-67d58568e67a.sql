
-- Events table for school calendar
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('vacances','examen','reunion','evenement','sortie','ferie')),
  start_date date NOT NULL,
  end_date date,
  start_time time,
  end_time time,
  target text NOT NULL DEFAULT 'ecole' CHECK (target IN ('ecole','classe','parents','enseignants')),
  target_class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  location text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Super admin: all
CREATE POLICY "events_super_admin_all" ON public.events
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- School admin: full CRUD on own school
CREATE POLICY "events_school_admin_all" ON public.events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'school_admin'::app_role) AND school_id = public.get_user_school_id(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'school_admin'::app_role) AND school_id = public.get_user_school_id(auth.uid()));

-- Teachers: read events for their school that are school-wide, for teachers, or for a class they handle
CREATE POLICY "events_teacher_read" ON public.events
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'teacher'::app_role)
    AND school_id = public.get_user_school_id(auth.uid())
    AND (
      target IN ('ecole','enseignants')
      OR (target = 'classe' AND target_class_id IS NOT NULL AND public.teacher_handles_class(target_class_id))
    )
  );

-- Parents: read events for their school that are school-wide, for parents, or for a class their child is in
CREATE POLICY "events_parent_read" ON public.events
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'parent'::app_role)
    AND school_id = public.get_user_school_id(auth.uid())
    AND (
      target IN ('ecole','parents')
      OR (
        target = 'classe' AND target_class_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.parent_students ps
          JOIN public.students s ON s.id = ps.student_id
          WHERE ps.parent_profile_id = auth.uid() AND s.class_id = target_class_id
        )
      )
    )
  );

-- updated_at trigger
CREATE TRIGGER events_touch_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.touch_discipline_updated_at();

-- Notification trigger on insert
CREATE OR REPLACE FUNCTION public.notify_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient_id uuid;
  v_title text;
  v_msg text;
  v_date_fr text;
BEGIN
  v_date_fr := to_char(NEW.start_date, 'DD/MM/YYYY');
  v_title := 'Nouvel événement : ' || NEW.title;
  v_msg := COALESCE(NEW.description, '') ;
  IF length(v_msg) = 0 THEN
    v_msg := 'Le ' || v_date_fr;
  ELSE
    v_msg := v_msg || ' (le ' || v_date_fr || ')';
  END IF;

  IF NEW.target = 'ecole' THEN
    FOR v_recipient_id IN
      SELECT id FROM public.profiles
      WHERE school_id = NEW.school_id
        AND role IN ('teacher','parent','school_admin')
        AND id <> COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid)
    LOOP
      INSERT INTO public.notifications (school_id, recipient_id, type, title, message, link)
      VALUES (NEW.school_id, v_recipient_id, 'custom', v_title, v_msg, '/calendrier');
    END LOOP;
  ELSIF NEW.target = 'parents' THEN
    FOR v_recipient_id IN
      SELECT id FROM public.profiles WHERE school_id = NEW.school_id AND role = 'parent'
    LOOP
      INSERT INTO public.notifications (school_id, recipient_id, type, title, message, link)
      VALUES (NEW.school_id, v_recipient_id, 'custom', v_title, v_msg, '/parent');
    END LOOP;
  ELSIF NEW.target = 'enseignants' THEN
    FOR v_recipient_id IN
      SELECT id FROM public.profiles WHERE school_id = NEW.school_id AND role = 'teacher'
    LOOP
      INSERT INTO public.notifications (school_id, recipient_id, type, title, message, link)
      VALUES (NEW.school_id, v_recipient_id, 'custom', v_title, v_msg, '/calendrier');
    END LOOP;
  ELSIF NEW.target = 'classe' AND NEW.target_class_id IS NOT NULL THEN
    FOR v_recipient_id IN
      SELECT DISTINCT ps.parent_profile_id
      FROM public.parent_students ps
      JOIN public.students s ON s.id = ps.student_id
      WHERE s.class_id = NEW.target_class_id
    LOOP
      INSERT INTO public.notifications (school_id, recipient_id, type, title, message, link)
      VALUES (NEW.school_id, v_recipient_id, 'custom', v_title, v_msg, '/parent');
    END LOOP;
    FOR v_recipient_id IN
      SELECT id FROM public.profiles
      WHERE school_id = NEW.school_id AND role = 'teacher'
        AND NEW.target_class_id::text = ANY(COALESCE(assigned_classes, ARRAY[]::text[]))
    LOOP
      INSERT INTO public.notifications (school_id, recipient_id, type, title, message, link)
      VALUES (NEW.school_id, v_recipient_id, 'custom', v_title, v_msg, '/calendrier');
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER events_notify_insert
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.notify_event();
