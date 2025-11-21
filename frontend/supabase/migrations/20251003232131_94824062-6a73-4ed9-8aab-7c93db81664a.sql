-- Add new optional fields to listings table for technical and legal information
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS source_code_repository TEXT,
ADD COLUMN IF NOT EXISTS patents TEXT[],
ADD COLUMN IF NOT EXISTS trademarks TEXT[],
ADD COLUMN IF NOT EXISTS copyrights TEXT[],
ADD COLUMN IF NOT EXISTS data_breakdown JSONB;

COMMENT ON COLUMN public.listings.source_code_repository IS 'URL or description of source code repository';
COMMENT ON COLUMN public.listings.patents IS 'Array of patent descriptions or numbers';
COMMENT ON COLUMN public.listings.trademarks IS 'Array of trademark names or descriptions';
COMMENT ON COLUMN public.listings.copyrights IS 'Array of copyright descriptions';
COMMENT ON COLUMN public.listings.data_breakdown IS 'JSON object describing data available for sale';
