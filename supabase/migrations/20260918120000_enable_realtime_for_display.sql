-- Publish the community tables on the realtime change feed.
--
-- The synagogue TV display stays on one page indefinitely, so it cannot rely on
-- a page load to pick up edits. Without membership in supabase_realtime a
-- postgres_changes subscription connects successfully but never receives an
-- event, which would look like a silent failure on the wall.
--
-- Only the tables the public display and the community screens read are added.
-- Nothing here touches RLS: realtime still applies the same row policies, so a
-- subscriber receives exactly the rows it is allowed to select.

DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'settings',
    'minyanim',
    'minyan_categories',
    'announcements',
    'shiurim',
    'shiur_categories',
    'chavrutot',
    'home_widgets'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = target
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', target);
    END IF;
  END LOOP;
END;
$$;

-- UPDATE and DELETE events carry only the primary key unless the table records
-- the full previous row. The display diffs incoming rows, so it needs them.
ALTER TABLE public.settings REPLICA IDENTITY FULL;
ALTER TABLE public.minyanim REPLICA IDENTITY FULL;
ALTER TABLE public.minyan_categories REPLICA IDENTITY FULL;
ALTER TABLE public.announcements REPLICA IDENTITY FULL;
ALTER TABLE public.shiurim REPLICA IDENTITY FULL;
ALTER TABLE public.shiur_categories REPLICA IDENTITY FULL;
ALTER TABLE public.chavrutot REPLICA IDENTITY FULL;
ALTER TABLE public.home_widgets REPLICA IDENTITY FULL;
