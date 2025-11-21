-- Create storage bucket for pitch decks
INSERT INTO storage.buckets (id, name, public)
VALUES ('pitch-decks', 'pitch-decks', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for pitch-decks bucket
CREATE POLICY "Admins and editors can upload pitch decks"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pitch-decks' AND
  (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'editor')
  )
);

CREATE POLICY "Admins and editors can view pitch decks"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'pitch-decks' AND
  (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'editor')
  )
);

CREATE POLICY "Admins and editors can delete pitch decks"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'pitch-decks' AND
  (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'editor')
  )
);