CREATE TYPE public.app_role AS ENUM ('admin','gabbai','user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
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
CREATE TABLE public.settings (
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
CREATE POLICY "settings public read" ON public.settings FOR SELECT USING (true);
CREATE POLICY "settings admin write" ON public.settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER settings_updated BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- minyanim
CREATE TABLE public.minyanim (
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
CREATE POLICY "minyanim public read" ON public.minyanim FOR SELECT USING (true);
CREATE POLICY "minyanim admin write" ON public.minyanim FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER minyanim_updated BEFORE UPDATE ON public.minyanim FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- announcements
CREATE TABLE public.announcements (
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
CREATE POLICY "announcements public read" ON public.announcements FOR SELECT USING (expires_at IS NULL OR expires_at >= CURRENT_DATE);
CREATE POLICY "announcements admin write" ON public.announcements FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER announcements_updated BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- shiurim
CREATE TABLE public.shiurim (
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
CREATE POLICY "shiurim public read" ON public.shiurim FOR SELECT USING (true);
CREATE POLICY "shiurim admin write" ON public.shiurim FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER shiurim_updated BEFORE UPDATE ON public.shiurim FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- chavrutot
CREATE TABLE public.chavrutot (
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
CREATE POLICY "chavrutot public read" ON public.chavrutot FOR SELECT USING (true);
CREATE POLICY "chavrutot admin write" ON public.chavrutot FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER chavrutot_updated BEFORE UPDATE ON public.chavrutot FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- admin messages
CREATE TABLE public.admin_messages (
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
CREATE POLICY "anyone can send" ON public.admin_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "admin reads messages" ON public.admin_messages FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin updates messages" ON public.admin_messages FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin deletes messages" ON public.admin_messages FOR DELETE TO authenticated USING (public.is_admin());

-- seed
INSERT INTO public.settings (name, subtitle, address, city, phone, theme)
VALUES ('בית הכנסת אושר של יהודי', 'קהילה, תורה ותפילה', 'רחוב רבי עקיבא, בני ברק', 'בני ברק', '', 'navy');

INSERT INTO public.minyanim (prayer, label, day_type, time_mode, fixed_time, relative_to, offset_minutes, room, sort_order) VALUES
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
('arvit','ערבית מוצ״ש','shabbat','relative',NULL,'tzeit',5,'אולם מרכזי',3);

INSERT INTO public.announcements (kind, title, body, pinned) VALUES
('mazal_tov','מזל טוב למשפחת כהן','להולדת הבן! הקידוש יתקיים בשבת לאחר התפילה באולם המרכזי.',true),
('general','שיעור מיוחד לכבוד ראש חודש','ביום שלישי בשעה 20:30 שיעור מפי הרב, בהשתתפות הציבור.',false);

INSERT INTO public.shiurim (title, teacher, day_of_week, time_text, location, description, sort_order) VALUES
('דף יומי','הרב שלמה לוי',0,'05:45','בית מדרש','לפני שחרית ותיקין',1),
('הלכות שבת','הרב יצחק ברוך',4,'20:30','אולם מרכזי','שיעור שבועי לכלל הציבור',2),
('פרשת השבוע','הרב מנחם דוד',6,'16:30','בית מדרש','בין מנחה לערבית',3);

INSERT INTO public.chavrutot (topic, partners, time_text, contact, looking_for_partner, sort_order) VALUES
('גמרא מסכת ברכות','דוד ואבי','ימים א-ה, 20:00','',false,1),
('משנה ברורה','מחפשים חברותא','בוקר אחרי שחרית','052-0000000',true,2);