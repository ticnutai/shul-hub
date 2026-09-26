-- A minyan for a season: בין הזמנים, summer or winter hours.
--
-- A tab (minyan_categories) already has visible_from / visible_until, but a
-- season usually adds a few minyanim to the ordinary list rather than
-- replacing it: "מניינים נוספים לימי בין הזמנים, שאר הזמנים כרגיל". So the
-- dates belong on the minyan too. Both are optional and inclusive days in
-- Israel; empty means always, which is every existing row.
ALTER TABLE public.minyanim
  ADD COLUMN IF NOT EXISTS active_from  date,
  ADD COLUMN IF NOT EXISTS active_until date;

ALTER TABLE public.minyanim
  DROP CONSTRAINT IF EXISTS minyanim_season_order;
ALTER TABLE public.minyanim
  ADD CONSTRAINT minyanim_season_order
  CHECK (active_from IS NULL OR active_until IS NULL OR active_from <= active_until);

COMMENT ON COLUMN public.minyanim.active_from  IS 'First day (Israel) this minyan is held; null = no start.';
COMMENT ON COLUMN public.minyanim.active_until IS 'Last day (Israel) this minyan is held; null = no end.';
