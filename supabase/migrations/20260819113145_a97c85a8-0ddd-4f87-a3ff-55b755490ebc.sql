CREATE TABLE IF NOT EXISTS public.chavruta_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  topic text NOT NULL,
  level text NOT NULL DEFAULT 'beginner',
  intent text NOT NULL DEFAULT 'learn',
  study_format text NOT NULL DEFAULT 'chavruta',
  availability text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  share_contact boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chavruta_requests_level_check CHECK (level IN ('beginner','intermediate','advanced')),
  CONSTRAINT chavruta_requests_intent_check CHECK (intent IN ('learn','teach','both')),
  CONSTRAINT chavruta_requests_format_check CHECK (study_format IN ('chavruta','group')),
  CONSTRAINT chavruta_requests_status_check CHECK (status IN ('pending','approved','rejected')),
  CONSTRAINT chavruta_requests_contact_check CHECK (btrim(phone) <> '' OR btrim(email) <> '')
);

GRANT SELECT, INSERT ON public.chavruta_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chavruta_requests TO authenticated;
GRANT ALL ON public.chavruta_requests TO service_role;

ALTER TABLE public.chavruta_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can submit chavruta request" ON public.chavruta_requests;
CREATE POLICY "anyone can submit chavruta request"
  ON public.chavruta_requests FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pending');

DROP POLICY IF EXISTS "public reads approved chavruta requests" ON public.chavruta_requests;
CREATE POLICY "public reads approved chavruta requests"
  ON public.chavruta_requests FOR SELECT TO anon, authenticated
  USING (status = 'approved');

DROP POLICY IF EXISTS "admin reads all chavruta requests" ON public.chavruta_requests;
CREATE POLICY "admin reads all chavruta requests"
  ON public.chavruta_requests FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin updates chavruta requests" ON public.chavruta_requests;
CREATE POLICY "admin updates chavruta requests"
  ON public.chavruta_requests FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin deletes chavruta requests" ON public.chavruta_requests;
CREATE POLICY "admin deletes chavruta requests"
  ON public.chavruta_requests FOR DELETE TO authenticated
  USING (public.is_admin());

DROP TRIGGER IF EXISTS chavruta_requests_updated ON public.chavruta_requests;
CREATE TRIGGER chavruta_requests_updated
  BEFORE UPDATE ON public.chavruta_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
