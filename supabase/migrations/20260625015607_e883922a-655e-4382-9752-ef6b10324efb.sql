
CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'brouillon' CHECK (status IN ('brouillon','actif','cloture')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);

CREATE INDEX idx_budgets_school ON public.budgets(school_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;
GRANT ALL ON public.budgets TO service_role;

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budgets_read_same_school" ON public.budgets FOR SELECT TO authenticated
  USING (school_id = get_user_school_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "budgets_admin_insert" ON public.budgets FOR INSERT TO authenticated
  WITH CHECK ((school_id = get_user_school_id(auth.uid()) AND has_role(auth.uid(),'school_admin'::app_role)) OR is_super_admin(auth.uid()));
CREATE POLICY "budgets_admin_update" ON public.budgets FOR UPDATE TO authenticated
  USING ((school_id = get_user_school_id(auth.uid()) AND has_role(auth.uid(),'school_admin'::app_role)) OR is_super_admin(auth.uid()))
  WITH CHECK ((school_id = get_user_school_id(auth.uid()) AND has_role(auth.uid(),'school_admin'::app_role)) OR is_super_admin(auth.uid()));
CREATE POLICY "budgets_admin_delete" ON public.budgets FOR DELETE TO authenticated
  USING ((school_id = get_user_school_id(auth.uid()) AND has_role(auth.uid(),'school_admin'::app_role)) OR is_super_admin(auth.uid()));

CREATE TRIGGER trg_budgets_updated_at BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.touch_transaction_categories_updated_at();

CREATE TABLE public.budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.transaction_categories(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('recette','depense')),
  planned_amount numeric NOT NULL DEFAULT 0 CHECK (planned_amount >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (budget_id, category_id)
);

CREATE INDEX idx_budget_lines_budget ON public.budget_lines(budget_id);
CREATE INDEX idx_budget_lines_school ON public.budget_lines(school_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_lines TO authenticated;
GRANT ALL ON public.budget_lines TO service_role;

ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_lines_read_same_school" ON public.budget_lines FOR SELECT TO authenticated
  USING (school_id = get_user_school_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "budget_lines_admin_insert" ON public.budget_lines FOR INSERT TO authenticated
  WITH CHECK ((school_id = get_user_school_id(auth.uid()) AND has_role(auth.uid(),'school_admin'::app_role)) OR is_super_admin(auth.uid()));
CREATE POLICY "budget_lines_admin_update" ON public.budget_lines FOR UPDATE TO authenticated
  USING ((school_id = get_user_school_id(auth.uid()) AND has_role(auth.uid(),'school_admin'::app_role)) OR is_super_admin(auth.uid()))
  WITH CHECK ((school_id = get_user_school_id(auth.uid()) AND has_role(auth.uid(),'school_admin'::app_role)) OR is_super_admin(auth.uid()));
CREATE POLICY "budget_lines_admin_delete" ON public.budget_lines FOR DELETE TO authenticated
  USING ((school_id = get_user_school_id(auth.uid()) AND has_role(auth.uid(),'school_admin'::app_role)) OR is_super_admin(auth.uid()));

CREATE TRIGGER trg_budget_lines_updated_at BEFORE UPDATE ON public.budget_lines
  FOR EACH ROW EXECUTE FUNCTION public.touch_transaction_categories_updated_at();
