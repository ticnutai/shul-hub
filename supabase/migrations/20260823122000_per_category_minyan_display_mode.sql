-- Each minyan category independently chooses between prayer tabs and a grouped list.
ALTER TABLE public.minyan_categories
  ADD COLUMN IF NOT EXISTS display_mode text NOT NULL DEFAULT 'tabs';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.minyan_categories'::regclass
      AND conname = 'minyan_categories_display_mode_valid'
  ) THEN
    ALTER TABLE public.minyan_categories
      ADD CONSTRAINT minyan_categories_display_mode_valid
      CHECK (display_mode IN ('tabs', 'list'));
  END IF;
END
$$;

COMMENT ON COLUMN public.minyan_categories.display_mode IS
  'Public schedule layout for this category: tabs or list.';
