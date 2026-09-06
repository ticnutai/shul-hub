-- Admin-controlled home layout and announcement media.
ALTER TABLE public.home_widgets
  ADD COLUMN IF NOT EXISTS layout_width text NOT NULL DEFAULT 'full';

ALTER TABLE public.home_widgets
  DROP CONSTRAINT IF EXISTS home_widgets_layout_width_check;

ALTER TABLE public.home_widgets
  ADD CONSTRAINT home_widgets_layout_width_check
  CHECK (layout_width IN ('full', 'half'));

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS home_width text NOT NULL DEFAULT 'half';

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS image_path text;

ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_home_width_check;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_home_width_check
  CHECK (home_width IN ('full', 'half'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'community-media',
  'community-media',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "community media public read" ON storage.objects;
CREATE POLICY "community media public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'community-media');

DROP POLICY IF EXISTS "community media admin insert" ON storage.objects;
CREATE POLICY "community media admin insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'community-media' AND public.is_admin());

DROP POLICY IF EXISTS "community media admin update" ON storage.objects;
CREATE POLICY "community media admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'community-media' AND public.is_admin())
  WITH CHECK (bucket_id = 'community-media' AND public.is_admin());

DROP POLICY IF EXISTS "community media admin delete" ON storage.objects;
CREATE POLICY "community media admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'community-media' AND public.is_admin());
