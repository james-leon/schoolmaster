
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz,
  ADD COLUMN IF NOT EXISTS internal_notes text;

-- SECURITY DEFINER helper any authenticated school user can call to bump
-- their school's last_activity_at. Only super_admins or school members of
-- the affected school can update it.
CREATE OR REPLACE FUNCTION public.touch_school_activity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
BEGIN
  v_school_id := public.get_user_school_id(auth.uid());
  IF v_school_id IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.schools
     SET last_activity_at = now()
   WHERE id = v_school_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_school_activity() TO authenticated;
