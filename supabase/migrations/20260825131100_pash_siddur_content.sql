CREATE TABLE IF NOT EXISTS public.siddur (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nusach text NOT NULL,
  category text NOT NULL,
  cat_name text NOT NULL,
  section_idx integer NOT NULL,
  title text NOT NULL,
  lines jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT siddur_unique UNIQUE (nusach, category, section_idx)
);

CREATE INDEX IF NOT EXISTS idx_siddur_lookup
  ON public.siddur (nusach, category, section_idx);

ALTER TABLE public.siddur ENABLE ROW LEVEL SECURITY;

-- Everyone may read the prayer corpus.  Only the migration administrator may
-- publish changes; the application never needs anonymous write access.
DROP POLICY IF EXISTS siddur_public_read ON public.siddur;
DROP POLICY IF EXISTS siddur_public_insert ON public.siddur;
DROP POLICY IF EXISTS siddur_public_update ON public.siddur;
DROP POLICY IF EXISTS siddur_public_delete ON public.siddur;
DROP POLICY IF EXISTS siddur_admin_insert ON public.siddur;
DROP POLICY IF EXISTS siddur_admin_update ON public.siddur;
DROP POLICY IF EXISTS siddur_admin_delete ON public.siddur;

CREATE POLICY siddur_public_read
  ON public.siddur FOR SELECT
  USING (true);

CREATE POLICY siddur_admin_insert
  ON public.siddur FOR INSERT TO authenticated
  WITH CHECK (lower(auth.jwt() ->> 'email') = 'jj1212t@gmail.com');

CREATE POLICY siddur_admin_update
  ON public.siddur FOR UPDATE TO authenticated
  USING (lower(auth.jwt() ->> 'email') = 'jj1212t@gmail.com')
  WITH CHECK (lower(auth.jwt() ->> 'email') = 'jj1212t@gmail.com');

CREATE POLICY siddur_admin_delete
  ON public.siddur FOR DELETE TO authenticated
  USING (lower(auth.jwt() ->> 'email') = 'jj1212t@gmail.com');

GRANT SELECT ON public.siddur TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.siddur TO authenticated;
