-- The synagogue is closed on Shabbat; Friday has Shacharit only.
-- Preserve historical rows while hiding them from the public schedule.
UPDATE public.minyanim
SET active = false, updated_at = now()
WHERE day_type = 'shabbat' AND active = true;

UPDATE public.minyanim
SET active = false, updated_at = now()
WHERE day_type = 'friday' AND prayer <> 'shacharit' AND active = true;
