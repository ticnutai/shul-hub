-- Canonical publication order and per-announcement home-page visibility.
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS sort_order integer;

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS show_on_home boolean NOT NULL DEFAULT true;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (ORDER BY pinned DESC, created_at DESC, id) * 10 AS position
  FROM public.announcements
)
UPDATE public.announcements AS announcement
SET sort_order = ranked.position
FROM ranked
WHERE announcement.id = ranked.id
  AND announcement.sort_order IS NULL;

ALTER TABLE public.announcements
  ALTER COLUMN sort_order SET DEFAULT 100000,
  ALTER COLUMN sort_order SET NOT NULL;

CREATE INDEX IF NOT EXISTS announcements_publication_order_idx
  ON public.announcements (sort_order, created_at DESC);
