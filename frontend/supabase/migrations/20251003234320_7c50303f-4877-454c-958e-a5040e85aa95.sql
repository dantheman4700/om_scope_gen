-- Create storage bucket for patent files
INSERT INTO storage.buckets (id, name, public)
VALUES ('patent-files', 'patent-files', false);

-- Add patent file tracking columns to listings
ALTER TABLE public.listings
ADD COLUMN patent_file_url TEXT,
ADD COLUMN patent_count INTEGER;

-- RLS policies for patent-files bucket
CREATE POLICY "Admins can upload patent files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'patent-files' AND
  (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    ) OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'editor'
    )
  )
);

CREATE POLICY "Admins can view patent files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'patent-files' AND
  (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    ) OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'editor'
    )
  )
);

CREATE POLICY "Users with NDA access can view patent files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'patent-files' AND
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.listings
    WHERE split_part(storage.objects.name, '/', 1) = listings.id::text
      AND public.has_nda_access(auth.uid(), listings.id)
  )
);

CREATE POLICY "Public listing patent files are viewable"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'patent-files' AND
  EXISTS (
    SELECT 1 FROM public.listings
    WHERE split_part(storage.objects.name, '/', 1) = listings.id::text
      AND listings.visibility_level = 'public'
      AND listings.status = 'active'
      AND listings.is_anonymized = false
  )
);