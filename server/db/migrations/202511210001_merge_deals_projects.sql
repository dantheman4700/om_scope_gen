-- Merge deals/projects schema so files, runs, and artifacts all hang off deals.

-- Deals now track owner/team metadata similar to the old projects table.
ALTER TABLE deals
    ADD COLUMN IF NOT EXISTS owner_id uuid NULL,
    ADD COLUMN IF NOT EXISTS team_id uuid NULL,
    ADD COLUMN IF NOT EXISTS flags jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE deals
    DROP CONSTRAINT IF EXISTS deals_owner_id_fkey,
    ADD CONSTRAINT deals_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE deals
    DROP CONSTRAINT IF EXISTS deals_team_id_fkey,
    ADD CONSTRAINT deals_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

-- Documents inherit the richer metadata used by the old project_files table.
ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS checksum varchar(128),
    ADD COLUMN IF NOT EXISTS token_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS native_token_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS summary_token_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS summary_text text,
    ADD COLUMN IF NOT EXISTS is_summarized boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_too_large boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS pdf_page_count integer,
    ADD COLUMN IF NOT EXISTS use_summary_for_generation boolean NOT NULL DEFAULT false;

-- Runs now reference deals directly.
ALTER TABLE runs
    ADD COLUMN IF NOT EXISTS deal_id uuid;

UPDATE runs
SET deal_id = COALESCE(deal_id, project_id)
WHERE project_id IS NOT NULL;

ALTER TABLE runs
    ALTER COLUMN deal_id SET NOT NULL;

ALTER TABLE runs
    DROP CONSTRAINT IF EXISTS runs_deal_id_fkey,
    ADD CONSTRAINT runs_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;

ALTER TABLE runs
    DROP COLUMN IF EXISTS project_id;

-- Drop legacy tables that are now represented by deals/documents.
DROP TABLE IF EXISTS project_files CASCADE;
DROP TABLE IF EXISTS projects CASCADE;


