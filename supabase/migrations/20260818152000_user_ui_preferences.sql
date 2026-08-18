-- Project bfiayuuhjtyccqobsjvl: optional per-user UI preference synchronization.
CREATE TABLE IF NOT EXISTS public.user_ui_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  preferences_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_ui_preferences ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_ui_preferences TO authenticated;
GRANT ALL ON public.user_ui_preferences TO service_role;

DROP POLICY IF EXISTS "users read own ui preferences" ON public.user_ui_preferences;
CREATE POLICY "users read own ui preferences"
ON public.user_ui_preferences FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users insert own ui preferences" ON public.user_ui_preferences;
CREATE POLICY "users insert own ui preferences"
ON public.user_ui_preferences FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users update own ui preferences" ON public.user_ui_preferences;
CREATE POLICY "users update own ui preferences"
ON public.user_ui_preferences FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users delete own ui preferences" ON public.user_ui_preferences;
CREATE POLICY "users delete own ui preferences"
ON public.user_ui_preferences FOR DELETE TO authenticated
USING (auth.uid() = user_id);
