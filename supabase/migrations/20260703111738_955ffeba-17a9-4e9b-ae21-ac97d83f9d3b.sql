
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS announcement_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS announcement_message text,
  ADD COLUMN IF NOT EXISTS announcement_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS announcement_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS announcement_updated_at timestamptz;
