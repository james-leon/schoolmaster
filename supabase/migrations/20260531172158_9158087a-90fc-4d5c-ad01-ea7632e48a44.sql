
-- PARENTS
CREATE TABLE public.parents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  whatsapp text,
  email text,
  relationship text,
  profession text,
  is_emergency_contact boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parents TO authenticated;
GRANT ALL ON public.parents TO service_role;
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school read parents" ON public.parents
  FOR SELECT TO authenticated
  USING (school_id = get_user_school_id(auth.uid()));
CREATE POLICY "admin insert parents" ON public.parents
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'school_admin'::app_role) AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "admin update parents" ON public.parents
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'school_admin'::app_role) AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "admin delete parents" ON public.parents
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'school_admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE INDEX idx_parents_student ON public.parents(student_id);
CREATE INDEX idx_parents_school ON public.parents(school_id);

-- ANNOUNCEMENTS
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  audience text NOT NULL DEFAULT 'Tous',
  author_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school read announcements" ON public.announcements
  FOR SELECT TO authenticated
  USING (school_id = get_user_school_id(auth.uid()));
CREATE POLICY "admin insert announcements" ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'school_admin'::app_role) AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "admin update announcements" ON public.announcements
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'school_admin'::app_role) AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "admin delete announcements" ON public.announcements
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'school_admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

CREATE INDEX idx_announcements_school ON public.announcements(school_id, created_at DESC);

-- ACADEMIC YEARS
CREATE TABLE public.academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  name text NOT NULL,
  start_date date,
  end_date date,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_years TO authenticated;
GRANT ALL ON public.academic_years TO service_role;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school read academic_years" ON public.academic_years
  FOR SELECT TO authenticated
  USING (school_id = get_user_school_id(auth.uid()));
CREATE POLICY "admin insert academic_years" ON public.academic_years
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'school_admin'::app_role) AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "admin update academic_years" ON public.academic_years
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'school_admin'::app_role) AND school_id = get_user_school_id(auth.uid()));
CREATE POLICY "admin delete academic_years" ON public.academic_years
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'school_admin'::app_role) AND school_id = get_user_school_id(auth.uid()));

-- STORAGE bucket for school logos
INSERT INTO storage.buckets (id, name, public) VALUES ('school-logos', 'school-logos', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read school logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'school-logos');
CREATE POLICY "Authenticated upload school logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'school-logos');
CREATE POLICY "Authenticated update school logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'school-logos');
CREATE POLICY "Authenticated delete school logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'school-logos');
