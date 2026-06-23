
-- VEHICLES
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  registration_number text NOT NULL,
  bus_number text,
  brand text,
  model text,
  capacity integer,
  year integer,
  status text NOT NULL DEFAULT 'en_service' CHECK (status IN ('en_service','en_panne','maintenance')),
  photo_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage school vehicles" ON public.vehicles FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(),'school_admin') OR public.has_role(auth.uid(),'super_admin')))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(),'school_admin') OR public.has_role(auth.uid(),'super_admin')));
CREATE INDEX idx_vehicles_school ON public.vehicles(school_id);
CREATE TRIGGER touch_vehicles_updated_at BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.touch_transaction_categories_updated_at();

-- DRIVERS
CREATE TABLE public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  license_number text,
  license_expiry date,
  assigned_vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  staff_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage school drivers" ON public.drivers FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(),'school_admin') OR public.has_role(auth.uid(),'super_admin')))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(),'school_admin') OR public.has_role(auth.uid(),'super_admin')));
CREATE INDEX idx_drivers_school ON public.drivers(school_id);
CREATE TRIGGER touch_drivers_updated_at BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.touch_transaction_categories_updated_at();

-- VEHICLE DOCUMENTS
CREATE TABLE public.vehicle_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('assurance','visite_technique','vignette','autre')),
  provider text,
  start_date date,
  expiry_date date,
  amount numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_documents TO authenticated;
GRANT ALL ON public.vehicle_documents TO service_role;
ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage school vehicle_documents" ON public.vehicle_documents FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(),'school_admin') OR public.has_role(auth.uid(),'super_admin')))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(),'school_admin') OR public.has_role(auth.uid(),'super_admin')));
CREATE INDEX idx_vehicle_documents_vehicle ON public.vehicle_documents(vehicle_id);
CREATE INDEX idx_vehicle_documents_school ON public.vehicle_documents(school_id);
CREATE TRIGGER touch_vehicle_documents_updated_at BEFORE UPDATE ON public.vehicle_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_transaction_categories_updated_at();

-- LINK TRANSACTIONS -> VEHICLE (single source of truth in Comptabilité)
ALTER TABLE public.transactions
  ADD COLUMN vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL;
CREATE INDEX idx_transactions_vehicle ON public.transactions(vehicle_id);
