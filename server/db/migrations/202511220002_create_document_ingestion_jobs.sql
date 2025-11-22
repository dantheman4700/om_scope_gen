-- Queue table for background document ingestion jobs.

CREATE TABLE IF NOT EXISTS document_ingestion_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    status varchar(32) NOT NULL DEFAULT 'queued',
    error text NULL,
    attempts integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    started_at timestamptz NULL,
    finished_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS document_ingestion_jobs_deal_idx
    ON document_ingestion_jobs (deal_id, created_at DESC);

CREATE INDEX IF NOT EXISTS document_ingestion_jobs_document_idx
    ON document_ingestion_jobs (document_id);

