-- =====================================================================
-- A screen can be pointed at another synagogue, from the remote.
--
-- Until now the answer to "which synagogue is this screen?" came only from
-- the admin who typed its pairing code, and the screen itself was never
-- asked - which is right for pairing and wrong for a hall where one display
-- serves several minyanim, or for a gabbai standing under the board with a
-- remote in his hand and no computer.
--
-- So the screen may now move itself. It proves who it is with the same
-- secret it uses for everything else, and the choice is written to its own
-- row rather than kept on the box. That is the whole point of putting it
-- here: a reinstall wipes the box - deliberately, since cloud backup was
-- turned off after one restored a stale identity - and the choice has to
-- outlive that. It is also then visible in the control centre, so nobody
-- has to wonder why a screen is showing what it is showing.
--
-- What a screen may NOT do is pair itself, take a community that is not
-- there, or touch another screen's row. It may only move itself, and only
-- between synagogues that exist.
--
-- Idempotent.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.tv_set_community(
  p_device_id uuid,
  p_secret text,
  p_community_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  d public.tv_devices;
  c public.communities;
BEGIN
  -- Raises for a wrong secret, as every writing device function does.
  d := public.tv_authenticate(p_device_id, p_secret);

  -- A screen that has not been paired yet has nothing to move. Pairing is
  -- still the admin's act, and this must not become a way around it.
  IF d.community_id IS NULL THEN
    RAISE EXCEPTION 'screen is not paired' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO c FROM public.communities WHERE id = p_community_id;
  IF c.id IS NULL THEN
    RAISE EXCEPTION 'no such synagogue' USING ERRCODE = '22023';
  END IF;

  UPDATE public.tv_devices
     SET community_id = c.id
   WHERE id = p_device_id
   RETURNING * INTO d;

  -- Said out loud in the screen's own log, because a board that changes what
  -- it shows should never be a mystery to whoever reads the reports later.
  --
  -- occurred_at is spelled out: it is when the thing happened, normally sent
  -- by the screen, and the column takes no default. Leaving it out made the
  -- insert fail on NOT NULL and took the whole move down with it - which is
  -- at least the right way round, since the transaction meant no screen was
  -- left moved with nothing in its log to say so.
  INSERT INTO public.tv_events (device_id, occurred_at, level, kind, message, details)
  VALUES (p_device_id, now(), 'info', 'command',
          'המסך הועבר לבית הכנסת: ' || c.name,
          jsonb_build_object('community_id', c.id, 'slug', c.slug));

  RETURN jsonb_build_object('id', c.id, 'slug', c.slug, 'name', c.name);
END;
$$;

REVOKE ALL ON FUNCTION public.tv_set_community(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tv_set_community(uuid, text, uuid) TO anon, authenticated;
