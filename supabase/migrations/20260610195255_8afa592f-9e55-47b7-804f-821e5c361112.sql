
-- STAFF
CREATE TABLE public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  role_title text NOT NULL,
  phone text,
  email text,
  address text,
  gender text,
  date_of_birth date,
  hire_date date,
  contract_type text,
  contract_start date,
  contract_end date,
  base_salary numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'actif',
  diplomas text,
  notes text,
  linked_teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO authenticated;
GRANT ALL ON public.staff TO service_role;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff super admin all" ON public.staff FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "staff school admin all" ON public.staff FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'school_admin'::app_role) AND school_id = public.get_user_school_id(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'school_admin'::app_role) AND school_id = public.get_user_school_id(auth.uid()));

CREATE INDEX idx_staff_school ON public.staff(school_id);

-- STAFF LEAVE
CREATE TABLE public.staff_leave (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  type text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'en attente',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_leave TO authenticated;
GRANT ALL ON public.staff_leave TO service_role;
ALTER TABLE public.staff_leave ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_leave super admin all" ON public.staff_leave FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "staff_leave school admin all" ON public.staff_leave FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'school_admin'::app_role) AND school_id = public.get_user_school_id(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'school_admin'::app_role) AND school_id = public.get_user_school_id(auth.uid()));

CREATE INDEX idx_staff_leave_staff ON public.staff_leave(staff_id);

-- PAYROLL
CREATE TABLE public.payroll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  month int NOT NULL,
  year int NOT NULL,
  base_salary numeric NOT NULL DEFAULT 0,
  bonuses numeric NOT NULL DEFAULT 0,
  deductions numeric NOT NULL DEFAULT 0,
  net_salary numeric NOT NULL DEFAULT 0,
  payment_date date,
  payment_method text,
  status text NOT NULL DEFAULT 'en attente',
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, month, year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll TO authenticated;
GRANT ALL ON public.payroll TO service_role;
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll super admin all" ON public.payroll FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "payroll school admin all" ON public.payroll FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'school_admin'::app_role) AND school_id = public.get_user_school_id(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'school_admin'::app_role) AND school_id = public.get_user_school_id(auth.uid()));

CREATE INDEX idx_payroll_school ON public.payroll(school_id);
CREATE INDEX idx_payroll_staff ON public.payroll(staff_id);

-- updated_at triggers
CREATE TRIGGER trg_staff_updated_at BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.touch_discipline_updated_at();
CREATE TRIGGER trg_payroll_updated_at BEFORE UPDATE ON public.payroll
  FOR EACH ROW EXECUTE FUNCTION public.touch_discipline_updated_at();
