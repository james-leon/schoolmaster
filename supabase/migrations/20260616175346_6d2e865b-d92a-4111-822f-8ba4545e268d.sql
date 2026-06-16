-- Make teacher assignment checks tolerant of the actual data shape:
-- the app stores class NAMES (e.g. "CP-A") or LEVELS (e.g. "CP") in profiles.assigned_classes,
-- not class UUIDs. Also recognize assignment via classes.teacher_id and class_subjects.teacher_id
-- (where the teachers row is linked to the profile by email).

CREATE OR REPLACE FUNCTION public.teacher_handles_class(_class_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.teacher_handles_student(_student_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = _student_id
      AND public.teacher_handles_class(s.class_id)
  )
$$;
