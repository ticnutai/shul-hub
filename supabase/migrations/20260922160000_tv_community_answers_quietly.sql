-- =====================================================================
-- "Which synagogue is this screen?" has an answer for an unknown screen.
--
-- tv_community leaned on tv_authenticate, which raises for a device it has
-- never seen - right for a write, wrong for this. Every screen asks this
-- question on its first boot, before it has registered, and got back a 500
-- and a red line in the console for asking something perfectly reasonable.
--
-- An unknown or unpaired screen belongs to no synagogue. That is a NULL,
-- not a failure. It still proves itself: a screen that gives the wrong
-- secret is told nothing, exactly as before.
--
-- Idempotent.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.tv_community(p_device_id uuid, p_secret text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT d.community_id
  FROM public.tv_devices d
  WHERE d.id = p_device_id
    AND d.approved
    AND d.secret_hash = encode(sha256(convert_to(coalesce(p_secret, ''), 'UTF8')), 'hex');
$$;

REVOKE ALL ON FUNCTION public.tv_community(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tv_community(uuid, text) TO anon, authenticated;
