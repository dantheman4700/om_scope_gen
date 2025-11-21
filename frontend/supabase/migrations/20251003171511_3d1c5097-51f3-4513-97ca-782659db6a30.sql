-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'reviewer', 'buyer');

-- Create tenants table
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, tenant_id, role)
);

-- Create listings table
CREATE TABLE public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  industry TEXT,
  location TEXT,
  revenue BIGINT,
  ebitda BIGINT,
  asking_price BIGINT,
  visibility_level TEXT DEFAULT 'public' CHECK (visibility_level IN ('public', 'private', 'unlisted')),
  is_password_protected BOOLEAN DEFAULT false,
  password_hash TEXT,
  share_token TEXT UNIQUE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed', 'archived')),
  published_at TIMESTAMPTZ,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(tenant_id, slug)
);

-- Create listing_assets table
CREATE TABLE public.listing_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('public', 'confidential')),
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create access_requests table (for NDA workflow)
CREATE TABLE public.access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  magic_token TEXT UNIQUE,
  access_token TEXT UNIQUE,
  nda_signed_at TIMESTAMPTZ,
  signature TEXT,
  ip_address INET,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS Policies for listings (public can view public listings, admins/editors can manage)
CREATE POLICY "Public listings are viewable by everyone"
  ON public.listings FOR SELECT
  USING (visibility_level = 'public' AND status = 'active');

CREATE POLICY "Admins can view all listings"
  ON public.listings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Editors can view all listings"
  ON public.listings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Admins can insert listings"
  ON public.listings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Editors can insert listings"
  ON public.listings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Admins can update listings"
  ON public.listings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Editors can update listings"
  ON public.listings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'editor'));

-- RLS Policies for user_roles (users can view their own roles)
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- RLS Policies for tenants (public read, admin write)
CREATE POLICY "Anyone can view tenants"
  ON public.tenants FOR SELECT
  USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to auto-create profile on user signup
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Insert default tenant
INSERT INTO public.tenants (slug, name, settings)
VALUES ('sherwood', 'Sherwood Partners', '{"marketplace_enabled": true}'::jsonb);