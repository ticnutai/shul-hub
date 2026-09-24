-- One-day exceptions reach the wall live, like every other table it shows.
--
-- The TV subscribes to minyan_overrides (useBoardData), but the table was
-- never added to the realtime publication, so a gabbai cancelling tonight's
-- ma'ariv saw it on the website while the board kept the old time until it
-- happened to reload. Same two steps as 20260918120000_enable_realtime_for_display.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'minyan_overrides'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.minyan_overrides;
  END IF;
END;
$$;

ALTER TABLE public.minyan_overrides REPLICA IDENTITY FULL;
