
-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient_created ON public.notifications(recipient_id, created_at DESC);
CREATE INDEX idx_notifications_school ON public.notifications(school_id);
CREATE INDEX idx_notifications_unread ON public.notifications(recipient_id) WHERE read = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Recipient can read & update (mark as read) & delete own notifications
CREATE POLICY "recipient read own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY "recipient update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

CREATE POLICY "recipient delete own notifications" ON public.notifications
  FOR DELETE TO authenticated
  USING (recipient_id = auth.uid());

-- School admin can insert notifications for users in their school
CREATE POLICY "admin insert school notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'school_admin'::app_role)
    AND school_id = public.get_user_school_id(auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = recipient_id AND p.school_id = school_id)
  );

CREATE POLICY "admin read school notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'school_admin'::app_role)
    AND school_id = public.get_user_school_id(auth.uid())
  );

CREATE POLICY "super admin all notifications" ON public.notifications
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Absence trigger: notify all linked parents when a student is marked absent
CREATE OR REPLACE FUNCTION public.notify_absence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first text;
  v_parent_id uuid;
  v_date_fr text;
BEGIN
  IF NEW.status <> 'absent' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'absent' THEN RETURN NEW; END IF;

  SELECT first_name INTO v_first FROM public.students WHERE id = NEW.student_id;
  IF v_first IS NULL THEN RETURN NEW; END IF;

  v_date_fr := to_char(NEW.date, 'DD/MM/YYYY');

  FOR v_parent_id IN
    SELECT parent_profile_id FROM public.parent_students WHERE student_id = NEW.student_id
  LOOP
    INSERT INTO public.notifications (school_id, recipient_id, type, title, message, link)
    VALUES (
      NEW.school_id, v_parent_id, 'absence',
      'Absence signalée',
      'Votre enfant ' || v_first || ' a été porté absent le ' || v_date_fr || '.',
      '/parent'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_absence ON public.attendance;
CREATE TRIGGER trg_notify_absence
  AFTER INSERT OR UPDATE OF status ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.notify_absence();

-- Payment trigger
CREATE OR REPLACE FUNCTION public.notify_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first text;
  v_parent_id uuid;
  v_amount text;
BEGIN
  SELECT first_name INTO v_first FROM public.students WHERE id = NEW.student_id;
  IF v_first IS NULL THEN RETURN NEW; END IF;

  v_amount := to_char(NEW.amount, 'FM999G999G999G990') ;

  FOR v_parent_id IN
    SELECT parent_profile_id FROM public.parent_students WHERE student_id = NEW.student_id
  LOOP
    INSERT INTO public.notifications (school_id, recipient_id, type, title, message, link)
    VALUES (
      NEW.school_id, v_parent_id, 'payment',
      'Paiement reçu',
      'Paiement de ' || v_amount || ' FCFA reçu pour ' || v_first || '. Reçu n°' || NEW.receipt_number || '.',
      '/parent'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_payment ON public.payment_records;
CREATE TRIGGER trg_notify_payment
  AFTER INSERT ON public.payment_records
  FOR EACH ROW EXECUTE FUNCTION public.notify_payment();

-- Announcement trigger
CREATE OR REPLACE FUNCTION public.notify_announcement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient_id uuid;
  v_link text := '/annonces';
BEGIN
  IF NEW.audience = 'Tous' THEN
    FOR v_recipient_id IN
      SELECT id FROM public.profiles
      WHERE school_id = NEW.school_id AND id <> COALESCE(NEW.author_id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND role IN ('teacher','parent','school_admin')
    LOOP
      INSERT INTO public.notifications (school_id, recipient_id, type, title, message, link)
      VALUES (NEW.school_id, v_recipient_id, 'announcement',
              'Nouvelle annonce : ' || NEW.title, NEW.content, v_link);
    END LOOP;
  ELSIF NEW.audience = 'Parents' THEN
    FOR v_recipient_id IN
      SELECT id FROM public.profiles WHERE school_id = NEW.school_id AND role = 'parent'
    LOOP
      INSERT INTO public.notifications (school_id, recipient_id, type, title, message, link)
      VALUES (NEW.school_id, v_recipient_id, 'announcement',
              'Nouvelle annonce : ' || NEW.title, NEW.content, '/parent');
    END LOOP;
  ELSIF NEW.audience = 'Enseignants' THEN
    FOR v_recipient_id IN
      SELECT id FROM public.profiles WHERE school_id = NEW.school_id AND role = 'teacher'
    LOOP
      INSERT INTO public.notifications (school_id, recipient_id, type, title, message, link)
      VALUES (NEW.school_id, v_recipient_id, 'announcement',
              'Nouvelle annonce : ' || NEW.title, NEW.content, v_link);
    END LOOP;
  ELSIF NEW.audience = 'Classe' AND NEW.target_class_id IS NOT NULL THEN
    -- Parents of students in the class
    FOR v_recipient_id IN
      SELECT DISTINCT ps.parent_profile_id
      FROM public.parent_students ps
      JOIN public.students s ON s.id = ps.student_id
      WHERE s.class_id = NEW.target_class_id
    LOOP
      INSERT INTO public.notifications (school_id, recipient_id, type, title, message, link)
      VALUES (NEW.school_id, v_recipient_id, 'announcement',
              'Nouvelle annonce : ' || NEW.title, NEW.content, '/parent');
    END LOOP;
    -- Teachers handling the class
    FOR v_recipient_id IN
      SELECT id FROM public.profiles
      WHERE school_id = NEW.school_id AND role = 'teacher'
        AND NEW.target_class_id::text = ANY(COALESCE(assigned_classes, ARRAY[]::text[]))
    LOOP
      INSERT INTO public.notifications (school_id, recipient_id, type, title, message, link)
      VALUES (NEW.school_id, v_recipient_id, 'announcement',
              'Nouvelle annonce : ' || NEW.title, NEW.content, v_link);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_announcement ON public.announcements;
CREATE TRIGGER trg_notify_announcement
  AFTER INSERT ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.notify_announcement();
