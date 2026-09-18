-- Allow the "טבלה מרוכזת" layout for a minyan category.
--
-- `20260823122000_per_category_minyan_display_mode.sql` pinned the column to
-- ('tabs','list'). A third layout was later added to the picker and rendered in
-- CommunityHome, but the constraint was never widened, so choosing it failed
-- with:
--
--   new row for relation "minyan_categories" violates check constraint
--   "minyan_categories_display_mode_valid"
--
-- The option was visible and simply refused to save. Widening the constraint is
-- the whole fix; the rendering for `table` already exists.
--
-- Dropped and recreated rather than guarded by IF NOT EXISTS, because the
-- constraint does exist and its definition is what has to change.

ALTER TABLE public.minyan_categories
  DROP CONSTRAINT IF EXISTS minyan_categories_display_mode_valid;

ALTER TABLE public.minyan_categories
  ADD CONSTRAINT minyan_categories_display_mode_valid
  CHECK (display_mode IN ('tabs', 'list', 'table'));

COMMENT ON COLUMN public.minyan_categories.display_mode IS
  'Public schedule layout for this category: tabs, list or table.';
