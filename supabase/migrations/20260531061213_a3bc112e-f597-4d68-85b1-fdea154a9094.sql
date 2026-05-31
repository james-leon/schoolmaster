
-- Phase 2: grades, attendance, fee_types, invoices, payment_records

CREATE TABLE public.grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  class_id uuid,
  subject_id uuid,
  subject text NOT NULL,
  term text NOT NULL,
  evaluation_type text,
  grade numeric,
  devoir1 numeric,
  devoir2 numeric,
  composition numeric,
  value numeric NOT NULL DEFAULT 0,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grades TO authenticated;
GRANT ALL ON public.grades TO service_role;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school read grades" ON public.grades FOR SELECT TO authenticated
  USING (school_id = get_user_school_id(auth.uid()));
CREATE POLICY "staff insert grades" ON public.grades FOR INSERT TO authenticated
  WITH CHECK (school_id = get_user_school_id(auth.uid()) AND (has_role(auth.uid(),'school_admin') OR has_role(auth.uid(),'teacher')));
CREATE POLICY "staff update grades" ON public.grades FOR UPDATE TO authenticated
  USING (school_id = get_user_school_id(auth.uid()) AND (has_role(auth.uid(),'school_admin') OR has_role(auth.uid(),'teacher')));
CREATE POLICY "staff delete grades" ON public.grades FOR DELETE TO authenticated
  USING (school_id = get_user_school_id(auth.uid()) AND (has_role(auth.uid(),'school_admin') OR has_role(auth.uid(),'teacher')));

CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  date date NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school read attendance" ON public.attendance FOR SELECT TO authenticated
  USING (school_id = get_user_school_id(auth.uid()));
CREATE POLICY "staff insert attendance" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (school_id = get_user_school_id(auth.uid()) AND (has_role(auth.uid(),'school_admin') OR has_role(auth.uid(),'teacher')));
CREATE POLICY "staff update attendance" ON public.attendance FOR UPDATE TO authenticated
  USING (school_id = get_user_school_id(auth.uid()) AND (has_role(auth.uid(),'school_admin') OR has_role(auth.uid(),'teacher')));
CREATE POLICY "staff delete attendance" ON public.attendance FOR DELETE TO authenticated
  USING (school_id = get_user_school_id(auth.uid()) AND (has_role(auth.uid(),'school_admin') OR has_role(auth.uid(),'teacher')));

CREATE TABLE public.fee_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  scope text NOT NULL DEFAULT 'Tous',
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_types TO authenticated;
GRANT ALL ON public.fee_types TO service_role;
ALTER TABLE public.fee_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school read fee_types" ON public.fee_types FOR SELECT TO authenticated
  USING (school_id = get_user_school_id(auth.uid()));
CREATE POLICY "admin insert fee_types" ON public.fee_types FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'school_admin') AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "admin update fee_types" ON public.fee_types FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'school_admin') AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "admin delete fee_types" ON public.fee_types FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'school_admin') AND school_id = get_user_school_id(auth.uid()));

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  invoice_number text,
  student_id uuid NOT NULL,
  fee_type_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  type text,
  status text NOT NULL DEFAULT 'impaye',
  mode text,
  reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school read invoices" ON public.invoices FOR SELECT TO authenticated
  USING (school_id = get_user_school_id(auth.uid()));
CREATE POLICY "admin insert invoices" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'school_admin') AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "admin update invoices" ON public.invoices FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'school_admin') AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "admin delete invoices" ON public.invoices FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'school_admin') AND school_id = get_user_school_id(auth.uid()));

CREATE TABLE public.payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  receipt_number text NOT NULL,
  invoice_id uuid NOT NULL,
  student_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  mode text NOT NULL,
  reference text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_records TO authenticated;
GRANT ALL ON public.payment_records TO service_role;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school read payment_records" ON public.payment_records FOR SELECT TO authenticated
  USING (school_id = get_user_school_id(auth.uid()));
CREATE POLICY "admin insert payment_records" ON public.payment_records FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'school_admin') AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "admin update payment_records" ON public.payment_records FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'school_admin') AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "admin delete payment_records" ON public.payment_records FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'school_admin') AND school_id = get_user_school_id(auth.uid()));

CREATE INDEX idx_grades_school ON public.grades(school_id);
CREATE INDEX idx_attendance_school_date ON public.attendance(school_id, date);
CREATE INDEX idx_invoices_school_student ON public.invoices(school_id, student_id);
CREATE INDEX idx_payment_records_invoice ON public.payment_records(invoice_id);
