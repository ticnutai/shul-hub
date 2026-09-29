-- Logos of a synagogue, and which one its site header shows.
--
-- The header could show the name and address, or one fixed picture - the
-- קרובים logo, the same file for every synagogue on the system. Each
-- synagogue now keeps its own logos (uploaded in its details, under "בתי
-- כנסת"), as many as it likes, and the header shows the one chosen in
-- "תצוגת דף הבית".
--
--   logos       [{ "id", "url", "path", "name" }], files in community-media/logos/
--   header_logo the id of the logo in the header; NULL = the built-in קרובים
--               logo, which is what every header in logo mode showed until now,
--               so nothing on any site changes by this migration.
--
-- home_header_variant keeps its two values ('standard' = name and address,
-- 'karovim_logo' = a logo); the constraint is unchanged.
-- Idempotent.

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS logos jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS header_logo text;

ALTER TABLE public.settings
  DROP CONSTRAINT IF EXISTS settings_logos_is_array;
ALTER TABLE public.settings
  ADD CONSTRAINT settings_logos_is_array CHECK (jsonb_typeof(logos) = 'array');
