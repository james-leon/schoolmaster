-- Helper: is caller a secretary of the given school?
CREATE OR REPLACE FUNCTION public.is_school_secretary(_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(auth.uid(), 'secretary'::app_role)
     AND public.get_user_school_id(auth.uid()) = _school_id
$$;

REVOKE EXECUTE ON FUNCTION public.is_school_secretary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_school_secretary(uuid) TO authenticated;

-- STUDENTS
CREATE POLICY "Secretary can view students in own school" ON public.students
  FOR SELECT TO authenticated USING (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can insert students in own school" ON public.students
  FOR INSERT TO authenticated WITH CHECK (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can update students in own school" ON public.students
  FOR UPDATE TO authenticated USING (public.is_school_secretary(school_id))
  WITH CHECK (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can delete students in own school" ON public.students
  FOR DELETE TO authenticated USING (public.is_school_secretary(school_id));

-- PARENTS
CREATE POLICY "Secretary can view parents in own school" ON public.parents
  FOR SELECT TO authenticated USING (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can insert parents in own school" ON public.parents
  FOR INSERT TO authenticated WITH CHECK (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can update parents in own school" ON public.parents
  FOR UPDATE TO authenticated USING (public.is_school_secretary(school_id))
  WITH CHECK (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can delete parents in own school" ON public.parents
  FOR DELETE TO authenticated USING (public.is_school_secretary(school_id));

-- PARENT_STUDENTS
CREATE POLICY "Secretary can view parent_students" ON public.parent_students
  FOR SELECT TO authenticated USING (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can insert parent_students" ON public.parent_students
  FOR INSERT TO authenticated WITH CHECK (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can delete parent_students" ON public.parent_students
  FOR DELETE TO authenticated USING (public.is_school_secretary(school_id));

-- CLASSES / SUBJECTS / TEACHERS / FEE_TYPES / ACADEMIC_YEARS / SCHOOLS: read
CREATE POLICY "Secretary can view classes in own school" ON public.classes
  FOR SELECT TO authenticated USING (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can view class_subjects" ON public.class_subjects
  FOR SELECT TO authenticated USING (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can view class_teachers" ON public.class_teachers
  FOR SELECT TO authenticated USING (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can view teachers in own school" ON public.teachers
  FOR SELECT TO authenticated USING (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can view fee_types in own school" ON public.fee_types
  FOR SELECT TO authenticated USING (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can view academic_years in own school" ON public.academic_years
  FOR SELECT TO authenticated USING (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can view own school" ON public.schools
  FOR SELECT TO authenticated USING (public.is_school_secretary(id));

-- INVOICES: read/create/update — NO DELETE
CREATE POLICY "Secretary can view invoices in own school" ON public.invoices
  FOR SELECT TO authenticated USING (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can insert invoices" ON public.invoices
  FOR INSERT TO authenticated WITH CHECK (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can update invoices" ON public.invoices
  FOR UPDATE TO authenticated USING (public.is_school_secretary(school_id))
  WITH CHECK (public.is_school_secretary(school_id));

-- PAYMENTS: read + insert only (SoD)
CREATE POLICY "Secretary can view payments in own school" ON public.payment_records
  FOR SELECT TO authenticated USING (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can insert payments" ON public.payment_records
  FOR INSERT TO authenticated WITH CHECK (public.is_school_secretary(school_id));

-- ATTENDANCE
CREATE POLICY "Secretary can view attendance" ON public.attendance
  FOR SELECT TO authenticated USING (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can insert attendance" ON public.attendance
  FOR INSERT TO authenticated WITH CHECK (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can update attendance" ON public.attendance
  FOR UPDATE TO authenticated USING (public.is_school_secretary(school_id))
  WITH CHECK (public.is_school_secretary(school_id));

-- ANNOUNCEMENTS
CREATE POLICY "Secretary can view announcements" ON public.announcements
  FOR SELECT TO authenticated USING (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can insert announcements" ON public.announcements
  FOR INSERT TO authenticated WITH CHECK (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can update announcements" ON public.announcements
  FOR UPDATE TO authenticated USING (public.is_school_secretary(school_id))
  WITH CHECK (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can delete announcements" ON public.announcements
  FOR DELETE TO authenticated USING (public.is_school_secretary(school_id));

-- EVENTS
CREATE POLICY "Secretary can view events" ON public.events
  FOR SELECT TO authenticated USING (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can insert events" ON public.events
  FOR INSERT TO authenticated WITH CHECK (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can update events" ON public.events
  FOR UPDATE TO authenticated USING (public.is_school_secretary(school_id))
  WITH CHECK (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can delete events" ON public.events
  FOR DELETE TO authenticated USING (public.is_school_secretary(school_id));

-- NOTIFICATIONS
CREATE POLICY "Secretary can insert notifications in own school" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (public.is_school_secretary(school_id));

-- TRANSPORT
CREATE POLICY "Secretary can view transport_routes" ON public.transport_routes
  FOR SELECT TO authenticated USING (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can view route_stops" ON public.route_stops
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transport_routes r
                 WHERE r.id = route_stops.route_id AND public.is_school_secretary(r.school_id)));
CREATE POLICY "Secretary can view student_transport" ON public.student_transport
  FOR SELECT TO authenticated USING (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can insert student_transport" ON public.student_transport
  FOR INSERT TO authenticated WITH CHECK (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can update student_transport" ON public.student_transport
  FOR UPDATE TO authenticated USING (public.is_school_secretary(school_id))
  WITH CHECK (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can delete student_transport" ON public.student_transport
  FOR DELETE TO authenticated USING (public.is_school_secretary(school_id));

-- GRADES / DISCIPLINE / TIMETABLE: read only
CREATE POLICY "Secretary can view grades" ON public.grades
  FOR SELECT TO authenticated USING (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can view discipline_records" ON public.discipline_records
  FOR SELECT TO authenticated USING (public.is_school_secretary(school_id));
CREATE POLICY "Secretary can view timetable" ON public.timetable
  FOR SELECT TO authenticated USING (public.is_school_secretary(school_id));

-- PROFILES: read profiles of own school
CREATE POLICY "Secretary can view profiles in own school" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_school_secretary(school_id));
