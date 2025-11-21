-- Add company and anonymization fields to listings
ALTER TABLE public.listings
ADD COLUMN company_name TEXT,
ADD COLUMN company_website TEXT,
ADD COLUMN is_anonymized BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN scraped_data JSONB DEFAULT '{}'::jsonb;

-- Create index for company searches
CREATE INDEX idx_listings_company_name ON public.listings(company_name) WHERE company_name IS NOT NULL;