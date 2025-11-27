-- M&A Platform Database Schema
-- This migration creates all tables for local PostgreSQL (no Supabase dependencies)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enums (drop first if exists to allow re-running)
DROP TYPE IF EXISTS app_role CASCADE;
CREATE TYPE app_role AS ENUM ('admin', 'editor', 'reviewer', 'buyer');

DROP TYPE IF EXISTS prospect_stage CASCADE;
CREATE TYPE prospect_stage AS ENUM (
  'unknown', 'new', 'disqualified', 'sent_outreach',
  'reviewing', 'nda_signed', 'loi_submitted', 'passed', 'buyer'
);

DROP TYPE IF EXISTS enrollment_status CASCADE;
CREATE TYPE enrollment_status AS ENUM ('active', 'paused', 'completed', 'cancelled');

DROP TYPE IF EXISTS interaction_type CASCADE;
CREATE TYPE interaction_type AS ENUM ('sent', 'opened', 'clicked', 'replied', 'bounced');

DROP TYPE IF EXISTS email_domain_preference CASCADE;
CREATE TYPE email_domain_preference AS ENUM ('dynamics', 'platform', 'client');

-- Users table (replaces Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- User roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, tenant_id, role)
);

-- Listings table
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  industry TEXT,
  location TEXT,
  company_name TEXT,
  company_website TEXT,
  revenue BIGINT,
  ebitda BIGINT,
  asking_price BIGINT,
  visibility_level TEXT DEFAULT 'public' CHECK (visibility_level IN ('public', 'private', 'unlisted')),
  is_password_protected BOOLEAN DEFAULT false,
  password_hash TEXT,
  share_token TEXT UNIQUE,
  is_anonymized BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed', 'archived')),
  published_at TIMESTAMPTZ,
  source_code_repository TEXT,
  patent_count INTEGER,
  patent_file_url TEXT,
  patents TEXT[],
  trademarks TEXT[],
  copyrights TEXT[],
  scraped_data JSONB DEFAULT '{}'::jsonb,
  data_breakdown JSONB,
  meta JSONB DEFAULT '{}'::jsonb,
  email_automation_enabled BOOLEAN DEFAULT false,
  email_domain_preference email_domain_preference,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(tenant_id, slug)
);

-- Listing assets table
CREATE TABLE IF NOT EXISTS listing_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('public', 'confidential')),
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Access requests table (NDA workflow)
CREATE TABLE IF NOT EXISTS access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
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

-- Listing prospects table
CREATE TABLE IF NOT EXISTS listing_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  company TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  stage prospect_stage DEFAULT 'new',
  notes TEXT,
  metadata JSONB,
  sent_outreach_date TIMESTAMPTZ,
  response_date TIMESTAMPTZ,
  reviewing_date TIMESTAMPTZ,
  call_demo_date TIMESTAMPTZ,
  nda_signed_date TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Email sequences table
CREATE TABLE IF NOT EXISTS email_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sequence_type TEXT NOT NULL,
  steps JSONB DEFAULT '[]'::jsonb,
  is_template BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Email sequence enrollments table
CREATE TABLE IF NOT EXISTS email_sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES listing_prospects(id) ON DELETE CASCADE NOT NULL,
  sequence_id UUID REFERENCES email_sequences(id) ON DELETE CASCADE NOT NULL,
  current_step INTEGER DEFAULT 0,
  status enrollment_status DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  next_email_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Email interactions table
CREATE TABLE IF NOT EXISTS email_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES listing_prospects(id) ON DELETE CASCADE NOT NULL,
  enrollment_id UUID REFERENCES email_sequence_enrollments(id) ON DELETE CASCADE,
  interaction_type interaction_type NOT NULL,
  email_subject TEXT,
  email_body TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Audit events table
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Q&A threads table
CREATE TABLE IF NOT EXISTS qna_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  access_request_id UUID REFERENCES access_requests(id) ON DELETE SET NULL,
  asked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  answered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  answer TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'closed')),
  is_public BOOLEAN DEFAULT false,
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Q&A messages table
CREATE TABLE IF NOT EXISTS qna_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES qna_threads(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_listings_tenant_id ON listings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_visibility ON listings(visibility_level);
CREATE INDEX IF NOT EXISTS idx_listing_prospects_listing_id ON listing_prospects(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_prospects_stage ON listing_prospects(stage);
CREATE INDEX IF NOT EXISTS idx_access_requests_listing_id ON access_requests(listing_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_listing_id ON audit_events(listing_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

-- Insert default tenant
INSERT INTO tenants (slug, name, settings)
VALUES ('sherwood', 'Sherwood Partners', '{"marketplace_enabled": true}'::jsonb)
ON CONFLICT (slug) DO NOTHING;
