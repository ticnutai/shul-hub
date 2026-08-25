CREATE TABLE IF NOT EXISTS public.siddur_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  theme jsonb NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.siddur_themes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Siddur themes are readable by everyone" ON public.siddur_themes;
CREATE POLICY "Siddur themes are readable by everyone"
  ON public.siddur_themes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can create Siddur themes" ON public.siddur_themes;
CREATE POLICY "Admins can create Siddur themes"
  ON public.siddur_themes FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid());

DROP POLICY IF EXISTS "Admins can update Siddur themes" ON public.siddur_themes;
CREATE POLICY "Admins can update Siddur themes"
  ON public.siddur_themes FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete Siddur themes" ON public.siddur_themes;
CREATE POLICY "Admins can delete Siddur themes"
  ON public.siddur_themes FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_siddur_theme_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_siddur_theme_updated_at ON public.siddur_themes;
CREATE TRIGGER set_siddur_theme_updated_at
BEFORE UPDATE ON public.siddur_themes
FOR EACH ROW EXECUTE FUNCTION public.set_siddur_theme_updated_at();
