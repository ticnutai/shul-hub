-- =====================================================================
-- Communities: one system, many synagogues.
--
-- Until now this was one synagogue's system by construction: tv_config is
-- a single row pinned by CHECK (id = 'default'), and every content table
-- holds rows that belong to nobody in particular. Two synagogues on this
-- database today would edit each other's board.
--
-- This adds the missing dimension. A synagogue is a ROW, not an install:
-- same code, same APK, same deploy for all of them.
--
-- Three rules this migration is built around:
--
--   1. Nothing breaks today. The site and the screens that are live right
--      now keep working while the client catches up: every new column
--      carries a default that is correct as long as there is exactly one
--      synagogue, and the existing data is moved into it.
--
--   2. When it becomes ambiguous, it FAILS - it does not guess. The moment
--      a second synagogue exists, sole_community() returns NULL and a write
--      that forgot to say which synagogue it means hits a NOT NULL error.
--      A loud error beats a row silently written to the wrong shul.
--
--   3. The boundary is here, not in the queries. An admin of one synagogue
--      cannot write to another's rows even with a hand-written request,
--      because the policy - not the client - decides.
--
-- Reading stays public, as it is today: prayer times on a wall are not a
-- secret. What is scoped is WRITING, and which rows a screen asks for.
--
-- Nobody gains power here: existing admins become admins of the first
-- synagogue only. Cross-synagogue (platform) admin is granted by hand,
-- deliberately, afterwards.
--
-- Idempotent.
-- =====================================================================

-- --------------------------------------------------------- the table --
CREATE TABLE IF NOT EXISTS public.communities (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Short, stable, URL-safe. Used for links and for telling them apart in
  -- logs; the display name can change without breaking either.
  slug       text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  name       text NOT NULL,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.communities TO anon, authenticated;
GRANT ALL    ON public.communities TO service_role;

-- ------------------------------------------- the first one is the one --
-- Seeded from the settings row that is already there, keeping its id, so
-- that "the synagogue" and "its settings" are the same identifier and the
-- move is traceable afterwards.
INSERT INTO public.communities (id, slug, name)
SELECT s.id, 'main', s.name
FROM public.settings s
WHERE NOT EXISTS (SELECT 1 FROM public.communities)
ORDER BY s.created_at
LIMIT 1;

-- A database with no settings row at all (a fresh clone) still needs one.
INSERT INTO public.communities (slug, name)
SELECT 'main', 'בית הכנסת'
WHERE NOT EXISTS (SELECT 1 FROM public.communities);

-- ------------------------------------------------- who belongs where --
-- NULL community_id = platform-wide: this person administers every
-- synagogue. Granted by hand, never by this migration.
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS community_id uuid REFERENCES public.communities(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS user_roles_community_idx ON public.user_roles (community_id, user_id);

-- Everyone who has a role today is given it in the first synagogue, and
-- only there. No existing account quietly becomes able to touch the others.
UPDATE public.user_roles
SET community_id = (SELECT id FROM public.communities ORDER BY created_at LIMIT 1)
WHERE community_id IS NULL;

-- --------------------------------------------------------- the rules --

/**
 * The only community there is - or NULL once that stops being true.
 *
 * This is what lets the site that is deployed right now keep inserting
 * rows without knowing that synagogues exist. It is deliberately NOT a
 * "pick a sensible one" function: the day a second synagogue is added it
 * returns NULL, every column that leans on it is NOT NULL, and a client
 * that has not been taught to say which synagogue it means gets an error
 * instead of writing into somebody else's board.
 *
 * Remove the DEFAULTs that use it once every writer passes community_id.
 */
CREATE OR REPLACE FUNCTION public.sole_community()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT CASE WHEN (SELECT count(*) FROM public.communities WHERE active) = 1
              THEN (SELECT id FROM public.communities WHERE active)
         END;
$$;

/** Administers every synagogue. Rare, and granted by hand. */
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin' AND community_id IS NULL
  );
$$;

/**
 * Administers THIS synagogue. Every write policy below asks this and
 * nothing else, so there is one place to read and one place to be wrong.
 */
CREATE OR REPLACE FUNCTION public.is_admin_of(_community uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT _community IS NOT NULL AND (
    public.is_platform_admin() OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin' AND community_id = _community
    )
  );
$$;

/** The synagogues this person may administer, for the picker in the admin. */
CREATE OR REPLACE FUNCTION public.my_communities()
RETURNS TABLE (id uuid, slug text, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT c.id, c.slug, c.name
  FROM public.communities c
  WHERE c.active AND public.is_admin_of(c.id)
  ORDER BY c.name;
$$;

REVOKE ALL ON FUNCTION public.sole_community()        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_platform_admin()     FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin_of(uuid)       FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_communities()        FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sole_community()     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin()  TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_of(uuid)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_communities()     TO authenticated;

DROP POLICY IF EXISTS "communities public read"         ON public.communities;
DROP POLICY IF EXISTS "communities platform admin write" ON public.communities;
CREATE POLICY "communities public read"
  ON public.communities FOR SELECT USING (true);
CREATE POLICY "communities platform admin write"
  ON public.communities FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- ------------------------------------------- the column, on each table --
-- Same three steps everywhere: add it, fill it in from the first
-- synagogue, then forbid it being empty. Done in one pass so that no table
-- is left half-converted if this is run twice.
DO $$
DECLARE
  t text;
  first_id uuid := (SELECT id FROM public.communities ORDER BY created_at LIMIT 1);
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'settings', 'minyan_categories', 'minyanim', 'announcements',
    'shiur_categories', 'shiurim', 'chavrutot', 'chavruta_requests',
    'admin_messages', 'home_widgets', 'app_themes'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS community_id uuid
         REFERENCES public.communities(id) ON DELETE CASCADE', t);
    EXECUTE format('UPDATE public.%I SET community_id = $1 WHERE community_id IS NULL', t)
      USING first_id;
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN community_id SET DEFAULT public.sole_community()', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN community_id SET NOT NULL', t);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (community_id)', t || '_community_idx', t);
  END LOOP;
END $$;

-- A synagogue has exactly one settings row - it is its profile.
CREATE UNIQUE INDEX IF NOT EXISTS settings_community_key ON public.settings (community_id);

-- ------------------------------------------------ the board's own row --
-- tv_config was pinned to a single row by construction. The pin comes off;
-- the synagogue becomes the key. The existing row keeps its 'default' id,
-- so a client that has not been updated yet still finds it.
ALTER TABLE public.tv_config DROP CONSTRAINT IF EXISTS tv_config_id_check;
ALTER TABLE public.tv_config ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public.tv_config
  ADD COLUMN IF NOT EXISTS community_id uuid REFERENCES public.communities(id) ON DELETE CASCADE;
UPDATE public.tv_config
SET community_id = (SELECT id FROM public.communities ORDER BY created_at LIMIT 1)
WHERE community_id IS NULL;
ALTER TABLE public.tv_config ALTER COLUMN community_id SET DEFAULT public.sole_community();
ALTER TABLE public.tv_config ALTER COLUMN community_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tv_config_community_key ON public.tv_config (community_id);

-- Every synagogue gets a board row, so the admin never opens an empty one.
INSERT INTO public.tv_config (id, community_id, config)
SELECT c.id::text, c.id, '{}'::jsonb
FROM public.communities c
WHERE NOT EXISTS (SELECT 1 FROM public.tv_config x WHERE x.community_id = c.id);

-- ---------------------------------------------------------- a screen --
-- Nullable on purpose: a screen out of the box belongs to nobody. It is
-- given its synagogue at the moment an admin types its pairing code, and
-- an unpaired screen has no board to show.
ALTER TABLE public.tv_devices
  ADD COLUMN IF NOT EXISTS community_id uuid REFERENCES public.communities(id) ON DELETE CASCADE;
UPDATE public.tv_devices
SET community_id = (SELECT id FROM public.communities ORDER BY created_at LIMIT 1)
WHERE community_id IS NULL AND approved;
CREATE INDEX IF NOT EXISTS tv_devices_community_idx ON public.tv_devices (community_id);

-- ------------------------------------------------- writing, per shul --
-- Reading stays open: what is on the wall is public either way, and an
-- anonymous reader has no identity to scope by - the client asks for the
-- synagogue it wants. Writing is what moves into the database's hands.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('settings',          'settings admin write'),
    ('minyan_categories', 'minyan categories admin write'),
    ('minyanim',          'minyanim admin write'),
    ('announcements',     'announcements admin write'),
    ('shiur_categories',  'shiur categories admin write'),
    ('shiurim',           'shiurim admin write'),
    ('chavrutot',         'chavrutot admin write'),
    ('home_widgets',      'home widgets admin write')
  ) AS v(tbl, pol) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.pol, r.tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING (public.is_admin_of(community_id))
         WITH CHECK (public.is_admin_of(community_id))', r.pol, r.tbl);
  END LOOP;
END $$;

-- app_themes: split into the four it was written as.
DROP POLICY IF EXISTS "Admins can create app themes" ON public.app_themes;
DROP POLICY IF EXISTS "Admins can update app themes" ON public.app_themes;
DROP POLICY IF EXISTS "Admins can delete app themes" ON public.app_themes;
CREATE POLICY "Admins can create app themes" ON public.app_themes
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_of(community_id));
CREATE POLICY "Admins can update app themes" ON public.app_themes
  FOR UPDATE TO authenticated
  USING (public.is_admin_of(community_id)) WITH CHECK (public.is_admin_of(community_id));
CREATE POLICY "Admins can delete app themes" ON public.app_themes
  FOR DELETE TO authenticated USING (public.is_admin_of(community_id));

-- chavruta_requests: the public may still submit one, to one synagogue.
DROP POLICY IF EXISTS "admin reads all chavruta requests"   ON public.chavruta_requests;
DROP POLICY IF EXISTS "admin updates chavruta requests"     ON public.chavruta_requests;
DROP POLICY IF EXISTS "admin deletes chavruta requests"     ON public.chavruta_requests;
CREATE POLICY "admin reads all chavruta requests" ON public.chavruta_requests
  FOR SELECT TO authenticated USING (public.is_admin_of(community_id));
CREATE POLICY "admin updates chavruta requests" ON public.chavruta_requests
  FOR UPDATE TO authenticated
  USING (public.is_admin_of(community_id)) WITH CHECK (public.is_admin_of(community_id));
CREATE POLICY "admin deletes chavruta requests" ON public.chavruta_requests
  FOR DELETE TO authenticated USING (public.is_admin_of(community_id));

-- admin_messages: written by the public, read by that synagogue's gabbai.
DROP POLICY IF EXISTS "admin reads messages"   ON public.admin_messages;
DROP POLICY IF EXISTS "admin updates messages" ON public.admin_messages;
DROP POLICY IF EXISTS "admin deletes messages" ON public.admin_messages;
CREATE POLICY "admin reads messages" ON public.admin_messages
  FOR SELECT TO authenticated USING (public.is_admin_of(community_id));
CREATE POLICY "admin updates messages" ON public.admin_messages
  FOR UPDATE TO authenticated
  USING (public.is_admin_of(community_id)) WITH CHECK (public.is_admin_of(community_id));
CREATE POLICY "admin deletes messages" ON public.admin_messages
  FOR DELETE TO authenticated USING (public.is_admin_of(community_id));

-- tv_config and tv_devices.
DROP POLICY IF EXISTS "tv config admin write" ON public.tv_config;
CREATE POLICY "tv config admin write" ON public.tv_config
  FOR UPDATE TO authenticated
  USING (public.is_admin_of(community_id)) WITH CHECK (public.is_admin_of(community_id));

DROP POLICY IF EXISTS "tv devices admin" ON public.tv_devices;
CREATE POLICY "tv devices admin" ON public.tv_devices
  FOR ALL TO authenticated
  USING (public.is_admin_of(community_id)) WITH CHECK (public.is_admin_of(community_id));

-- Roles: an admin hands out roles inside their own synagogue. Only a
-- platform admin can create another platform admin, which is the one power
-- that must not be reachable from inside a single synagogue.
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles"   ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles"   ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.is_admin_of(community_id) OR public.is_platform_admin());
CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_of(community_id));
CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.is_admin_of(community_id));

-- ------------------------------------------- pairing hands it over ----
-- The screen learns which synagogue it belongs to here, and only here:
-- from the admin who typed its code. Nothing about the network, the
-- address or the hardware takes part in that decision.
DROP FUNCTION IF EXISTS public.tv_claim(text, text);
CREATE OR REPLACE FUNCTION public.tv_claim(p_code text, p_name text, p_community uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  d public.tv_devices;
  target uuid := coalesce(p_community, public.sole_community());
BEGIN
  IF target IS NULL THEN
    RAISE EXCEPTION 'צריך לבחור לאיזה בית כנסת המסך שייך' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.is_admin_of(target) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO d FROM public.tv_devices
    WHERE pairing_code = regexp_replace(coalesce(p_code, ''), '\D', '', 'g')
      AND NOT approved AND pairing_expires_at > now();
  IF d.id IS NULL THEN
    RAISE EXCEPTION 'קוד הצימוד לא נמצא או שפג תוקפו' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.tv_devices SET
    approved = true, approved_at = now(),
    community_id = target,
    name = coalesce(nullif(btrim(p_name), ''), name),
    pairing_code = NULL, pairing_expires_at = NULL
  WHERE id = d.id
  RETURNING * INTO d;

  INSERT INTO public.tv_events (device_id, occurred_at, level, kind, message)
  VALUES (d.id, now(), 'info', 'paired', 'המסך צומד למערכת');
  RETURN jsonb_build_object('id', d.id, 'name', d.name, 'community_id', d.community_id);
END;
$$;

REVOKE ALL ON FUNCTION public.tv_claim(text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tv_claim(text, text, uuid) TO authenticated;

-- ------------------------------------------ the screen asks for its own --
/**
 * Which synagogue a screen belongs to, proved by the secret it holds.
 *
 * The screen cannot be trusted to name its own synagogue - anyone can post
 * a community id. It proves who it is the same way it does for every other
 * write, and the server answers with where it belongs.
 */
CREATE OR REPLACE FUNCTION public.tv_community(p_device_id uuid, p_secret text)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  d public.tv_devices;
BEGIN
  -- The one place that knows how a screen proves itself, asked again here
  -- rather than restated - two copies of that check would drift.
  d := public.tv_authenticate(p_device_id, p_secret);
  IF NOT d.approved THEN
    RETURN NULL;
  END IF;
  RETURN d.community_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tv_community(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tv_community(uuid, text) TO anon, authenticated;
