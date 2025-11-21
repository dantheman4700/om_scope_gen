-- Fix RLS policies for patent-files bucket
-- Drop existing policies
DROP POLICY IF EXISTS "Admins and editors can upload patent files" ON storage.objects;
DROP POLICY IF EXISTS "Admins and editors can view patent files" ON storage.objects;
DROP POLICY IF EXISTS "Users with NDA can view patent files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view patent files for public listings" ON storage.objects;

-- Create correct policies for patent-files bucket
CREATE POLICY "Admins and editors can manage patent files"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'patent-files' AND
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'))
)
WITH CHECK (
  bucket_id = 'patent-files' AND
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'))
);

-- Allow authenticated users to view patent files for public listings
CREATE POLICY "Anyone can view patent files for public listings"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'patent-files' AND
  EXISTS (
    SELECT 1 FROM public.listings
    WHERE listings.id::text = (storage.foldername(name))[1]
    AND listings.visibility_level = 'public'
    AND listings.status = 'active'
    AND listings.is_anonymized = false
  )
);

-- Allow authenticated users with NDA access to view patent files
CREATE POLICY "Users with NDA can view patent files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'patent-files' AND
  EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id::text = (storage.foldername(name))[1]
    AND public.has_nda_access(auth.uid(), l.id)
  )
);