
CREATE TABLE public.payroll_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  payroll_id uuid NOT NULL REFERENCES public.payroll(id) ON DELETE CASCADE,
  action text NOT NULL,
  old_status text,
  new_status text,
  reason text,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payroll_history_payroll ON public.payroll_history(payroll_id, changed_at DESC);
CREATE INDEX idx_payroll_history_school ON public.payroll_history(school_id);

GRANT SELECT, INSERT ON public.payroll_history TO authenticated;
GRANT ALL ON public.payroll_history TO service_role;

ALTER TABLE public.payroll_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_history school admin select" ON public.payroll_history
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'school_admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "payroll_history school admin insert" ON public.payroll_history
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'school_admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE POLICY "payroll_history super admin all" ON public.payroll_history
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));
