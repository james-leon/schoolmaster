DROP POLICY "admin insert school notifications" ON public.notifications;
CREATE POLICY "admin insert school notifications" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'school_admin'::app_role)
  AND school_id = get_user_school_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = notifications.recipient_id
      AND p.school_id = get_user_school_id(auth.uid())
  )
);