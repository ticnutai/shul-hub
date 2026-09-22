-- Being the administrator of more than one synagogue.
--
-- Everything so far has been about a *screen* knowing which synagogue it
-- belongs to. This is the other side: a person, at a desk, who looks after
-- several, and has to be able to say which one they are editing - and to see
-- at a glance which one that is, because an edit that lands in the wrong
-- synagogue is not an error anybody notices. It simply appears on somebody
-- else's wall.

-- ---------------------------------------------------- one that is not live --
-- my_communities() listed only synagogues with active = true, so a synagogue
-- being prepared could not be selected at all - and preparing it before it
-- opens is the whole reason "switched off" exists. Between creating a
-- synagogue and opening it there was no way to put anything into it, which is
-- exactly backwards: check it on a real screen first, then open it.
--
-- It now returns whether each one is live, so the picker can say so rather
-- than hide it. Nothing here grants access: is_admin_of() still decides.
DROP FUNCTION IF EXISTS public.my_communities();

CREATE FUNCTION public.my_communities()
RETURNS TABLE (id uuid, slug text, name text, active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT c.id, c.slug, c.name, c.active
  FROM public.communities c
  WHERE public.is_admin_of(c.id)
  ORDER BY c.active DESC, c.name;
$$;

-- ------------------------------------------------------------ the overview --
-- What somebody running several of these needs on one page: which synagogues
-- exist, which are live, and how much is actually in each - because "switched
-- on with nothing in it" is the state that puts an empty board on a wall, and
-- it stays invisible until somebody walks into that shul.
--
-- The counts come from here rather than from a dozen queries in the browser:
-- one answer, and one place where "how many screens does it have" is defined.
DROP FUNCTION IF EXISTS public.communities_overview();

CREATE FUNCTION public.communities_overview()
RETURNS TABLE (
  id uuid,
  slug text,
  name text,
  active boolean,
  screens integer,
  minyanim integer,
  announcements integer,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT
    c.id, c.slug, c.name, c.active,
    (SELECT count(*) FROM public.tv_devices d
       WHERE d.community_id = c.id AND d.approved)::integer,
    (SELECT count(*) FROM public.minyanim m
       WHERE m.community_id = c.id AND m.active)::integer,
    (SELECT count(*) FROM public.announcements a
       WHERE a.community_id = c.id)::integer,
    c.created_at
  FROM public.communities c
  WHERE public.is_admin_of(c.id)
  ORDER BY c.active DESC, c.name;
$$;

-- -------------------------------------------------- created switched off --
-- create_community() does not set `active`, and the column's default was
-- true, so a synagogue went live the instant it was named - before it had a
-- city, a minyan or a screen. The moment a second synagogue is live the
-- public site stops showing one synagogue and starts asking visitors which
-- one they want, so naming a synagogue was enough to change what every
-- visitor sees.
--
-- A new synagogue is now switched off. Opening it stays what it should be: a
-- separate, deliberate act, after somebody has looked at it.
ALTER TABLE public.communities ALTER COLUMN active SET DEFAULT false;

COMMENT ON COLUMN public.communities.active IS
  'Shown to the public. New synagogues start false: prepare first, open second.';

REVOKE ALL ON FUNCTION public.my_communities()       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.communities_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_communities()       TO authenticated;
GRANT EXECUTE ON FUNCTION public.communities_overview() TO authenticated;
