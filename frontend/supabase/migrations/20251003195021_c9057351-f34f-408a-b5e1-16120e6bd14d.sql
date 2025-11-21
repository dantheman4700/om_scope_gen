-- Fix access_requests RLS policy to not query auth.users
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view their own access requests" ON public.access_requests;

-- Create new policy that uses email from profiles table instead
CREATE POLICY "Users can view their own access requests" 
ON public.access_requests 
FOR SELECT 
USING (
  email = (
    SELECT email FROM public.profiles WHERE id = auth.uid()
  )::text
);

-- Add policy for buyers with NDA access to view private listings
CREATE POLICY "Users with NDA can view private listings" 
ON public.listings 
FOR SELECT 
USING (
  visibility_level = 'private' 
  AND status = 'active' 
  AND public.has_nda_access(auth.uid(), id)
);

-- Allow users to view approved access requests for listings
DROP POLICY IF EXISTS "Users can view approved access requests for listings" ON public.access_requests;
CREATE POLICY "Users can view approved access requests for listings" 
ON public.access_requests 
FOR SELECT 
USING (
  status = 'approved' 
  AND nda_signed_at IS NOT NULL
);