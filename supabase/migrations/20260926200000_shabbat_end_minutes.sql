-- When Shabbat and Yom Tov end: one number per synagogue, in its settings.
--
-- The TV board kept its own "צאת השבת" minutes (tv_config.config.shabbat.
-- endMinutesAfterSunset) and the website used a fixed 40, so a gabbai who set
-- 72 (ר"ת) on the board would have had the website show a different end.
-- It now lives with the other zmanim settings (candle lighting, nightfall),
-- and every screen reads it from here. The end shown is the later of
-- nightfall and sunset + these minutes (specialDays.holyDayEnd).
--
-- Default 40, as the board's was. The same range the board allowed (18-90).
-- A value a synagogue already set on its board is carried over.
-- Idempotent.

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS shabbat_end_minutes integer NOT NULL DEFAULT 40;

ALTER TABLE public.settings
  DROP CONSTRAINT IF EXISTS settings_shabbat_end_minutes_check;
ALTER TABLE public.settings
  ADD CONSTRAINT settings_shabbat_end_minutes_check
  CHECK (shabbat_end_minutes BETWEEN 18 AND 90);

UPDATE public.settings s
SET shabbat_end_minutes = LEAST(90, GREATEST(18, (t.config -> 'shabbat' ->> 'endMinutesAfterSunset')::integer))
FROM public.tv_config t
WHERE t.community_id = s.community_id
  AND (t.config -> 'shabbat' ->> 'endMinutesAfterSunset') ~ '^[0-9]+$';
