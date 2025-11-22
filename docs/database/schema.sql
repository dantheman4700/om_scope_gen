--
-- Canonical schema for the scope-doc-gen database
--

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

--
-- Utility functions / triggers
--
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--
-- Users / Teams / Membership
--
CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    email varchar(320) UNIQUE NOT NULL,
    full_name varchar(255),
    role varchar(50) NOT NULL DEFAULT 'member',
    hashed_password varchar(255) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz
);

CREATE TABLE IF NOT EXISTS teams (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name varchar(200) NOT NULL,
    owner_id uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_members (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role varchar(50) NOT NULL DEFAULT 'member',
    joined_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_team_member UNIQUE (team_id, user_id)
);

--
-- Deals
--
CREATE TABLE IF NOT EXISTS deals (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name varchar(255) NOT NULL,
    deal_name varchar(255),
    deal_description text,
    status varchar(50) NOT NULL DEFAULT 'active',
    flags jsonb NOT NULL DEFAULT '{}'::jsonb,
    owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
    team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
    created_by varchar(100),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deals_owner ON deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_team ON deals(team_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);

CREATE TRIGGER tg_deals_updated_at
    BEFORE UPDATE ON deals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

--
-- Documents
--
CREATE TABLE IF NOT EXISTS documents (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    file_name varchar(500) NOT NULL,
    file_type varchar(100) NOT NULL,
    file_size bigint,
    mime_type varchar(255),
    file_extension varchar(20),
    file_data bytea,
    file_path text,
    checksum varchar(128),
    processing_status varchar(50) NOT NULL DEFAULT 'uploaded',
    processing_error text,
    converted_formats text[],
    text_extracted boolean NOT NULL DEFAULT false,
    embeddings_created boolean NOT NULL DEFAULT false,
    extracted_text text,
    text_chunks_count integer NOT NULL DEFAULT 0,
    token_count integer NOT NULL DEFAULT 0,
    native_token_count integer NOT NULL DEFAULT 0,
    summary_token_count integer NOT NULL DEFAULT 0,
    summary_text text,
    is_summarized boolean NOT NULL DEFAULT false,
    is_too_large boolean NOT NULL DEFAULT false,
    pdf_page_count integer,
    use_summary_for_generation boolean NOT NULL DEFAULT false,
    google_doc_id varchar(255),
    converted_pdf_url text,
    converted_text_url text,
    image_description text,
    image_width integer,
    image_height integer,
    gemini_processing_tokens integer,
    n8n_execution_id varchar(100),
    workflow_step_completed varchar(100),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_documents_deal ON documents(deal_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(processing_status);

CREATE TRIGGER tg_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

--
-- Document ingestion jobs
--
CREATE TABLE IF NOT EXISTS document_ingestion_jobs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    status varchar(32) NOT NULL DEFAULT 'queued',
    error text,
    attempts integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    started_at timestamptz,
    finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_document_ingestion_jobs_deal ON document_ingestion_jobs(deal_id);
CREATE INDEX IF NOT EXISTS idx_document_ingestion_jobs_doc ON document_ingestion_jobs(document_id);

--
-- Embeddings
--
CREATE TABLE IF NOT EXISTS embeddings (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content text NOT NULL,
    content_hash varchar(64),
    embedding vector(1536) NOT NULL,
    company_name varchar(255) NOT NULL,
    file_name varchar(500) NOT NULL,
    file_type varchar(100) NOT NULL,
    chunk_index integer NOT NULL DEFAULT 0,
    chunk_size integer,
    chunk_overlap integer NOT NULL DEFAULT 0,
    content_type varchar(100) NOT NULL DEFAULT 'text',
    page_number integer,
    section_title varchar(500),
    embedding_model varchar(100) NOT NULL DEFAULT 'text-embedding-3-small',
    embedding_dimensions integer NOT NULL DEFAULT 1536,
    openai_tokens_used integer,
    openai_request_id varchar(100),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_embeddings_deal ON embeddings(deal_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_document ON embeddings(document_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings USING hnsw (embedding vector_cosine_ops);

CREATE TRIGGER tg_embeddings_updated_at
    BEFORE UPDATE ON embeddings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

--
-- Runs / steps / artifacts
--
CREATE TABLE IF NOT EXISTS runs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    status varchar(50) NOT NULL DEFAULT 'pending',
    mode varchar(20) NOT NULL DEFAULT 'full',
    research_mode varchar(20) NOT NULL DEFAULT 'none',
    created_at timestamptz NOT NULL DEFAULT now(),
    started_at timestamptz,
    finished_at timestamptz,
    result_path text,
    error text,
    instructions text,
    params jsonb NOT NULL DEFAULT '{}'::jsonb,
    included_file_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
    parent_run_id uuid REFERENCES runs(id),
    extracted_variables_artifact_id uuid
);

CREATE INDEX IF NOT EXISTS idx_runs_deal ON runs(deal_id);

CREATE TABLE IF NOT EXISTS run_steps (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    name varchar(200) NOT NULL,
    status varchar(50) NOT NULL DEFAULT 'pending',
    started_at timestamptz DEFAULT now(),
    finished_at timestamptz,
    result jsonb
);

CREATE TABLE IF NOT EXISTS artifacts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id uuid NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    kind varchar(100) NOT NULL,
    path text NOT NULL,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

--
-- Listings / access requests
--
CREATE TABLE IF NOT EXISTS listings (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    title varchar(255) NOT NULL,
    slug varchar(120) NOT NULL UNIQUE,
    summary text,
    status varchar(32) NOT NULL DEFAULT 'draft',
    hero_image_url text,
    requires_nda boolean NOT NULL DEFAULT false,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listings_deal ON listings(deal_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);

CREATE TRIGGER tg_listings_updated_at
    BEFORE UPDATE ON listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS listing_access_requests (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    full_name varchar(255),
    email varchar(320) NOT NULL,
    company varchar(255),
    message text,
    status varchar(32) NOT NULL DEFAULT 'pending',
    notes text,
    reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_access_requests_listing ON listing_access_requests(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_access_requests_status ON listing_access_requests(status);

--
-- Optional telemetry tables (processing logs / stats)
--
CREATE TABLE IF NOT EXISTS processing_logs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
    deal_id uuid REFERENCES deals(id) ON DELETE CASCADE,
    processing_step varchar(100) NOT NULL,
    status varchar(50) NOT NULL,
    message text,
    error_details jsonb,
    processing_time_ms integer,
    file_size_bytes bigint,
    text_length integer,
    chunks_created integer,
    tokens_used integer,
    n8n_execution_id varchar(100),
    n8n_node_name varchar(255),
    workflow_name varchar(255),
    openai_request_id varchar(100),
    google_api_quota_used integer,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS processing_stats (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    date_period date NOT NULL,
    hour_period integer,
    files_processed integer NOT NULL DEFAULT 0,
    total_file_size_mb numeric(10,2) NOT NULL DEFAULT 0,
    total_chunks_created integer NOT NULL DEFAULT 0,
    pdfs_processed integer NOT NULL DEFAULT 0,
    images_processed integer NOT NULL DEFAULT 0,
    documents_processed integer NOT NULL DEFAULT 0,
    avg_processing_time_ms integer,
    total_openai_tokens_used integer NOT NULL DEFAULT 0,
    total_google_api_calls integer NOT NULL DEFAULT 0,
    failed_files integer NOT NULL DEFAULT 0,
    error_rate numeric(5,2) NOT NULL DEFAULT 0,
    estimated_openai_cost_usd numeric(8,4) NOT NULL DEFAULT 0,
    estimated_google_api_cost_usd numeric(8,4) NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_processing_stats_period UNIQUE (date_period, hour_period)
);

CREATE TRIGGER tg_processing_stats_updated_at
    BEFORE UPDATE ON processing_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


