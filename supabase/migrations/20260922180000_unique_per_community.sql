-- Uniqueness that means "once per synagogue", not "once in the world".
--
-- Three tables were given a community_id by the tenant layer but kept the
-- unique keys they were born with, back when there was one synagogue and
-- "the weekday tab" could only mean one thing:
--
--   minyan_categories.system_key   UNIQUE
--   shiur_categories.name          UNIQUE
--   home_widgets.key               UNIQUE
--
-- The second synagogue therefore could not have a weekday tab at all. Its
-- board read "לא הוגדרו מניינים להיום" - which is true, and says nothing -
-- and the server, when asked to create the tab, answered
-- "duplicate key value violates unique constraint". Not a data problem: a
-- rule from an earlier shape of the world, still being enforced.
--
-- This is the same mistake as user_roles_user_id_role_key, which stopped one
-- person administering two synagogues. Both were written when the answer to
-- "which synagogue?" was "the synagogue". The fix is the same: put the
-- synagogue in the key.
--
-- Widening a unique key can never fail on existing rows - anything unique
-- globally is unique within a community - so there is nothing to clean up
-- first.

ALTER TABLE public.minyan_categories DROP CONSTRAINT IF EXISTS minyan_categories_system_key_key;
ALTER TABLE public.shiur_categories  DROP CONSTRAINT IF EXISTS shiur_categories_name_key;
ALTER TABLE public.home_widgets      DROP CONSTRAINT IF EXISTS home_widgets_key_key;

-- system_key is nullable: a tab the gabbai invented has no system key, and
-- any number of those may exist. NULLs stay distinct from each other, which
-- is what the old constraint did too.
CREATE UNIQUE INDEX IF NOT EXISTS minyan_categories_community_system_key
  ON public.minyan_categories (community_id, system_key);

CREATE UNIQUE INDEX IF NOT EXISTS shiur_categories_community_name_key
  ON public.shiur_categories (community_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS home_widgets_community_key
  ON public.home_widgets (community_id, key);
