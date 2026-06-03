ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS target_class_id uuid NULL REFERENCES public.classes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_announcements_school_pinned_created
  ON public.announcements (school_id, pinned DESC, created_at DESC);