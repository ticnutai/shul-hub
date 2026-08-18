-- First-time Lovable / Supabase setup for shul-hub
-- Target project_id: bfiayuuhjtyccqobsjvl
-- Safe to rerun on a new or partially initialized project.
-- Existing application rows are preserved; initial content is inserted only into empty tables.
-- Ordered sources:
--   1. 20260818081728_e33cb40f-381a-4ea3-9fd8-177477c7bc41.sql
--   2. 20260818081747_4018b375-faab-44af-98cb-662d73eb21b5.sql
--   3. 20260818082246_50727c58-2809-44e9-a563-b6431613d8cd.sql
--   4. 20260818133000_categories_notifications.sql

BEGIN;

DO $$
BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','gabbai','user');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- settings (singleton)
CREATE TABLE IF NOT EXISTS public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'בית הכנסת אושר של יהודי',
  subtitle text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT 'בני ברק',
  city text NOT NULL DEFAULT 'בני ברק',
  latitude double precision NOT NULL DEFAULT 32.0853,
  longitude double precision NOT NULL DEFAULT 34.8338,
  elevation integer NOT NULL DEFAULT 40,
  candle_offset_minutes integer NOT NULL DEFAULT 40,
  tzeit_offset_minutes integer NOT NULL DEFAULT 20,
  phone text NOT NULL DEFAULT '',
  theme text NOT NULL DEFAULT 'navy',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings public read" ON public.settings;
DROP POLICY IF EXISTS "settings admin write" ON public.settings;
CREATE POLICY "settings public read" ON public.settings FOR SELECT USING (true);
CREATE POLICY "settings admin write" ON public.settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP TRIGGER IF EXISTS settings_updated ON public.settings;
CREATE TRIGGER settings_updated BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- minyanim
CREATE TABLE IF NOT EXISTS public.minyanim (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prayer text NOT NULL DEFAULT 'shacharit',
  label text NOT NULL DEFAULT '',
  day_type text NOT NULL DEFAULT 'weekday',
  time_mode text NOT NULL DEFAULT 'fixed',
  fixed_time time,
  relative_to text,
  offset_minutes integer NOT NULL DEFAULT 0,
  room text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.minyanim TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.minyanim TO authenticated;
GRANT ALL ON public.minyanim TO service_role;
ALTER TABLE public.minyanim ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "minyanim public read" ON public.minyanim;
DROP POLICY IF EXISTS "minyanim admin write" ON public.minyanim;
CREATE POLICY "minyanim public read" ON public.minyanim FOR SELECT USING (true);
CREATE POLICY "minyanim admin write" ON public.minyanim FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP TRIGGER IF EXISTS minyanim_updated ON public.minyanim;
CREATE TRIGGER minyanim_updated BEFORE UPDATE ON public.minyanim FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  pinned boolean NOT NULL DEFAULT false,
  expires_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.announcements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "announcements public read" ON public.announcements;
DROP POLICY IF EXISTS "announcements admin write" ON public.announcements;
CREATE POLICY "announcements public read" ON public.announcements FOR SELECT USING (expires_at IS NULL OR expires_at >= CURRENT_DATE);
CREATE POLICY "announcements admin write" ON public.announcements FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP TRIGGER IF EXISTS announcements_updated ON public.announcements;
CREATE TRIGGER announcements_updated BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- shiurim
CREATE TABLE IF NOT EXISTS public.shiurim (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  teacher text NOT NULL DEFAULT '',
  day_of_week integer NOT NULL DEFAULT 0,
  time_text text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shiurim TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shiurim TO authenticated;
GRANT ALL ON public.shiurim TO service_role;
ALTER TABLE public.shiurim ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shiurim public read" ON public.shiurim;
DROP POLICY IF EXISTS "shiurim admin write" ON public.shiurim;
CREATE POLICY "shiurim public read" ON public.shiurim FOR SELECT USING (true);
CREATE POLICY "shiurim admin write" ON public.shiurim FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP TRIGGER IF EXISTS shiurim_updated ON public.shiurim;
CREATE TRIGGER shiurim_updated BEFORE UPDATE ON public.shiurim FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- chavrutot
CREATE TABLE IF NOT EXISTS public.chavrutot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  partners text NOT NULL DEFAULT '',
  time_text text NOT NULL DEFAULT '',
  contact text NOT NULL DEFAULT '',
  looking_for_partner boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.chavrutot TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chavrutot TO authenticated;
GRANT ALL ON public.chavrutot TO service_role;
ALTER TABLE public.chavrutot ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chavrutot public read" ON public.chavrutot;
DROP POLICY IF EXISTS "chavrutot admin write" ON public.chavrutot;
CREATE POLICY "chavrutot public read" ON public.chavrutot FOR SELECT USING (true);
CREATE POLICY "chavrutot admin write" ON public.chavrutot FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP TRIGGER IF EXISTS chavrutot_updated ON public.chavrutot;
CREATE TRIGGER chavrutot_updated BEFORE UPDATE ON public.chavrutot FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- admin messages
CREATE TABLE IF NOT EXISTS public.admin_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  body text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.admin_messages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_messages TO authenticated;
GRANT ALL ON public.admin_messages TO service_role;
ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone can send" ON public.admin_messages;
DROP POLICY IF EXISTS "admin reads messages" ON public.admin_messages;
DROP POLICY IF EXISTS "admin updates messages" ON public.admin_messages;
DROP POLICY IF EXISTS "admin deletes messages" ON public.admin_messages;
CREATE POLICY "anyone can send" ON public.admin_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "admin reads messages" ON public.admin_messages FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin updates messages" ON public.admin_messages FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin deletes messages" ON public.admin_messages FOR DELETE TO authenticated USING (public.is_admin());

-- Initial content. Remove this section before running if a blank database is preferred.
INSERT INTO public.settings (name, subtitle, address, city, phone, theme)
SELECT 'בית הכנסת אושר של יהודי', 'קהילה, תורה ותפילה', 'מצדה 9, בסר 3, קומה 34, בני ברק', 'בני ברק', '', 'navy'
WHERE NOT EXISTS (SELECT 1 FROM public.settings);

INSERT INTO public.minyanim (prayer, label, day_type, time_mode, fixed_time, relative_to, offset_minutes, room, sort_order)
SELECT seed.prayer, seed.label, seed.day_type, seed.time_mode, seed.fixed_time::time,
       seed.relative_to, seed.offset_minutes, seed.room, seed.sort_order
FROM (VALUES
('shacharit','שחרית א׳ (ותיקין)','weekday','relative',NULL,'sunrise',-15,'אולם מרכזי',1),
('shacharit','שחרית ב׳','weekday','fixed','06:45',NULL,0,'אולם מרכזי',2),
('shacharit','שחרית ג׳','weekday','fixed','08:00',NULL,0,'בית מדרש',3),
('mincha','מנחה גדולה','weekday','fixed','13:30',NULL,0,'בית מדרש',4),
('mincha','מנחה קטנה','weekday','relative',NULL,'sunset',-20,'אולם מרכזי',5),
('arvit','ערבית א׳','weekday','relative',NULL,'tzeit',0,'אולם מרכזי',6),
('arvit','ערבית ב׳','weekday','fixed','21:00',NULL,0,'בית מדרש',7),
('mincha','מנחה ערב שבת','friday','relative',NULL,'candle',-5,'אולם מרכזי',1),
('arvit','ערבית ליל שבת','friday','relative',NULL,'sunset',15,'אולם מרכזי',2),
('shacharit','שחרית שבת','shabbat','fixed','08:15',NULL,0,'אולם מרכזי',1),
('mincha','מנחה שבת','shabbat','relative',NULL,'sunset',-60,'אולם מרכזי',2),
('arvit','ערבית מוצ״ש','shabbat','relative',NULL,'tzeit',5,'אולם מרכזי',3)
) AS seed(prayer, label, day_type, time_mode, fixed_time, relative_to, offset_minutes, room, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.minyanim);

INSERT INTO public.announcements (kind, title, body, pinned)
SELECT seed.* FROM (VALUES
('mazal_tov','מזל טוב למשפחת כהן','להולדת הבן! הקידוש יתקיים בשבת לאחר התפילה באולם המרכזי.',true),
('general','שיעור מיוחד לכבוד ראש חודש','ביום שלישי בשעה 20:30 שיעור מפי הרב, בהשתתפות הציבור.',false)
) AS seed(kind, title, body, pinned)
WHERE NOT EXISTS (SELECT 1 FROM public.announcements);

INSERT INTO public.shiurim (title, teacher, day_of_week, time_text, location, description, sort_order)
SELECT seed.* FROM (VALUES
('דף יומי','הרב שלמה לוי',0,'05:45','בית מדרש','לפני שחרית ותיקין',1),
('הלכות שבת','הרב יצחק ברוך',4,'20:30','אולם מרכזי','שיעור שבועי לכלל הציבור',2),
('פרשת השבוע','הרב מנחם דוד',6,'16:30','בית מדרש','בין מנחה לערבית',3)
) AS seed(title, teacher, day_of_week, time_text, location, description, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.shiurim);

INSERT INTO public.chavrutot (topic, partners, time_text, contact, looking_for_partner, sort_order)
SELECT seed.* FROM (VALUES
('גמרא מסכת ברכות','דוד ואבי','ימים א-ה, 20:00','',false,1),
('משנה ברורה','מחפשים חברותא','בוקר אחרי שחרית','052-0000000',true,2)
) AS seed(topic, partners, time_text, contact, looking_for_partner, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.chavrutot);

-- Function permission hardening.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- The first authenticated user who calls this function becomes the initial admin.
CREATE OR REPLACE FUNCTION public.claim_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN false;
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin' AND user_id = uid);
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_admin() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_admin() TO authenticated, service_role;

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
CREATE POLICY "admins read migration logs" ON public.migration_logs FOR SELECT TO authenticated USING (public.is_admin());
GRANT SELECT ON public.migration_logs TO authenticated;

CREATE OR REPLACE FUNCTION public.execute_admin_migration(p_name text, p_statements text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_statement text;
  v_count integer := coalesce(array_length(p_statements, 1), 0);
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF coalesce(btrim(p_name), '') = '' OR v_count = 0 THEN RAISE EXCEPTION 'Migration name and statements are required'; END IF;
  FOREACH v_statement IN ARRAY p_statements LOOP
    IF coalesce(btrim(v_statement), '') = '' THEN CONTINUE; END IF;
    IF v_statement ~* '^\s*(BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION|ALTER\s+SYSTEM|DROP\s+DATABASE|DROP\s+ROLE|CREATE\s+ROLE|COPY\s+.+PROGRAM)' THEN
      RAISE EXCEPTION 'Blocked migration statement';
    END IF;
    EXECUTE v_statement;
  END LOOP;
  INSERT INTO public.migration_logs (name, statements_count, executed_by, success) VALUES (p_name, v_count, v_uid, true);
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
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT ml.id, ml.name, ml.statements_count, ml.executed_at, ml.success, ml.error
  FROM public.migration_logs ml WHERE public.is_admin()
  ORDER BY ml.executed_at DESC LIMIT 200
$$;
REVOKE ALL ON FUNCTION public.get_migration_history() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_migration_history() TO authenticated;

COMMIT;
