-- Each minyan category owns its optional, manager-defined prayer subtabs.
ALTER TABLE public.minyan_categories
  ADD COLUMN IF NOT EXISTS subcategories jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.minyanim DROP CONSTRAINT IF EXISTS minyanim_category_id_fkey;
ALTER TABLE public.minyanim
  ADD CONSTRAINT minyanim_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES public.minyan_categories(id) ON DELETE CASCADE;

UPDATE public.minyan_categories
SET subcategories = CASE
  WHEN system_key = 'friday' THEN
    '[{"id":"shacharit","label":"שחרית"}]'::jsonb
  WHEN system_key = 'weekday' THEN
    '[{"id":"shacharit","label":"שחרית"},{"id":"mincha","label":"מנחה"},{"id":"arvit","label":"ערבית"}]'::jsonb
  ELSE subcategories
END
WHERE subcategories = '[]'::jsonb;

COMMENT ON COLUMN public.minyan_categories.subcategories IS
  'Optional ordered array of objects with string id and label. An empty array means no subtabs.';
