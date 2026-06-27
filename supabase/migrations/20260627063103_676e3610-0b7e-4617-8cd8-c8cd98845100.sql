
-- Restrict SELECT on admin financial tables to school_admin/super_admin

DROP POLICY IF EXISTS budgets_read_same_school ON public.budgets;
CREATE POLICY budgets_read_same_school ON public.budgets FOR SELECT
USING (
  ((school_id = get_user_school_id(auth.uid())) AND has_role(auth.uid(), 'school_admin'::app_role))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS budget_lines_read_same_school ON public.budget_lines;
CREATE POLICY budget_lines_read_same_school ON public.budget_lines FOR SELECT
USING (
  ((school_id = get_user_school_id(auth.uid())) AND has_role(auth.uid(), 'school_admin'::app_role))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "School members view suppliers" ON public.suppliers;
CREATE POLICY "Admins view school suppliers" ON public.suppliers FOR SELECT
USING (
  ((school_id = get_user_school_id(auth.uid())) AND has_role(auth.uid(), 'school_admin'::app_role))
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS tc_read_same_school ON public.transaction_categories;
CREATE POLICY tc_read_same_school ON public.transaction_categories FOR SELECT
USING (
  ((school_id = get_user_school_id(auth.uid())) AND has_role(auth.uid(), 'school_admin'::app_role))
  OR is_super_admin(auth.uid())
);
