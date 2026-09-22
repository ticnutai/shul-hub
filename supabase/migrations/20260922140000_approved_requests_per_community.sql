-- =====================================================================
-- The public list of chavruta requests belongs to one synagogue.
--
-- This function reads chavruta_requests past RLS - that is its job: the
-- table itself is closed to the public, and this hands out only the
-- approved rows, with contact details blanked unless the person agreed to
-- share them. Which means it is also the one read on the site that a
-- policy cannot scope for us. It has to ask.
--
-- The argument defaults to the only synagogue there is, so the site that
-- is deployed right now keeps working until it is taught to pass one.
--
-- Idempotent.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.list_approved_chavruta_requests(
  p_community uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid, name text, topic text, level text, intent text,
  study_format text, availability text, notes text,
  phone text, email text, created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT r.id, r.name, r.topic, r.level, r.intent, r.study_format,
         r.availability, r.notes,
         CASE WHEN r.share_contact THEN r.phone ELSE '' END,
         CASE WHEN r.share_contact THEN r.email ELSE '' END,
         r.created_at
  FROM public.chavruta_requests r
  WHERE r.status = 'approved'
    AND r.community_id = coalesce(p_community, public.sole_community())
  ORDER BY r.created_at DESC
$$;

REVOKE ALL ON FUNCTION public.list_approved_chavruta_requests(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_approved_chavruta_requests(uuid) TO anon, authenticated;

-- The old no-argument form would now be ambiguous against the new one.
DROP FUNCTION IF EXISTS public.list_approved_chavruta_requests();
