-- Manager-defined minyan tabs, including optional seasonal visibility windows.
CREATE TABLE IF NOT EXISTS public.minyan_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  system_key text UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  visible_from date,
  visible_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT minyan_categories_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT minyan_categories_valid_window CHECK (
    visible_from IS NULL OR visible_until IS NULL OR visible_from <= visible_until
  )
);

INSERT INTO public.minyan_categories (name, system_key, sort_order, active)
VALUES
  ('ימות החול', 'weekday', 10, true),
  ('יום שישי', 'friday', 20, true)
ON CONFLICT (system_key) DO UPDATE SET name = EXCLUDED.name;

ALTER TABLE public.minyanim
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.minyan_categories(id) ON DELETE SET NULL;

UPDATE public.minyanim m
SET category_id = c.id
FROM public.minyan_categories c
WHERE m.category_id IS NULL AND c.system_key = m.day_type;

CREATE INDEX IF NOT EXISTS minyanim_category_sort_idx
  ON public.minyanim(category_id, prayer, sort_order);

GRANT SELECT ON public.minyan_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.minyan_categories TO authenticated;
GRANT ALL ON public.minyan_categories TO service_role;

ALTER TABLE public.minyan_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "minyan categories public read" ON public.minyan_categories;
DROP POLICY IF EXISTS "minyan categories admin write" ON public.minyan_categories;
CREATE POLICY "minyan categories public read" ON public.minyan_categories
  FOR SELECT USING (true);
CREATE POLICY "minyan categories admin write" ON public.minyan_categories
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS minyan_categories_updated ON public.minyan_categories;
CREATE TRIGGER minyan_categories_updated BEFORE UPDATE ON public.minyan_categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
