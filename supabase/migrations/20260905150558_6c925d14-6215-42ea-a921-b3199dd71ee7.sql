ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS transport_addon boolean NOT NULL DEFAULT false;

UPDATE public.schools
SET transport_addon = true
WHERE subscription_plan IN ('complet', 'pro', 'school+', 'premium');

WITH counts AS (
  SELECT s.id, COUNT(st.id) AS n
  FROM public.schools s
  LEFT JOIN public.students st
    ON st.school_id = s.id AND (st.status IS DISTINCT FROM 'inactive')
  GROUP BY s.id
)
UPDATE public.schools s
SET subscription_plan = CASE
  WHEN c.n < 100 THEN 'moins-100'
  WHEN c.n <= 250 THEN '100-250'
  ELSE 'plus-250'
END
FROM counts c
WHERE c.id = s.id;