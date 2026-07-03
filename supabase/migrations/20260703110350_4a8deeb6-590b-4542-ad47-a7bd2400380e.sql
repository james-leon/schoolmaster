
CREATE TABLE public.platform_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  maintenance_active BOOLEAN NOT NULL DEFAULT false,
  maintenance_message TEXT,
  maintenance_expected_return TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT ALL ON public.platform_settings TO service_role;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read maintenance status"
  ON public.platform_settings FOR SELECT
  USING (true);

CREATE POLICY "Only super admins can modify platform settings"
  ON public.platform_settings FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

INSERT INTO public.platform_settings (id, maintenance_active) VALUES (true, false)
ON CONFLICT (id) DO NOTHING;
