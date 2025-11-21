-- Create enum for prospect stages
CREATE TYPE public.prospect_stage AS ENUM (
  'unknown',
  'new',
  'disqualified',
  'sent_outreach',
  'reviewing',
  'nda_signed',
  'loi_submitted',
  'passed',
  'buyer'
);

-- Create enum for email domain preferences
CREATE TYPE public.email_domain_preference AS ENUM (
  'dynamics',
  'platform',
  'client'
);

-- Create enum for enrollment status
CREATE TYPE public.enrollment_status AS ENUM (
  'active',
  'paused',
  'completed',
  'cancelled'
);

-- Create enum for interaction types
CREATE TYPE public.interaction_type AS ENUM (
  'sent',
  'opened',
  'clicked',
  'replied',
  'bounced'
);

-- Add email automation fields to listings table
ALTER TABLE public.listings
ADD COLUMN email_automation_enabled BOOLEAN DEFAULT false,
ADD COLUMN email_domain_preference email_domain_preference DEFAULT 'dynamics';

-- Create listing_prospects table (mirrors Dynamics deal prospects)
CREATE TABLE public.listing_prospects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  stage prospect_stage NOT NULL DEFAULT 'unknown',
  sent_outreach_date TIMESTAMP WITH TIME ZONE,
  response_date TIMESTAMP WITH TIME ZONE,
  reviewing_date TIMESTAMP WITH TIME ZONE,
  call_demo_date TIMESTAMP WITH TIME ZONE,
  nda_signed_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create email_sequences table
CREATE TABLE public.email_sequences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sequence_type TEXT NOT NULL, -- '30_day', '60_day', '90_day'
  steps JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {subject, body, delay_days}
  is_template BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create email_sequence_enrollments table
CREATE TABLE public.email_sequence_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id UUID NOT NULL REFERENCES public.listing_prospects(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 0,
  status enrollment_status NOT NULL DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  next_email_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(prospect_id, sequence_id)
);

-- Create email_interactions table
CREATE TABLE public.email_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id UUID NOT NULL REFERENCES public.listing_prospects(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES public.email_sequence_enrollments(id) ON DELETE SET NULL,
  interaction_type interaction_type NOT NULL,
  email_subject TEXT,
  email_body TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.listing_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_interactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for listing_prospects
CREATE POLICY "Admins can view all prospects"
  ON public.listing_prospects FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Editors can view all prospects"
  ON public.listing_prospects FOR SELECT
  USING (has_role(auth.uid(), 'editor'));

CREATE POLICY "Admins can insert prospects"
  ON public.listing_prospects FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Editors can insert prospects"
  ON public.listing_prospects FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'editor'));

CREATE POLICY "Admins can update prospects"
  ON public.listing_prospects FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Editors can update prospects"
  ON public.listing_prospects FOR UPDATE
  USING (has_role(auth.uid(), 'editor'));

CREATE POLICY "Admins can delete prospects"
  ON public.listing_prospects FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for email_sequences
CREATE POLICY "Admins can view all sequences"
  ON public.email_sequences FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Editors can view all sequences"
  ON public.email_sequences FOR SELECT
  USING (has_role(auth.uid(), 'editor'));

CREATE POLICY "Public can view template sequences"
  ON public.email_sequences FOR SELECT
  USING (is_template = true);

CREATE POLICY "Admins can manage sequences"
  ON public.email_sequences FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Editors can manage sequences"
  ON public.email_sequences FOR ALL
  USING (has_role(auth.uid(), 'editor'));

-- RLS Policies for enrollments
CREATE POLICY "Admins can view all enrollments"
  ON public.email_sequence_enrollments FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Editors can view all enrollments"
  ON public.email_sequence_enrollments FOR SELECT
  USING (has_role(auth.uid(), 'editor'));

CREATE POLICY "Admins can manage enrollments"
  ON public.email_sequence_enrollments FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Editors can manage enrollments"
  ON public.email_sequence_enrollments FOR ALL
  USING (has_role(auth.uid(), 'editor'));

-- RLS Policies for interactions
CREATE POLICY "Admins can view all interactions"
  ON public.email_interactions FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Editors can view all interactions"
  ON public.email_interactions FOR SELECT
  USING (has_role(auth.uid(), 'editor'));

CREATE POLICY "System can insert interactions"
  ON public.email_interactions FOR INSERT
  WITH CHECK (true);

-- Triggers for updated_at
CREATE TRIGGER update_listing_prospects_updated_at
  BEFORE UPDATE ON public.listing_prospects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_sequences_updated_at
  BEFORE UPDATE ON public.email_sequences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_listing_prospects_listing_id ON public.listing_prospects(listing_id);
CREATE INDEX idx_listing_prospects_stage ON public.listing_prospects(stage);
CREATE INDEX idx_listing_prospects_email ON public.listing_prospects(contact_email);
CREATE INDEX idx_email_sequences_listing_id ON public.email_sequences(listing_id);
CREATE INDEX idx_email_sequences_template ON public.email_sequences(is_template);
CREATE INDEX idx_enrollments_prospect_id ON public.email_sequence_enrollments(prospect_id);
CREATE INDEX idx_enrollments_next_email ON public.email_sequence_enrollments(next_email_at) WHERE status = 'active';
CREATE INDEX idx_interactions_prospect_id ON public.email_interactions(prospect_id);
CREATE INDEX idx_interactions_type ON public.email_interactions(interaction_type);

-- Insert pre-built sequence templates
INSERT INTO public.email_sequences (name, description, sequence_type, is_template, steps) VALUES
(
  '30-Day Outreach Sequence',
  'Initial contact and two follow-ups over 30 days',
  '30_day',
  true,
  '[
    {
      "step": 1,
      "delay_days": 0,
      "subject": "Opportunity: {{company_name}} - Confidential Business Listing",
      "body": "Hi {{contact_name}},\n\nI wanted to reach out regarding a unique acquisition opportunity that may align with your investment criteria.\n\n{{listing_title}} is a {{industry}} business currently seeking qualified buyers. Key highlights:\n• Revenue: {{revenue}}\n• EBITDA: {{ebitda}}\n• Location: {{location}}\n\nWould you be interested in learning more? I can provide additional details under NDA.\n\nBest regards"
    },
    {
      "step": 2,
      "delay_days": 7,
      "subject": "Following up: {{company_name}} Opportunity",
      "body": "Hi {{contact_name}},\n\nI wanted to follow up on my previous email regarding {{listing_title}}.\n\nThis opportunity has generated significant interest, and I wanted to ensure you had a chance to review before we move forward with other qualified buyers.\n\nAre you available for a brief call this week?\n\nBest regards"
    },
    {
      "step": 3,
      "delay_days": 14,
      "subject": "Final follow-up: {{listing_title}}",
      "body": "Hi {{contact_name}},\n\nThis is my final follow-up regarding {{listing_title}}. We are moving into the next phase with several interested parties.\n\nIf you would like to be included in the process, please let me know by end of week.\n\nThank you for your consideration.\n\nBest regards"
    }
  ]'::jsonb
),
(
  '60-Day Nurture Sequence',
  'Extended nurture campaign with multiple touchpoints',
  '60_day',
  true,
  '[
    {
      "step": 1,
      "delay_days": 0,
      "subject": "Exclusive Opportunity: {{listing_title}}",
      "body": "Hi {{contact_name}},\n\nI hope this email finds you well. I am reaching out to share an exclusive acquisition opportunity that matches your investment profile.\n\n{{listing_title}} - {{industry}} sector\n• Asking Price: {{asking_price}}\n• Strong financials and growth trajectory\n• Confidential process\n\nWould you like to schedule a call to discuss?\n\nBest regards"
    },
    {
      "step": 2,
      "delay_days": 10,
      "subject": "Re: {{listing_title}} - Additional Information",
      "body": "Hi {{contact_name}},\n\nI wanted to share some additional context about {{listing_title}} that may be of interest:\n\n• Established customer base\n• Proprietary IP and technology\n• Experienced management team available for transition\n\nI can arrange a confidential information package under NDA. Are you interested?\n\nBest regards"
    },
    {
      "step": 3,
      "delay_days": 20,
      "subject": "Market update: {{listing_title}}",
      "body": "Hi {{contact_name}},\n\nQuick update on {{listing_title}} - we have received multiple inquiries and are scheduling site visits next month.\n\nIf you would like to remain in consideration, please confirm your interest and we can move forward with NDA and full documentation.\n\nBest regards"
    },
    {
      "step": 4,
      "delay_days": 30,
      "subject": "Last call: {{listing_title}} due diligence phase",
      "body": "Hi {{contact_name}},\n\nWe are entering due diligence with select buyers for {{listing_title}}. This is the final opportunity to express interest before we move exclusively with current parties.\n\nPlease let me know if you would like to be included.\n\nBest regards"
    }
  ]'::jsonb
),
(
  '90-Day Extended Campaign',
  'Long-term relationship building with quarterly touchpoints',
  '90_day',
  true,
  '[
    {
      "step": 1,
      "delay_days": 0,
      "subject": "Introduction: {{listing_title}}",
      "body": "Hi {{contact_name}},\n\nI am reaching out to introduce an acquisition opportunity in the {{industry}} space.\n\n{{listing_title}} represents a unique entry point into this market with strong fundamentals and growth potential.\n\nWould you be open to a preliminary conversation?\n\nBest regards"
    },
    {
      "step": 2,
      "delay_days": 15,
      "subject": "Re: {{listing_title}} - Market positioning",
      "body": "Hi {{contact_name}},\n\nFollowing up on {{listing_title}}. This business has strong market positioning with:\n• Recurring revenue streams\n• Scalable operations\n• Minimal competition in local market\n\nHappy to discuss in more detail. Any interest?\n\nBest regards"
    },
    {
      "step": 3,
      "delay_days": 30,
      "subject": "Q&A Session: {{listing_title}}",
      "body": "Hi {{contact_name}},\n\nWe are hosting confidential Q&A sessions for {{listing_title}} next month. This would be an opportunity to:\n• Review financial statements\n• Meet the management team\n• Tour facilities\n\nWould you like to participate?\n\nBest regards"
    },
    {
      "step": 4,
      "delay_days": 45,
      "subject": "Progress update: {{listing_title}}",
      "body": "Hi {{contact_name}},\n\nJust wanted to provide an update on {{listing_title}}. We have made significant progress with interested buyers and are moving toward LOI submissions.\n\nIf you would like to remain in the process, please confirm by next week.\n\nBest regards"
    },
    {
      "step": 5,
      "delay_days": 30,
      "subject": "Final opportunity: {{listing_title}}",
      "body": "Hi {{contact_name}},\n\nThis is the final outreach regarding {{listing_title}}. We are in advanced negotiations and will be closing the buyer list shortly.\n\nPlease let me know immediately if you would like to submit an LOI.\n\nThank you for your time.\n\nBest regards"
    }
  ]'::jsonb
);