-- Lesson categories and configurable notification preferences.
CREATE TABLE IF NOT EXISTS public.shiur_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shiurim ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.shiur_categories(id) ON DELETE SET NULL;
ALTER TABLE public.shiurim ADD COLUMN IF NOT EXISTS notification_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.shiurim ADD COLUMN IF NOT EXISTS reminder_minutes integer NOT NULL DEFAULT 15 CHECK (reminder_minutes BETWEEN 0 AND 10080);
ALTER TABLE public.minyanim ADD COLUMN IF NOT EXISTS notification_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.minyanim ADD COLUMN IF NOT EXISTS reminder_minutes integer NOT NULL DEFAULT 15 CHECK (reminder_minutes BETWEEN 0 AND 10080);
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS notification_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.chavrutot ADD COLUMN IF NOT EXISTS notification_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  browser_enabled boolean NOT NULL DEFAULT false,
  minyanim_enabled boolean NOT NULL DEFAULT true,
  shiurim_enabled boolean NOT NULL DEFAULT true,
  announcements_enabled boolean NOT NULL DEFAULT true,
  chavrutot_enabled boolean NOT NULL DEFAULT false,
  selected_minyan_ids uuid[] NOT NULL DEFAULT '{}',
  selected_shiur_ids uuid[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.shiur_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shiur_categories TO authenticated;
GRANT ALL ON public.shiur_categories TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.shiur_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shiur categories public read" ON public.shiur_categories;
DROP POLICY IF EXISTS "shiur categories admin write" ON public.shiur_categories;
CREATE POLICY "shiur categories public read" ON public.shiur_categories FOR SELECT USING (true);
CREATE POLICY "shiur categories admin write" ON public.shiur_categories FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "users manage notification preferences" ON public.notification_preferences;
CREATE POLICY "users manage notification preferences" ON public.notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS shiur_categories_updated ON public.shiur_categories;
CREATE TRIGGER shiur_categories_updated BEFORE UPDATE ON public.shiur_categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS notification_preferences_updated ON public.notification_preferences;
CREATE TRIGGER notification_preferences_updated BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS shiurim_category_sort_idx ON public.shiurim(category_id, sort_order);

-- Permanent, audited migration runner for application administrators.
CREATE TABLE IF NOT EXISTS public.migration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  statements_count integer NOT NULL DEFAULT 0,
  executed_at timestamptz NOT NULL DEFAULT now(),
  executed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  success boolean NOT NULL DEFAULT false,
  error text
);

ALTER TABLE public.migration_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.migration_logs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.migration_logs TO service_role;

DROP POLICY IF EXISTS "admins read migration logs" ON public.migration_logs;
CREATE POLICY "admins read migration logs" ON public.migration_logs FOR SELECT TO authenticated
  USING (public.is_admin());
GRANT SELECT ON public.migration_logs TO authenticated;

CREATE OR REPLACE FUNCTION public.execute_admin_migration(
  p_name text,
  p_statements text[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_statement text;
  v_count integer := coalesce(array_length(p_statements, 1), 0);
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF coalesce(btrim(p_name), '') = '' OR v_count = 0 THEN
    RAISE EXCEPTION 'Migration name and statements are required';
  END IF;

  FOREACH v_statement IN ARRAY p_statements LOOP
    IF coalesce(btrim(v_statement), '') = '' THEN CONTINUE; END IF;
    IF v_statement ~* '^\s*(BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION|ALTER\s+SYSTEM|DROP\s+DATABASE|DROP\s+ROLE|CREATE\s+ROLE|COPY\s+.+PROGRAM)' THEN
      RAISE EXCEPTION 'Blocked migration statement';
    END IF;
    EXECUTE v_statement;
  END LOOP;

  INSERT INTO public.migration_logs (name, statements_count, executed_by, success)
  VALUES (p_name, v_count, v_uid, true);
  RETURN jsonb_build_object('success', true, 'name', p_name, 'statements_count', v_count);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.migration_logs (name, statements_count, executed_by, success, error)
  VALUES (coalesce(nullif(btrim(p_name), ''), 'unnamed'), v_count, v_uid, false, SQLERRM);
  RETURN jsonb_build_object('success', false, 'name', p_name, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.execute_admin_migration(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_admin_migration(text, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_migration_history()
RETURNS TABLE (id uuid, name text, statements_count integer, executed_at timestamptz, success boolean, error text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT ml.id, ml.name, ml.statements_count, ml.executed_at, ml.success, ml.error
  FROM public.migration_logs ml
  WHERE public.is_admin()
  ORDER BY ml.executed_at DESC
  LIMIT 200
$$;

REVOKE ALL ON FUNCTION public.get_migration_history() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_migration_history() TO authenticated;
