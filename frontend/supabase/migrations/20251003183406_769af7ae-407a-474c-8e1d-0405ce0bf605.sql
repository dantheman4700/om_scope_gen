-- Update profile creation trigger to assign default 'buyer' role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_tenant_id uuid;
BEGIN
  -- Get the default tenant (Sherwood)
  SELECT id INTO default_tenant_id FROM public.tenants WHERE slug = 'sherwood' LIMIT 1;
  
  -- Insert profile
  INSERT INTO public.profiles (id, tenant_id, email, full_name)
  VALUES (
    NEW.id,
    default_tenant_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  -- Assign default 'buyer' role to new users
  IF default_tenant_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES (NEW.id, default_tenant_id, 'buyer');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create qna_threads table for Q&A functionality
CREATE TABLE public.qna_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
  access_request_id UUID REFERENCES public.access_requests(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  answer TEXT,
  is_public BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'archived')),
  asked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  answered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create qna_messages table for threaded conversations
CREATE TABLE public.qna_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES public.qna_threads(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create audit_events table for tracking
CREATE TABLE public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.qna_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qna_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for qna_threads
CREATE POLICY "Public threads are viewable by everyone"
  ON public.qna_threads FOR SELECT
  USING (is_public = true);

CREATE POLICY "Users can view their own threads"
  ON public.qna_threads FOR SELECT
  TO authenticated
  USING (asked_by = auth.uid());

CREATE POLICY "Admins/editors can view all threads"
  ON public.qna_threads FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Authenticated users can create threads"
  ON public.qna_threads FOR INSERT
  TO authenticated
  WITH CHECK (asked_by = auth.uid());

CREATE POLICY "Admins/editors can update threads"
  ON public.qna_threads FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

-- RLS Policies for qna_messages
CREATE POLICY "Users can view messages in their threads"
  ON public.qna_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.qna_threads
      WHERE qna_threads.id = qna_messages.thread_id
      AND (
        qna_threads.asked_by = auth.uid()
        OR qna_threads.is_public = true
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'editor')
      )
    )
  );

CREATE POLICY "Users can create messages in their threads"
  ON public.qna_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.qna_threads
      WHERE qna_threads.id = qna_messages.thread_id
      AND (
        qna_threads.asked_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'editor')
      )
    )
  );

-- RLS Policies for audit_events (admin only)
CREATE POLICY "Admins can view audit events"
  ON public.audit_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit events"
  ON public.audit_events FOR INSERT
  WITH CHECK (true);

-- Add triggers for updated_at
CREATE TRIGGER update_qna_threads_updated_at
  BEFORE UPDATE ON public.qna_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create helper function to check NDA access
CREATE OR REPLACE FUNCTION public.has_nda_access(
  _user_id uuid,
  _listing_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.access_requests
    WHERE listing_id = _listing_id
      AND email = (SELECT email FROM auth.users WHERE id = _user_id)
      AND status = 'approved'
      AND nda_signed_at IS NOT NULL
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Create helper function to check if user can view listing
CREATE OR REPLACE FUNCTION public.can_view_listing(
  _user_id uuid,
  _listing_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.listings
    WHERE id = _listing_id
    AND (
      -- Public and active
      (visibility_level = 'public' AND status = 'active')
      -- Or user is admin/editor
      OR public.has_role(_user_id, 'admin')
      OR public.has_role(_user_id, 'editor')
      -- Or user has NDA access for private listings
      OR (visibility_level = 'private' AND public.has_nda_access(_user_id, _listing_id))
    )
  )
$$;