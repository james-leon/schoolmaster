
CREATE TABLE public.class_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  is_principal boolean NOT NULL DEFAULT false,
  subject_id uuid REFERENCES public.class_subjects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, teacher_id, subject_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_teachers TO authenticated;
GRANT ALL ON public.class_teachers TO service_role;

ALTER TABLE public.class_teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scoped read class_teachers" ON public.class_teachers
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'school_admin'::public.app_role)
      OR public.is_super_admin(auth.uid())
      OR (public.has_role(auth.uid(), 'teacher'::public.app_role) AND public.teacher_handles_class(class_id))
    )
  );

CREATE POLICY "admin insert class_teachers" ON public.class_teachers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'school_admin'::public.app_role)
    AND school_id = public.get_user_school_id(auth.uid())
  );

CREATE POLICY "admin update class_teachers" ON public.class_teachers
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'school_admin'::public.app_role)
    AND school_id = public.get_user_school_id(auth.uid())
  );

CREATE POLICY "admin delete class_teachers" ON public.class_teachers
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'school_admin'::public.app_role)
    AND school_id = public.get_user_school_id(auth.uid())
  );

CREATE POLICY "super admin all class_teachers" ON public.class_teachers
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Backfill principal teacher from classes.teacher_id
INSERT INTO public.class_teachers (school_id, class_id, teacher_id, is_principal)
SELECT c.school_id, c.id, c.teacher_id, true
FROM public.classes c
WHERE c.teacher_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Backfill subject teachers from class_subjects.teacher_id
INSERT INTO public.class_teachers (school_id, class_id, teacher_id, subject_id, is_principal)
SELECT cs.school_id, cs.class_id, cs.teacher_id, cs.id, false
FROM public.class_subjects cs
WHERE cs.teacher_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Extend teacher_handles_class to include class_teachers links
CREATE OR REPLACE FUNCTION public.teacher_handles_class(_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.classes c ON c.id = _class_id
    WHERE p.id = auth.uid()
      AND (
        _class_id::text = ANY(COALESCE(p.assigned_classes, ARRAY[]::text[]))
        OR c.name = ANY(COALESCE(p.assigned_classes, ARRAY[]::text[]))
        OR c.level = ANY(COALESCE(p.assigned_classes, ARRAY[]::text[]))
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.teachers t
      ON lower(t.email) = lower(p.email)
     AND t.school_id = p.school_id
    JOIN public.classes c ON c.id = _class_id AND c.teacher_id = t.id
    WHERE p.id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.teachers t
      ON lower(t.email) = lower(p.email)
     AND t.school_id = p.school_id
    JOIN public.class_subjects cs
      ON cs.class_id = _class_id
     AND cs.teacher_id = t.id
    WHERE p.id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.teachers t
      ON lower(t.email) = lower(p.email)
     AND t.school_id = p.school_id
    JOIN public.class_teachers ct
      ON ct.class_id = _class_id
     AND ct.teacher_id = t.id
    WHERE p.id = auth.uid()
  )
$$;
