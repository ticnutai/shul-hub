-- TV control center hardening (2026-09-18, Claude) - from the code review of
-- 20260918160000_tv_control_center.sql. Only replaces two functions; no
-- table or data changes. CREATE OR REPLACE keeps the existing grants.
--
-- 1. tv_heartbeat renews an expired pairing code. Before, only tv_register
--    (at boot) did, so a TV left unpaired for more than 24 hours kept showing
--    a code that tv_claim refused until someone power-cycled it.
--
-- 2. tv_log from a screen that is not paired yet accepts only its boot line.
--    Anyone holding the public key can register a "screen"; before, it could
--    then push hundreds of error events per call, each shown to every admin
--    as a toast with attacker-written text.

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
  UPDATE public.tv_devices SET
    last_seen_at = now(),
    state = coalesce(p_state, '{}'::jsonb),
    pairing_code = CASE WHEN approved THEN NULL
                        WHEN pairing_code IS NULL OR pairing_expires_at < now() THEN public.tv_new_pairing_code()
                        ELSE pairing_code END,
    pairing_expires_at = CASE WHEN approved THEN NULL
                              WHEN pairing_code IS NULL OR pairing_expires_at < now() THEN now() + interval '24 hours'
                              ELSE pairing_expires_at END
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
  d public.tv_devices;
  e jsonb;
  n integer := 0;
  at timestamptz;
BEGIN
  d := public.tv_authenticate(p_device_id, p_secret);
  IF jsonb_typeof(p_events) <> 'array' THEN
    RETURN 0;
  END IF;

  FOR e IN SELECT value FROM jsonb_array_elements(p_events) LIMIT 200 LOOP
    -- Not paired yet: nobody vouches for this screen. Keep only its boot line
    -- (so the admin can see it came up), as info, and at most 5 per call.
    IF NOT d.approved AND (coalesce(e ->> 'kind', '') <> 'boot' OR n >= 5) THEN
      CONTINUE;
    END IF;
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
      CASE WHEN NOT d.approved THEN 'info'
           WHEN e ->> 'level' IN ('info', 'warn', 'error') THEN e ->> 'level' ELSE 'info' END,
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
