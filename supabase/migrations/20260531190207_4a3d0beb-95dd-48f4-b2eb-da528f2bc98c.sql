
DROP POLICY IF EXISTS "school logos public read" ON storage.objects;
-- Public buckets serve files via direct/public URL without a SELECT policy.
-- No SELECT policy = no listing, which is what we want.
