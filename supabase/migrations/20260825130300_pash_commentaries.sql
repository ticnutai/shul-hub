-- Unified commentaries table for all mefarshim (Rashi, Ramban, Ibn Ezra, etc.)
-- Replaces the rashi-only approach with a single table indexed by commentator name.
CREATE TABLE IF NOT EXISTS public.commentaries (
  id           uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  commentator  text    NOT NULL,  -- e.g. 'Rashi', 'Ramban', 'Ibn_Ezra', 'Sforno', 'Or_HaChaim', 'Kli_Yakar', 'Chizkuni'
  sefer_id     integer NOT NULL,  -- 1=Bereishit, 2=Shemot, 3=Vayikra, 4=Bamidbar, 5=Devarim
  perek        integer NOT NULL,
  pasuk        integer NOT NULL,
  text         text    NOT NULL,
  created_at   timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT commentaries_unique UNIQUE (commentator, sefer_id, perek, pasuk)
);

-- Fast pasuk lookups
CREATE INDEX IF NOT EXISTS idx_commentaries_lookup
  ON public.commentaries (commentator, sefer_id, perek, pasuk);

-- Fast chapter lookups (common fetch pattern)
CREATE INDEX IF NOT EXISTS idx_commentaries_chapter
  ON public.commentaries (commentator, sefer_id, perek);

-- Row Level Security — public-domain historical texts, open read
ALTER TABLE public.commentaries ENABLE ROW LEVEL SECURITY;

-- Public read — anyone can SELECT (public-domain texts)
CREATE POLICY "commentaries_public_read"
  ON public.commentaries FOR SELECT USING (true);

-- Writes restricted to service_role (server-side upload scripts only)
CREATE POLICY "commentaries_service_insert"
  ON public.commentaries FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "commentaries_service_delete"
  ON public.commentaries FOR DELETE
  USING (auth.role() = 'service_role');

CREATE POLICY "commentaries_service_update"
  ON public.commentaries FOR UPDATE
  USING (auth.role() = 'service_role');
