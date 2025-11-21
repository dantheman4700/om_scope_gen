-- Fix critical RLS policy vulnerabilities

-- 1. Fix access_requests policy to prevent PII exposure
-- Drop the overly permissive policy that allows viewing all approved requests
DROP POLICY IF EXISTS "Users can view approved access requests for listings" ON public.access_requests;

-- Create a new policy that only allows viewing own requests
-- (Note: "Users can view their own access requests" policy already exists and is correct)

-- 2. Fix audit_events INSERT policy to prevent log pollution
-- Drop the unrestricted INSERT policy
DROP POLICY IF EXISTS "System can insert audit events" ON public.audit_events;

-- Create a new policy that only allows authenticated system processes to insert
-- For now, we'll allow only authenticated users to insert their own audit events
CREATE POLICY "Authenticated users can insert their own audit events"
ON public.audit_events
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can insert audit events for any user
CREATE POLICY "Admins can insert audit events"
ON public.audit_events
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));