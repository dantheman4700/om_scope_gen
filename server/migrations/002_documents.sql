-- Document Generation System Migration
-- Adds pgvector support and tables for document processing, templates, and generation

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Source documents uploaded per listing
CREATE TABLE IF NOT EXISTS listing_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT,
  storage_path TEXT NOT NULL,
  extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
  extracted_text TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Vectorized chunks for RAG with HNSW index
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES listing_documents(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  chunk_index INTEGER,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- HNSW index for fast vector similarity search (no training required)
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- Indexes for filtering by listing
CREATE INDEX IF NOT EXISTS idx_listing_documents_listing_id ON listing_documents(listing_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_listing_id ON document_chunks(listing_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);

-- Document templates (Offering Memorandum, etc.)
CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  template_content TEXT NOT NULL, -- Markdown/HTML with {{variable}} placeholders
  output_formats TEXT[] DEFAULT ARRAY['pdf', 'docx'],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Template variables with questions for RAG
CREATE TABLE IF NOT EXISTS template_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES document_templates(id) ON DELETE CASCADE,
  variable_name TEXT NOT NULL,
  display_name TEXT,
  description TEXT,
  rag_question TEXT, -- Question to query vector DB
  fallback_value TEXT,
  variable_type TEXT DEFAULT 'text' CHECK (variable_type IN ('text', 'number', 'date', 'list', 'rich_text')),
  required BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  UNIQUE(template_id, variable_name)
);

-- Index for template variables ordering
CREATE INDEX IF NOT EXISTS idx_template_variables_sort ON template_variables(template_id, sort_order);

-- Generated documents output
CREATE TABLE IF NOT EXISTS generated_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  template_id UUID REFERENCES document_templates(id),
  variables_used JSONB, -- Snapshot of variables at generation time
  pdf_path TEXT,
  docx_path TEXT,
  generation_status TEXT DEFAULT 'pending' CHECK (generation_status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for generated documents by listing
CREATE INDEX IF NOT EXISTS idx_generated_documents_listing_id ON generated_documents(listing_id);

