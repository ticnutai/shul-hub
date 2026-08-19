DROP POLICY "public reads approved chavruta requests" ON public.chavruta_requests;
REVOKE SELECT ON public.chavruta_requests FROM anon;

CREATE OR REPLACE FUNCTION public.list_approved_chavruta_requests()
RETURNS TABLE(
  id uuid, name text, topic text, level text, intent text,
  study_format text, availability text, notes text,
  phone text, email text, created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.name, r.topic, r.level, r.intent, r.study_format,
         r.availability, r.notes,
         CASE WHEN r.share_contact THEN r.phone ELSE '' END,
         CASE WHEN r.share_contact THEN r.email ELSE '' END,
         r.created_at
  FROM public.chavruta_requests r
  WHERE r.status = 'approved'
  ORDER BY r.created_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.list_approved_chavruta_requests() TO anon, authenticated;