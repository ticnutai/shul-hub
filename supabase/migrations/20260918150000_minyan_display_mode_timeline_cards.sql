-- Allow the "ציר זמן" (timeline) and "כרטיסיות" (cards) schedule layouts.
--
-- Shipped in the same change as the two layouts themselves, so the picker never
-- offers an option the database refuses. That mismatch is exactly what broke
-- "טבלה מרוכזת": the UI gained the option, the constraint did not, and the
-- choice silently failed to save (see 20260918140000).
--
-- The constraint is kept, not dropped, so a typo or a stale client still gets a
-- clear rejection instead of storing a value no build can render.

ALTER TABLE public.minyan_categories
  DROP CONSTRAINT IF EXISTS minyan_categories_display_mode_valid;

ALTER TABLE public.minyan_categories
  ADD CONSTRAINT minyan_categories_display_mode_valid
  CHECK (display_mode IN ('tabs', 'list', 'table', 'timeline', 'cards'));

COMMENT ON COLUMN public.minyan_categories.display_mode IS
  'Public schedule layout for this category: tabs, list, table, timeline or cards.';
