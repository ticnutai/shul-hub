-- =====================================================================
-- Two more synagogues, and the machinery to add the next one in a line.
--
-- Adding a synagogue must not be a checklist that someone can get wrong.
-- A synagogue without its settings row has no name, no address and no
-- coordinates, so its zmanim are somebody else's; one without a board row
-- opens an empty editor. Both are created here by a trigger, so they
-- cannot be forgotten - by me now or by the "add synagogue" button later.
--
-- The two new ones are created INACTIVE on purpose. sole_community()
-- counts only active ones, so the site and the screens that are deployed
-- right now - which do not yet know that synagogues exist - keep working
-- exactly as they did. They are switched on in the migration that follows
-- the client being able to handle them.
--
-- Idempotent.
-- =====================================================================

-- ------------------------------------- one person, several synagogues --
-- user_roles carried UNIQUE (user_id, role) from when there was one
-- synagogue, where it was exactly right: one admin row per person. With
-- several it is the wrong shape - it says a person may administer at most
-- one synagogue in the world, which is the opposite of what is being
-- built. The role is now unique per person PER SYNAGOGUE, and separately
-- a person may hold the platform-wide role once.
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_member_key
  ON public.user_roles (user_id, role, community_id) WHERE community_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_platform_key
  ON public.user_roles (user_id, role) WHERE community_id IS NULL;

-- --------------------------------------- a synagogue is never half-made --
CREATE OR REPLACE FUNCTION public.community_scaffold()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  -- Its profile: the name it was given, and the defaults of the table for
  -- everything an admin has to set anyway (address, coordinates, offsets).
  INSERT INTO public.settings (community_id, name)
  VALUES (NEW.id, NEW.name)
  ON CONFLICT (community_id) DO NOTHING;

  -- Its board, so the editor never opens on nothing.
  INSERT INTO public.tv_config (id, community_id, config)
  VALUES (NEW.id::text, NEW.id, '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_scaffold ON public.communities;
CREATE TRIGGER community_scaffold
  AFTER INSERT ON public.communities
  FOR EACH ROW EXECUTE FUNCTION public.community_scaffold();

-- ------------------------------------------------ adding one, by name --
/**
 * Creates a synagogue. Only somebody who already administers every
 * synagogue may add another, and the slug is derived here rather than
 * asked for, so two people cannot invent two spellings of the same one.
 */
CREATE OR REPLACE FUNCTION public.create_community(p_name text, p_slug text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  new_id uuid;
  base   text;
  try    text;
  n      int := 1;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin access required';
  END IF;
  IF coalesce(btrim(p_name), '') = '' THEN
    RAISE EXCEPTION 'צריך שם לבית הכנסת';
  END IF;

  -- A Hebrew name has no useful latin slug, so fall back to a readable
  -- one rather than mangling it into nothing.
  base := regexp_replace(lower(coalesce(p_slug, p_name)), '[^a-z0-9]+', '-', 'g');
  base := btrim(base, '-');
  IF length(base) < 3 THEN base := 'shul'; END IF;
  base := left(base, 34);

  try := base;
  WHILE EXISTS (SELECT 1 FROM public.communities WHERE slug = try) LOOP
    n := n + 1;
    try := base || '-' || n;
  END LOOP;

  INSERT INTO public.communities (slug, name) VALUES (try, btrim(p_name))
  RETURNING id INTO new_id;

  -- Whoever created it administers it, without a second step.
  INSERT INTO public.user_roles (user_id, role, community_id)
  VALUES (auth.uid(), 'admin', new_id)
  ON CONFLICT DO NOTHING;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_community(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_community(text, text) TO authenticated;

-- --------------------------------------------------- the owner of all --
-- One account administers every synagogue: the person who runs the system
-- and is setting the other two up. This is the grant the previous
-- migration deliberately refused to make on its own.
INSERT INTO public.user_roles (user_id, role, community_id)
SELECT u.id, 'admin', NULL
FROM auth.users u
WHERE u.email = 'ticnutai@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = u.id AND r.role = 'admin' AND r.community_id IS NULL
  );

-- ------------------------------------------------------- the two new --
-- Inactive until the client can tell synagogues apart. Creating them now
-- means their boards and settings exist and can be filled in beforehand.
INSERT INTO public.communities (slug, name, active)
SELECT 'torah-veahavata', 'תורה ואהבתה', false
WHERE NOT EXISTS (SELECT 1 FROM public.communities WHERE slug = 'torah-veahavata');

INSERT INTO public.communities (slug, name, active)
SELECT 'torah-vesimchata', 'תורה ושמחתה', false
WHERE NOT EXISTS (SELECT 1 FROM public.communities WHERE slug = 'torah-vesimchata');
