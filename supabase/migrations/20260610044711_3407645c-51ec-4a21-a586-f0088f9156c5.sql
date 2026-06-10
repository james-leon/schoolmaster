
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('recette','depense')),
  category text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  description text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text,
  reference text,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view own school transactions" ON public.transactions
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    AND (public.has_role(auth.uid(), 'school_admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

CREATE POLICY "Admins insert own school transactions" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = public.get_user_school_id(auth.uid())
    AND (public.has_role(auth.uid(), 'school_admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

CREATE POLICY "Admins update own school transactions" ON public.transactions
  FOR UPDATE TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    AND (public.has_role(auth.uid(), 'school_admin') OR public.has_role(auth.uid(), 'super_admin'))
  )
  WITH CHECK (
    school_id = public.get_user_school_id(auth.uid())
    AND (public.has_role(auth.uid(), 'school_admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

CREATE POLICY "Admins delete own school transactions" ON public.transactions
  FOR DELETE TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    AND (public.has_role(auth.uid(), 'school_admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

CREATE INDEX idx_transactions_school_date ON public.transactions(school_id, date DESC);

CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.touch_discipline_updated_at();
