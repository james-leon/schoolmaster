CREATE OR REPLACE FUNCTION public.teacher_handles_class(_class_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND _class_id::text = ANY(COALESCE(p.assigned_classes, ARRAY[]::text[]))
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
$function$;