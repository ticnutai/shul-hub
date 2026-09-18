-- =====================================================================
-- TV control center: devices, logs, remote commands, shared board config.
--
-- Model (mirrors how digital-signage systems work):
--   * A TV identifies itself with a random secret it generates on first boot.
--     Only a SHA-256 of it is stored. The TV has no user account, so every
--     write it makes goes through a SECURITY DEFINER function that checks the
--     secret - nothing is writable by the anon key directly.
--   * A new TV shows a 6-digit pairing code; an admin types it in the site to
--     approve the device. Until then the TV still shows the board.
--   * Disconnections are detected on the SERVER side by missed heartbeats
--     (a TV that is offline cannot report that it is offline). When it comes
--     back it uploads the events it buffered, including why it was cut off.
--   * Commands go through a table only admins can insert into; the TV
--     listens via realtime. A broadcast channel would be open to anyone who
--     holds the public key.
--
-- Idempotent. Uses the built-in sha256(), so no extension is required.
-- =====================================================================

-- ------------------------------------------------------------- devices --
CREATE TABLE IF NOT EXISTS public.tv_devices (
  id                 uuid PRIMARY KEY,
  name               text NOT NULL DEFAULT 'מסך חדש',
  secret_hash        text NOT NULL,
  approved           boolean NOT NULL DEFAULT false,
  approved_at        timestamptz,
  pairing_code       text,
  pairing_expires_at timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  last_seen_at       timestamptz,
  last_boot_at       timestamptz,
  app_version        text,
  info               jsonb NOT NULL DEFAULT '{}'::jsonb,
  state              jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS tv_devices_pairing_code_key
  ON public.tv_devices (pairing_code) WHERE pairing_code IS NOT NULL;

-- --------------------------------------------------------------- events --
CREATE TABLE IF NOT EXISTS public.tv_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_id   uuid NOT NULL REFERENCES public.tv_devices(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  level       text NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error')),
  kind        text NOT NULL,
  message     text NOT NULL DEFAULT '',
  details     jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS tv_events_device_time_idx ON public.tv_events (device_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS tv_events_time_idx ON public.tv_events (occurred_at DESC);

-- --------------------------------------------------------------- config --
CREATE TABLE IF NOT EXISTS public.tv_config (
  id         text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  config     jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
INSERT INTO public.tv_config (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------- commands --
CREATE TABLE IF NOT EXISTS public.tv_commands (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- NULL = every screen.
  device_id  uuid REFERENCES public.tv_devices(id) ON DELETE CASCADE,
  command    text NOT NULL CHECK (command IN
               ('pause', 'resume', 'next', 'prev', 'goto', 'reload', 'theme', 'snapshot', 'message', 'identify')),
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS tv_commands_time_idx ON public.tv_commands (created_at DESC);

-- ------------------------------------------------------------ snapshots --
-- Deliberately NOT on the realtime feed: an image is far larger than a
-- change event should carry. The admin polls the row after asking for one.
CREATE TABLE IF NOT EXISTS public.tv_snapshots (
  device_id   uuid PRIMARY KEY REFERENCES public.tv_devices(id) ON DELETE CASCADE,
  image       text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------- RLS --
ALTER TABLE public.tv_devices   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tv_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tv_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tv_commands  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tv_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tv_devices, public.tv_events, public.tv_config, public.tv_commands, public.tv_snapshots
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.tv_devices   TO authenticated;
GRANT SELECT, DELETE         ON public.tv_events    TO authenticated;
GRANT SELECT                 ON public.tv_config    TO anon, authenticated;
GRANT UPDATE                 ON public.tv_config    TO authenticated;
GRANT SELECT                 ON public.tv_commands  TO anon, authenticated;
GRANT INSERT                 ON public.tv_commands  TO authenticated;
GRANT SELECT, DELETE         ON public.tv_snapshots TO authenticated;
GRANT ALL ON public.tv_devices, public.tv_events, public.tv_config, public.tv_commands, public.tv_snapshots
  TO service_role;

DROP POLICY IF EXISTS "tv devices admin" ON public.tv_devices;
CREATE POLICY "tv devices admin" ON public.tv_devices FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "tv events admin read" ON public.tv_events;
CREATE POLICY "tv events admin read" ON public.tv_events FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "tv events admin delete" ON public.tv_events;
CREATE POLICY "tv events admin delete" ON public.tv_events FOR DELETE TO authenticated USING (public.is_admin());

-- The board's look is public anyway (it hangs on a wall); every TV reads it.
DROP POLICY IF EXISTS "tv config public read" ON public.tv_config;
CREATE POLICY "tv config public read" ON public.tv_config FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "tv config admin write" ON public.tv_config;
CREATE POLICY "tv config admin write" ON public.tv_config FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- TVs must read commands to act on them; only admins can issue them.
DROP POLICY IF EXISTS "tv commands read" ON public.tv_commands;
CREATE POLICY "tv commands read" ON public.tv_commands FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "tv commands admin insert" ON public.tv_commands;
CREATE POLICY "tv commands admin insert" ON public.tv_commands FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "tv snapshots admin" ON public.tv_snapshots;
CREATE POLICY "tv snapshots admin" ON public.tv_snapshots FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Keep the commands table small: a TV only acts on fresh commands.
CREATE OR REPLACE FUNCTION public.tv_commands_prune()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  DELETE FROM public.tv_commands WHERE created_at < now() - interval '2 days';
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tv_commands_prune ON public.tv_commands;
CREATE TRIGGER tv_commands_prune AFTER INSERT ON public.tv_commands
  FOR EACH STATEMENT EXECUTE FUNCTION public.tv_commands_prune();

-- ------------------------------------------------------ device RPCs --
-- Shared check: the device exists and presented its own secret.
CREATE OR REPLACE FUNCTION public.tv_authenticate(p_device_id uuid, p_secret text)
RETURNS public.tv_devices
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  d public.tv_devices;
BEGIN
  SELECT * INTO d FROM public.tv_devices WHERE id = p_device_id;
  IF d.id IS NULL THEN
    RAISE EXCEPTION 'unknown device' USING ERRCODE = 'P0002';
  END IF;
  IF d.secret_hash <> encode(sha256(convert_to(coalesce(p_secret, ''), 'UTF8')), 'hex') THEN
    RAISE EXCEPTION 'device secret mismatch' USING ERRCODE = '28000';
  END IF;
  RETURN d;
END;
$$;
REVOKE ALL ON FUNCTION public.tv_authenticate(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tv_new_pairing_code()
RETURNS text LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  code text;
BEGIN
  LOOP
    code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.tv_devices WHERE pairing_code = code);
  END LOOP;
  RETURN code;
END;
$$;
REVOKE ALL ON FUNCTION public.tv_new_pairing_code() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tv_register(p_device_id uuid, p_secret text, p_info jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  d public.tv_devices;
  pending int;
BEGIN
  IF p_device_id IS NULL OR length(coalesce(p_secret, '')) < 32 THEN
    RAISE EXCEPTION 'invalid device credentials';
  END IF;
  IF octet_length(coalesce(p_info, '{}'::jsonb)::text) > 4000 THEN
    p_info := '{}'::jsonb;
  END IF;

  SELECT * INTO d FROM public.tv_devices WHERE id = p_device_id;
  IF d.id IS NULL THEN
    -- Cap unpaired devices so the public key cannot flood the table.
    DELETE FROM public.tv_devices
      WHERE NOT approved AND coalesce(last_seen_at, created_at) < now() - interval '7 days';
    SELECT count(*) INTO pending FROM public.tv_devices WHERE NOT approved;
    IF pending >= 25 THEN
      RAISE EXCEPTION 'too many unpaired screens - pair or remove some in the admin site';
    END IF;
    INSERT INTO public.tv_devices (id, secret_hash, pairing_code, pairing_expires_at, info, app_version,
                                   last_seen_at, last_boot_at)
    VALUES (p_device_id, encode(sha256(convert_to(p_secret, 'UTF8')), 'hex'),
            public.tv_new_pairing_code(), now() + interval '24 hours',
            coalesce(p_info, '{}'::jsonb), left(p_info ->> 'version', 40), now(), now())
    RETURNING * INTO d;
  ELSE
    d := public.tv_authenticate(p_device_id, p_secret);
    UPDATE public.tv_devices SET
      info = coalesce(p_info, info),
      app_version = coalesce(left(p_info ->> 'version', 40), app_version),
      last_seen_at = now(),
      last_boot_at = now(),
      pairing_code = CASE WHEN approved THEN NULL
                          WHEN pairing_code IS NULL OR pairing_expires_at < now() THEN public.tv_new_pairing_code()
                          ELSE pairing_code END,
      pairing_expires_at = CASE WHEN approved THEN NULL
                                WHEN pairing_code IS NULL OR pairing_expires_at < now() THEN now() + interval '24 hours'
                                ELSE pairing_expires_at END
    WHERE id = p_device_id
    RETURNING * INTO d;
  END IF;

  RETURN jsonb_build_object('approved', d.approved, 'name', d.name, 'pairing_code', d.pairing_code);
END;
$$;

CREATE OR REPLACE FUNCTION public.tv_heartbeat(p_device_id uuid, p_secret text, p_state jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  d public.tv_devices;
BEGIN
  d := public.tv_authenticate(p_device_id, p_secret);
  IF octet_length(coalesce(p_state, '{}'::jsonb)::text) > 8000 THEN
    p_state := jsonb_build_object('error', 'state too large');
  END IF;
  UPDATE public.tv_devices
    SET last_seen_at = now(), state = coalesce(p_state, '{}'::jsonb)
    WHERE id = p_device_id
    RETURNING * INTO d;
  RETURN jsonb_build_object('approved', d.approved, 'name', d.name, 'pairing_code', d.pairing_code,
                            'server_time', now());
END;
$$;

CREATE OR REPLACE FUNCTION public.tv_log(p_device_id uuid, p_secret text, p_events jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  e jsonb;
  n integer := 0;
  at timestamptz;
BEGIN
  PERFORM public.tv_authenticate(p_device_id, p_secret);
  IF jsonb_typeof(p_events) <> 'array' THEN
    RETURN 0;
  END IF;

  FOR e IN SELECT value FROM jsonb_array_elements(p_events) LIMIT 200 LOOP
    BEGIN
      at := (e ->> 'at')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      at := now();
    END;
    -- A TV whose clock is wrong must not write events into the far past/future.
    IF at IS NULL OR at < now() - interval '30 days' OR at > now() + interval '1 day' THEN
      at := now();
    END IF;
    INSERT INTO public.tv_events (device_id, occurred_at, level, kind, message, details)
    VALUES (
      p_device_id,
      at,
      CASE WHEN e ->> 'level' IN ('info', 'warn', 'error') THEN e ->> 'level' ELSE 'info' END,
      left(coalesce(e ->> 'kind', 'event'), 40),
      left(coalesce(e ->> 'message', ''), 1000),
      CASE WHEN jsonb_typeof(e -> 'details') = 'object' AND octet_length((e -> 'details')::text) <= 4000
           THEN e -> 'details' ELSE '{}'::jsonb END
    );
    n := n + 1;
  END LOOP;

  DELETE FROM public.tv_events WHERE device_id = p_device_id AND occurred_at < now() - interval '90 days';
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.tv_put_snapshot(p_device_id uuid, p_secret text, p_image text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.tv_authenticate(p_device_id, p_secret);
  IF p_image IS NULL OR p_image NOT LIKE 'data:image/%' OR length(p_image) > 900000 THEN
    RAISE EXCEPTION 'invalid snapshot';
  END IF;
  INSERT INTO public.tv_snapshots (device_id, image, captured_at) VALUES (p_device_id, p_image, now())
  ON CONFLICT (device_id) DO UPDATE SET image = EXCLUDED.image, captured_at = EXCLUDED.captured_at;
END;
$$;

-- --------------------------------------------------------- admin RPC --
CREATE OR REPLACE FUNCTION public.tv_claim(p_code text, p_name text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  d public.tv_devices;
BEGIN
  IF NOT public.is_admin() THEN
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
    name = coalesce(nullif(btrim(p_name), ''), name),
    pairing_code = NULL, pairing_expires_at = NULL
  WHERE id = d.id
  RETURNING * INTO d;
  INSERT INTO public.tv_events (device_id, occurred_at, level, kind, message)
  VALUES (d.id, now(), 'info', 'paired', 'המסך צומד למערכת');
  RETURN jsonb_build_object('id', d.id, 'name', d.name);
END;
$$;

REVOKE ALL ON FUNCTION public.tv_register(uuid, text, jsonb)     FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tv_heartbeat(uuid, text, jsonb)    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tv_log(uuid, text, jsonb)          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tv_put_snapshot(uuid, text, text)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tv_claim(text, text)               FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tv_register(uuid, text, jsonb)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tv_heartbeat(uuid, text, jsonb)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tv_log(uuid, text, jsonb)         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tv_put_snapshot(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tv_claim(text, text)              TO authenticated;

-- ------------------------------------------------------------ realtime --
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tv_devices', 'tv_events', 'tv_config', 'tv_commands'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END;
$$;
ALTER TABLE public.tv_devices REPLICA IDENTITY FULL;
ALTER TABLE public.tv_config  REPLICA IDENTITY FULL;
