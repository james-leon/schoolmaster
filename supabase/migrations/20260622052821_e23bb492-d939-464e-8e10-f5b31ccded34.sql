
-- Suppliers table
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text,
  phone text,
  email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage school suppliers" ON public.suppliers
  FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(),'school_admin') OR public.has_role(auth.uid(),'super_admin')))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(),'school_admin') OR public.has_role(auth.uid(),'super_admin')));

CREATE POLICY "School members view suppliers" ON public.suppliers
  FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()));

CREATE INDEX idx_suppliers_school ON public.suppliers(school_id);

CREATE TRIGGER touch_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.touch_transaction_categories_updated_at();

-- Link transactions to a supplier
ALTER TABLE public.transactions
  ADD COLUMN supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;

CREATE INDEX idx_transactions_supplier ON public.transactions(supplier_id);
