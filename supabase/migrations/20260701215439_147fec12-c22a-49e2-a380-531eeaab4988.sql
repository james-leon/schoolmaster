
-- Audit log system
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  user_id uuid,
  user_name text NOT NULL DEFAULT '',
  action_type text NOT NULL,
  target_type text,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_school_created_idx ON public.audit_logs (school_id, created_at DESC);
CREATE INDEX audit_logs_user_idx ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX audit_logs_action_idx ON public.audit_logs (action_type);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins (school_admin / super_admin) can read logs for their own school.
CREATE POLICY "admin can read school audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    public.has_role(auth.uid(), 'school_admin'::app_role)
    AND school_id = public.get_user_school_id(auth.uid())
  )
);

-- Any authenticated user can INSERT an audit entry, but only for themselves
-- and their own school. This makes client-side "best-effort" logging safe.
CREATE POLICY "authenticated can insert own audit log"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND school_id = public.get_user_school_id(auth.uid())
);

-- NO update, NO delete policies -> append-only for everyone (service_role
-- bypasses RLS, but no application code path performs updates/deletes).
