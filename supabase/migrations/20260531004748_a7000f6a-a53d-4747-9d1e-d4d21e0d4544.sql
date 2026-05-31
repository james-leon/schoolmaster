
CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  subjects TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_teachers_school ON public.teachers(school_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teachers TO authenticated;
GRANT ALL ON public.teachers TO service_role;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school read teachers" ON public.teachers FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "admin insert teachers" ON public.teachers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'school_admin') AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "admin update teachers" ON public.teachers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'school_admin') AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "admin delete teachers" ON public.teachers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'school_admin') AND school_id = public.get_user_school_id(auth.uid()));

-- Now we can add the FK constraint on classes.teacher_id
ALTER TABLE public.classes ADD CONSTRAINT classes_teacher_fk
  FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;

CREATE TABLE public.class_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  coefficient INT NOT NULL DEFAULT 1,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_class_subjects_class ON public.class_subjects(class_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_subjects TO authenticated;
GRANT ALL ON public.class_subjects TO service_role;
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school read class_subjects" ON public.class_subjects FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "admin insert class_subjects" ON public.class_subjects FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'school_admin') AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "admin update class_subjects" ON public.class_subjects FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'school_admin') AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "admin delete class_subjects" ON public.class_subjects FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'school_admin') AND school_id = public.get_user_school_id(auth.uid()));
