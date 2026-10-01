-- How the website and the app show the prayer times, chosen by the gabbai in
-- one place (MinyanimAdmin, "איך יראו זמני התפילות"). The board has its own
-- answer in tv_config (prayerDays), because a wall nobody touches is not a
-- page somebody taps.
--
-- minyan_days    which days are shown:
--                  'day'        each day in its own tab, opening on today
--                  'week_today' the whole week, today on top
--                  'week_fixed' the whole week, in the tabs' own order
-- minyan_layout  how the prayers of a day are shown, for every day alike;
--                NULL keeps a layout per day (minyan_categories.display_mode),
--                which is how every synagogue was set until now.
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS minyan_days text NOT NULL DEFAULT 'day',
  ADD COLUMN IF NOT EXISTS minyan_layout text;

ALTER TABLE public.settings DROP CONSTRAINT IF EXISTS settings_minyan_days_valid;
ALTER TABLE public.settings
  ADD CONSTRAINT settings_minyan_days_valid
  CHECK (minyan_days IN ('day', 'week_today', 'week_fixed'));

ALTER TABLE public.settings DROP CONSTRAINT IF EXISTS settings_minyan_layout_valid;
ALTER TABLE public.settings
  ADD CONSTRAINT settings_minyan_layout_valid
  CHECK (minyan_layout IS NULL OR minyan_layout IN ('tabs', 'list', 'table', 'timeline', 'cards'));
