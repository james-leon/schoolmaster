
-- 1) Tighten profiles UPDATE policy to also freeze must_change_password
DROP POLICY IF EXISTS "update own profile non-privileged" ON public.profiles;
CREATE POLICY "update own profile non-privileged"
ON public.profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND NOT (school_id          IS DISTINCT FROM (SELECT school_id          FROM public.profiles WHERE id = auth.uid()))
  AND NOT (role               IS DISTINCT FROM (SELECT role               FROM public.profiles WHERE id = auth.uid()))
  AND NOT (student_id         IS DISTINCT FROM (SELECT student_id         FROM public.profiles WHERE id = auth.uid()))
  AND NOT (student_ids        IS DISTINCT FROM (SELECT student_ids        FROM public.profiles WHERE id = auth.uid()))
  AND NOT (assigned_classes   IS DISTINCT FROM (SELECT assigned_classes   FROM public.profiles WHERE id = auth.uid()))
  AND NOT (assigned_subjects  IS DISTINCT FROM (SELECT assigned_subjects  FROM public.profiles WHERE id = auth.uid()))
  AND NOT (is_active          IS DISTINCT FROM (SELECT is_active          FROM public.profiles WHERE id = auth.uid()))
  AND NOT (must_change_password IS DISTINCT FROM (SELECT must_change_password FROM public.profiles WHERE id = auth.uid()))
);

-- 2) Hide schools.internal_notes from non-super-admin readers via column privileges.
--    RLS still allows row access; column-level GRANT denies reading this single column.
REVOKE SELECT (internal_notes) ON public.schools FROM authenticated;
-- Grant back every other column to authenticated so SELECT * keeps working for the rest.
GRANT SELECT (
  id, name, address, city, country, phone, email, logo_url, director_name,
  subscription_plan, created_at, enrollment_targets, status, trial_ends_at,
  subscription_start, subscription_end, show_enrollment_targets,
  last_activity_at, privacy_accepted_at, privacy_accepted_by
) ON public.schools TO authenticated;

-- 3) Teachers table: parents must not read teacher contact details.
--    Restrict SELECT to school_admin and teacher roles only.
DROP POLICY IF EXISTS "school read teachers" ON public.teachers;
CREATE POLICY "school read teachers"
ON public.teachers
FOR SELECT
USING (
  school_id = public.get_user_school_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'school_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'teacher'::public.app_role)
  )
);

-- 4) Announcements: enforce audience at the DB level.
DROP POLICY IF EXISTS "school read announcements" ON public.announcements;
CREATE POLICY "school read announcements"
ON public.announcements
FOR SELECT
USING (
  school_id = public.get_user_school_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'school_admin'::public.app_role)
    OR audience = 'Tous'
    OR (audience = 'Enseignants' AND public.has_role(auth.uid(), 'teacher'::public.app_role))
    OR (audience = 'Parents'     AND public.has_role(auth.uid(), 'parent'::public.app_role))
    OR (
      audience = 'Classe'
      AND target_class_id IS NOT NULL
      AND (
        (public.has_role(auth.uid(), 'teacher'::public.app_role)
         AND public.teacher_handles_class(target_class_id))
        OR (public.has_role(auth.uid(), 'parent'::public.app_role)
            AND EXISTS (
              SELECT 1
              FROM public.parent_students ps
              JOIN public.students s ON s.id = ps.student_id
              WHERE ps.parent_profile_id = auth.uid()
                AND s.class_id = target_class_id
            ))
      )
    )
  )
);
