-- Add RLS policies for user_roles table to enable admin role management

-- Allow admins to assign roles to users
CREATE POLICY "Admins can assign roles"
ON public.user_roles
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Allow admins to modify existing role assignments
CREATE POLICY "Admins can modify roles"
ON public.user_roles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Allow admins to remove role assignments
CREATE POLICY "Admins can remove roles"
ON public.user_roles
FOR DELETE
USING (has_role(auth.uid(), 'admin'));