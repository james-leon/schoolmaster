ALTER TABLE public.academic_years
  ADD COLUMN IF NOT EXISTS term1_start date,
  ADD COLUMN IF NOT EXISTS term1_end date,
  ADD COLUMN IF NOT EXISTS term2_start date,
  ADD COLUMN IF NOT EXISTS term2_end date,
  ADD COLUMN IF NOT EXISTS term3_start date,
  ADD COLUMN IF NOT EXISTS term3_end date;