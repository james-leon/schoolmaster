-- Allow public read on school-logos so logos display via public URL.
-- Insert/update/delete policies already restrict writes to the school's own admin.
DROP POLICY IF EXISTS "Public can view logos" ON storage.objects;
CREATE POLICY "Public can view logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'school-logos');

-- Ensure bucket exists and is public (idempotent).
INSERT INTO storage.buckets (id, name, public)
VALUES ('school-logos', 'school-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;