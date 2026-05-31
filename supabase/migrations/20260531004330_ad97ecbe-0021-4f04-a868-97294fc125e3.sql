
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('school_admin', 'teacher', 'parent');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============ SCHOOLS ============
CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  country TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  director_name TEXT,
  subscription_plan TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  full_name TEXT,
  email TEXT,
  role public.app_role,
  phone TEXT,
  avatar_url TEXT,
  assigned_classes TEXT[] DEFAULT '{}',
  assigned_subjects TEXT[] DEFAULT '{}',
  student_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- helpers (defined after profiles exists)
CREATE OR REPLACE FUNCTION public.get_user_school_id(_user_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT school_id FROM public.profiles WHERE id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.get_user_student_id(_user_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT student_id FROM public.profiles WHERE id = _user_id
$$;

-- Profiles policies
CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "admin update school profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'school_admin') AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "admin delete school profiles" ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'school_admin') AND school_id = public.get_user_school_id(auth.uid()));

-- Schools policies
CREATE POLICY "members read own school" ON public.schools FOR SELECT TO authenticated
  USING (id = public.get_user_school_id(auth.uid()));
CREATE POLICY "admin insert school" ON public.schools FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'school_admin'));
CREATE POLICY "admin update own school" ON public.schools FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'school_admin') AND id = public.get_user_school_id(auth.uid()));
CREATE POLICY "admin delete own school" ON public.schools FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'school_admin') AND id = public.get_user_school_id(auth.uid()));

-- ============ CLASSES ============
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level TEXT,
  capacity INT,
  teacher_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_classes_school ON public.classes(school_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school members read classes" ON public.classes FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "admin write classes" ON public.classes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'school_admin') AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "admin update classes" ON public.classes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'school_admin') AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "admin delete classes" ON public.classes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'school_admin') AND school_id = public.get_user_school_id(auth.uid()));

-- ============ STUDENTS ============
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birth_date DATE,
  birth_place TEXT,
  gender TEXT,
  photo_url TEXT,
  enrollment_date DATE,
  student_code TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_students_school ON public.students(school_id);
CREATE INDEX idx_students_class ON public.students(class_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school staff read students" ON public.students FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'school_admin')
      OR public.has_role(auth.uid(), 'teacher')
      OR id = public.get_user_student_id(auth.uid())
    )
  );
CREATE POLICY "admin insert students" ON public.students FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'school_admin') AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "admin update students" ON public.students FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'school_admin') AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "admin delete students" ON public.students FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'school_admin') AND school_id = public.get_user_school_id(auth.uid()));

-- ============ AUTO-CREATE PROFILE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
