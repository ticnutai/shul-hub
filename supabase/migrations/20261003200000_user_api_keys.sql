-- The gabbai's own Claude API key, kept with his account.
--
-- "עוזר חכם" reads a photo, a dictated sentence or a pasted message with
-- Claude. The key for that lived in one browser (localStorage): typed again
-- on every phone and computer, and gone with the browser's data. It is kept
-- here now, with the account: entered once under "מפתח API", there on every
-- device the gabbai signs in on, replaced or deleted there.
--
-- Each account reads and changes its own key only - not another gabbai's, not
-- a platform admin's through the app (the database itself, like any row, is
-- open to whoever runs the project). Only an admin may keep one: it is for
-- the admin's assistant.
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.user_api_keys (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'anthropic' CHECK (provider IN ('anthropic')),
  api_key text NOT NULL CHECK (char_length(api_key) BETWEEN 20 AND 300 AND api_key !~ '\s'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);

ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own api key read" ON public.user_api_keys;
CREATE POLICY "own api key read" ON public.user_api_keys
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "own api key insert" ON public.user_api_keys;
CREATE POLICY "own api key insert" ON public.user_api_keys
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_admin());

DROP POLICY IF EXISTS "own api key update" ON public.user_api_keys;
CREATE POLICY "own api key update" ON public.user_api_keys
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.is_admin());

DROP POLICY IF EXISTS "own api key delete" ON public.user_api_keys;
CREATE POLICY "own api key delete" ON public.user_api_keys
  FOR DELETE TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON public.user_api_keys FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_api_keys TO authenticated;
