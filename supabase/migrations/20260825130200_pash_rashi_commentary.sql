-- Rashi commentary table for all 5 books of the Torah
CREATE TABLE IF NOT EXISTS public.rashi_commentary (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sefer_id integer NOT NULL,       -- 1=Bereishit, 2=Shemot, 3=Vayikra, 4=Bamidbar, 5=Devarim
  perek integer NOT NULL,
  pasuk integer NOT NULL,
  text text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT rashi_unique UNIQUE (sefer_id, perek, pasuk)
);

-- Index for fast lookups by verse
CREATE INDEX IF NOT EXISTS idx_rashi_sefer_perek_pasuk
  ON public.rashi_commentary (sefer_id, perek, pasuk);

-- RLS: allow public read and insert (Rashi is public-domain historical text)
ALTER TABLE public.rashi_commentary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read of rashi"
  ON public.rashi_commentary
  FOR SELECT
  USING (true);

-- Writes restricted to service_role (server-side upload scripts only)
CREATE POLICY "rashi_service_insert"
  ON public.rashi_commentary
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "rashi_service_delete"
  ON public.rashi_commentary
  FOR DELETE
  USING (auth.role() = 'service_role');

CREATE POLICY "rashi_service_update"
  ON public.rashi_commentary
  FOR UPDATE
  USING (auth.role() = 'service_role');
