
-- TRANSPORT ROUTES (circuits)
CREATE TABLE public.transport_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  assigned_vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  assigned_driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  fee_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_routes TO authenticated;
GRANT ALL ON public.transport_routes TO service_role;
ALTER TABLE public.transport_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage school transport_routes" ON public.transport_routes FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(),'school_admin') OR public.has_role(auth.uid(),'super_admin')))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(),'school_admin') OR public.has_role(auth.uid(),'super_admin')));
CREATE POLICY "Parents read school transport_routes" ON public.transport_routes FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(),'parent'));
CREATE INDEX idx_transport_routes_school ON public.transport_routes(school_id);
CREATE TRIGGER touch_transport_routes_updated_at BEFORE UPDATE ON public.transport_routes
  FOR EACH ROW EXECUTE FUNCTION public.touch_transaction_categories_updated_at();

-- ROUTE STOPS
CREATE TABLE public.route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
  stop_name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  pickup_time time,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_stops TO authenticated;
GRANT ALL ON public.route_stops TO service_role;
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage school route_stops" ON public.route_stops FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(),'school_admin') OR public.has_role(auth.uid(),'super_admin')))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(),'school_admin') OR public.has_role(auth.uid(),'super_admin')));
CREATE POLICY "Parents read school route_stops" ON public.route_stops FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(),'parent'));
CREATE INDEX idx_route_stops_route ON public.route_stops(route_id);
CREATE INDEX idx_route_stops_school ON public.route_stops(school_id);

-- STUDENT TRANSPORT ASSIGNMENTS
CREATE TABLE public.student_transport (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
  stop_id uuid REFERENCES public.route_stops(id) ON DELETE SET NULL,
  direction text NOT NULL DEFAULT 'les_deux' CHECK (direction IN ('aller','retour','les_deux')),
  fee_amount numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, route_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_transport TO authenticated;
GRANT ALL ON public.student_transport TO service_role;
ALTER TABLE public.student_transport ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage school student_transport" ON public.student_transport FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(),'school_admin') OR public.has_role(auth.uid(),'super_admin')))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND (public.has_role(auth.uid(),'school_admin') OR public.has_role(auth.uid(),'super_admin')));
CREATE POLICY "Parents read own children transport" ON public.student_transport FOR SELECT TO authenticated
  USING (public.is_parent_of_student(student_id));
CREATE POLICY "Teachers read class students transport" ON public.student_transport FOR SELECT TO authenticated
  USING (public.teacher_handles_student(student_id));
CREATE INDEX idx_student_transport_student ON public.student_transport(student_id);
CREATE INDEX idx_student_transport_route ON public.student_transport(route_id);
CREATE INDEX idx_student_transport_school ON public.student_transport(school_id);
CREATE TRIGGER touch_student_transport_updated_at BEFORE UPDATE ON public.student_transport
  FOR EACH ROW EXECUTE FUNCTION public.touch_transaction_categories_updated_at();
