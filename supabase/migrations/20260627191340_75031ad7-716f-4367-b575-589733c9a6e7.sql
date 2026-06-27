DROP POLICY IF EXISTS "school read own payment_subscriptions" ON public.payment_subscriptions;

CREATE POLICY "admin read school payment_subscriptions"
ON public.payment_subscriptions
FOR SELECT
TO authenticated
USING (
  (school_id = public.get_user_school_id(auth.uid())
   AND public.has_role(auth.uid(), 'school_admin'::app_role))
  OR public.is_super_admin(auth.uid())
);