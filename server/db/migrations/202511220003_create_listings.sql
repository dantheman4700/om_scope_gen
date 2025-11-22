-- Listings and access requests that replace the Supabase tables.

CREATE TABLE IF NOT EXISTS listings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    title varchar(255) NOT NULL,
    slug varchar(120) NOT NULL UNIQUE,
    summary text NULL,
    status varchar(32) NOT NULL DEFAULT 'draft',
    hero_image_url text NULL,
    requires_nda boolean NOT NULL DEFAULT false,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    published_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listings_deal_id_idx ON listings (deal_id);
CREATE INDEX IF NOT EXISTS listings_status_idx ON listings (status);

CREATE TABLE IF NOT EXISTS listing_access_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    full_name varchar(255) NULL,
    email varchar(320) NOT NULL,
    company varchar(255) NULL,
    message text NULL,
    status varchar(32) NOT NULL DEFAULT 'pending',
    notes text NULL,
    reviewed_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listing_access_requests_listing_idx ON listing_access_requests (listing_id);
CREATE INDEX IF NOT EXISTS listing_access_requests_status_idx ON listing_access_requests (status);

