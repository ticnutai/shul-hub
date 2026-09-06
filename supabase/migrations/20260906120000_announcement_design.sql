-- Per-announcement presentation settings managed from the admin screen.
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS style jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_style_object_check;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_style_object_check
  CHECK (jsonb_typeof(style) = 'object');
