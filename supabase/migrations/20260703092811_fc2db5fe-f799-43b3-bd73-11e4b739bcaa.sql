ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS has_transport_addon boolean NOT NULL DEFAULT false;

-- Migrate any legacy plan values (starter, school+, premium, free, trial, NULL) to Pro + Transport
-- so existing schools keep every feature they previously had access to.
UPDATE public.schools
SET subscription_plan = 'pro', has_transport_addon = true
WHERE subscription_plan IS NULL
   OR subscription_plan NOT IN ('essentiel', 'pro');

-- Existing 'pro' schools also previously had transport (module was ungated) — keep access.
UPDATE public.schools
SET has_transport_addon = true
WHERE subscription_plan = 'pro' AND has_transport_addon = false;