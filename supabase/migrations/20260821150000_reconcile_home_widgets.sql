-- Reconcile Lovable-created home widget data with the authenticated migration runner.
-- This migration is intentionally idempotent because the original table may already
-- have been created by Lovable before the local runner recorded its execution.

CREATE TABLE IF NOT EXISTS public.home_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'section',
  sort_order integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.home_widgets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_widgets TO authenticated;
GRANT ALL ON public.home_widgets TO service_role;

ALTER TABLE public.home_widgets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'home_widgets'
      AND policyname = 'home widgets public read'
  ) THEN
    CREATE POLICY "home widgets public read"
      ON public.home_widgets FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'home_widgets'
      AND policyname = 'home widgets admin write'
  ) THEN
    CREATE POLICY "home widgets admin write"
      ON public.home_widgets FOR ALL TO authenticated
      USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.home_widgets'::regclass
      AND tgname = 'home_widgets_updated'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER home_widgets_updated
      BEFORE UPDATE ON public.home_widgets
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;

INSERT INTO public.home_widgets (key, label, kind, sort_order, visible) VALUES
  ('minyanim', 'זמני התפילות', 'section', 10, true),
  ('zmanim', 'זמני היום', 'section', 20, true),
  ('announcements', 'מודעות לציבור', 'section', 30, true),
  ('zman_alot', 'עלות השחר', 'zman', 100, true),
  ('zman_sunrise', 'נץ החמה', 'zman', 110, true),
  ('zman_sof_zman_shma', 'סוף זמן קריאת שמע', 'zman', 120, true),
  ('zman_sof_zman_tefila', 'סוף זמן תפילה', 'zman', 130, true),
  ('zman_chatzot', 'חצות היום', 'zman', 140, true),
  ('zman_plag', 'פלג המנחה', 'zman', 150, true),
  ('zman_candle', 'הדלקת נרות', 'zman', 160, true),
  ('zman_sunset', 'שקיעה', 'zman', 170, true),
  ('zman_tzeit', 'צאת הכוכבים', 'zman', 180, true)
ON CONFLICT (key) DO NOTHING;
