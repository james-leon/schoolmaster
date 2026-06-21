-- Transaction categories per school, separated by type (recette / depense)
CREATE TABLE IF NOT EXISTS public.transaction_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('recette','depense')),
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, type, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_categories TO authenticated;
GRANT ALL ON public.transaction_categories TO service_role;

ALTER TABLE public.transaction_categories ENABLE ROW LEVEL SECURITY;

-- School members can read their categories
CREATE POLICY "tc_read_same_school"
ON public.transaction_categories FOR SELECT
TO authenticated
USING (school_id = public.get_user_school_id(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Only school admins / super admins can manage
CREATE POLICY "tc_admin_insert"
ON public.transaction_categories FOR INSERT
TO authenticated
WITH CHECK (
  (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(),'school_admin'))
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "tc_admin_update"
ON public.transaction_categories FOR UPDATE
TO authenticated
USING (
  (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(),'school_admin'))
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(),'school_admin'))
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "tc_admin_delete"
ON public.transaction_categories FOR DELETE
TO authenticated
USING (
  (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(),'school_admin'))
  OR public.is_super_admin(auth.uid())
);

CREATE OR REPLACE FUNCTION public.touch_transaction_categories_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_tc_touch ON public.transaction_categories;
CREATE TRIGGER trg_tc_touch BEFORE UPDATE ON public.transaction_categories
FOR EACH ROW EXECUTE FUNCTION public.touch_transaction_categories_updated_at();

-- Seed defaults for every existing school
INSERT INTO public.transaction_categories (school_id, name, type)
SELECT s.id, x.name, 'recette'
FROM public.schools s
CROSS JOIN (VALUES
  ('Scolarité'),('Inscription'),('Cantine'),('Transport'),('Activités'),('Dons'),('Autres recettes')
) AS x(name)
ON CONFLICT (school_id, type, name) DO NOTHING;

INSERT INTO public.transaction_categories (school_id, name, type)
SELECT s.id, x.name, 'depense'
FROM public.schools s
CROSS JOIN (VALUES
  ('Salaires'),('Loyer'),('Électricité'),('Eau'),('Fournitures'),
  ('Matériel pédagogique'),('Transport'),('Maintenance'),('Communication'),('Divers')
) AS x(name)
ON CONFLICT (school_id, type, name) DO NOTHING;

-- Auto-seed defaults for any newly created school
CREATE OR REPLACE FUNCTION public.seed_transaction_categories_for_school()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.transaction_categories (school_id, name, type) VALUES
    (NEW.id,'Scolarité','recette'),
    (NEW.id,'Inscription','recette'),
    (NEW.id,'Cantine','recette'),
    (NEW.id,'Transport','recette'),
    (NEW.id,'Activités','recette'),
    (NEW.id,'Dons','recette'),
    (NEW.id,'Autres recettes','recette'),
    (NEW.id,'Salaires','depense'),
    (NEW.id,'Loyer','depense'),
    (NEW.id,'Électricité','depense'),
    (NEW.id,'Eau','depense'),
    (NEW.id,'Fournitures','depense'),
    (NEW.id,'Matériel pédagogique','depense'),
    (NEW.id,'Transport','depense'),
    (NEW.id,'Maintenance','depense'),
    (NEW.id,'Communication','depense'),
    (NEW.id,'Divers','depense')
  ON CONFLICT (school_id, type, name) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_tx_categories ON public.schools;
CREATE TRIGGER trg_seed_tx_categories AFTER INSERT ON public.schools
FOR EACH ROW EXECUTE FUNCTION public.seed_transaction_categories_for_school();