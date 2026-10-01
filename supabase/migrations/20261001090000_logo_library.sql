-- A shared library of logos for the TV boards.
--
-- The TV header drew one logo from a file inside the code (Effi Capital), on
-- every synagogue's board, though it belongs to one of them. Logos are now
-- files uploaded by the gabbaim into one library, open to every synagogue on
-- the system; each board chooses which of them it shows (tv_config.config.logos,
-- a copy of the chosen entries, so a TV that is offline still has them).
--
--   url        the logo, as drawn on a light board
--   url_dark   optional: the same mark cut for a dark board (a dark wordmark
--              disappears on navy); the board picks the cut by its theme
--   path, path_dark  the files in community-media/logo-library/, so a logo
--              can be removed together with its files
--
-- Anyone reads it (the TV reads it without signing in; the files are public
-- anyway). Any admin adds to it - that is what makes it shared. Only whoever
-- uploaded a logo, or a platform admin, changes or removes it: another
-- synagogue's board may be showing it.
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.logo_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  url text NOT NULL CHECK (url LIKE 'https://%'),
  path text,
  url_dark text CHECK (url_dark IS NULL OR url_dark LIKE 'https://%'),
  path_dark text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.logo_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logo library read" ON public.logo_library;
CREATE POLICY "logo library read" ON public.logo_library
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "logo library admin insert" ON public.logo_library;
CREATE POLICY "logo library admin insert" ON public.logo_library
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "logo library owner update" ON public.logo_library;
CREATE POLICY "logo library owner update" ON public.logo_library
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin() OR (public.is_admin() AND created_by = auth.uid()))
  WITH CHECK (public.is_platform_admin() OR (public.is_admin() AND created_by = auth.uid()));

DROP POLICY IF EXISTS "logo library owner delete" ON public.logo_library;
CREATE POLICY "logo library owner delete" ON public.logo_library
  FOR DELETE TO authenticated
  USING (public.is_platform_admin() OR (public.is_admin() AND created_by = auth.uid()));

GRANT SELECT ON public.logo_library TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.logo_library TO authenticated;
