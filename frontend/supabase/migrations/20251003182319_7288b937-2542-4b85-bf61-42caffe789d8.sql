-- RLS Policies for listing_assets
CREATE POLICY "Public assets are viewable by everyone"
  ON public.listing_assets FOR SELECT
  USING (
    asset_type = 'public' AND
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = listing_assets.listing_id
      AND listings.visibility_level = 'public'
      AND listings.status = 'active'
    )
  );

CREATE POLICY "Admins can view all assets"
  ON public.listing_assets FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Editors can view all assets"
  ON public.listing_assets FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Admins can insert assets"
  ON public.listing_assets FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Editors can insert assets"
  ON public.listing_assets FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'editor'));

-- RLS Policies for access_requests
CREATE POLICY "Users can view their own access requests"
  ON public.access_requests FOR SELECT
  TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Admins can view all access requests"
  ON public.access_requests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can create access requests"
  ON public.access_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update access requests"
  ON public.access_requests FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Fix search_path for handle_new_user function (already has it, but re-create to be sure)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

-- Fix search_path for update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;