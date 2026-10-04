-- Saved versions of each synagogue's board design.
--
-- Every time a board's design is saved, the version it replaces is kept here,
-- by the database itself (a trigger), so nothing depends on the editor
-- remembering to do it. The editor lists them and can put one back as a draft;
-- putting it on the screens is then an ordinary "שמור ושדר".
--
-- The 40 newest are kept per synagogue. Only that synagogue's admins can read
-- them; nobody writes them directly.

CREATE TABLE IF NOT EXISTS public.tv_config_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  config       jsonb NOT NULL,
  saved_at     timestamptz NOT NULL,
  saved_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  replaced_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tv_config_versions_community_idx
  ON public.tv_config_versions (community_id, replaced_at DESC);

ALTER TABLE public.tv_config_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tv_config_versions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tv_config_versions TO authenticated;
GRANT ALL ON public.tv_config_versions TO service_role;

DROP POLICY IF EXISTS "tv config versions admin read" ON public.tv_config_versions;
CREATE POLICY "tv config versions admin read" ON public.tv_config_versions
  FOR SELECT TO authenticated USING (public.is_admin_of(community_id));

CREATE OR REPLACE FUNCTION public.keep_tv_config_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.config IS DISTINCT FROM NEW.config AND OLD.community_id IS NOT NULL THEN
    INSERT INTO public.tv_config_versions (community_id, config, saved_at, saved_by)
    VALUES (OLD.community_id, OLD.config, OLD.updated_at, OLD.updated_by);
    DELETE FROM public.tv_config_versions v
    WHERE v.community_id = OLD.community_id
      AND v.id NOT IN (
        SELECT id FROM public.tv_config_versions
        WHERE community_id = OLD.community_id
        ORDER BY replaced_at DESC
        LIMIT 40
      );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.keep_tv_config_version() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tv_config_keep_version ON public.tv_config;
CREATE TRIGGER tv_config_keep_version
  BEFORE UPDATE ON public.tv_config
  FOR EACH ROW EXECUTE FUNCTION public.keep_tv_config_version();
