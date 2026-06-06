
DROP POLICY IF EXISTS "school members read classes" ON public.classes;
CREATE POLICY "scoped read classes"
ON public.classes FOR SELECT
TO authenticated
USING (
  school_id = public.get_user_school_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'school_admin'::app_role)
    OR public.is_super_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'teacher'::app_role) AND public.teacher_handles_class(id))
    OR public.has_role(auth.uid(), 'parent'::app_role)
  )
);

DROP POLICY IF EXISTS "school read fee_types" ON public.fee_types;
CREATE POLICY "admin read fee_types"
ON public.fee_types FOR SELECT
TO authenticated
USING (
  school_id = public.get_user_school_id(auth.uid())
  AND public.has_role(auth.uid(), 'school_admin'::app_role)
);
