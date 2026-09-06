-- Optional Karovim logo header, plus the daily lesson published in the supplied flyer.
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS home_header_variant text NOT NULL DEFAULT 'standard';

ALTER TABLE public.settings
  DROP CONSTRAINT IF EXISTS settings_home_header_variant_check;

ALTER TABLE public.settings
  ADD CONSTRAINT settings_home_header_variant_check
  CHECK (home_header_variant IN ('standard', 'karovim_logo'));

INSERT INTO public.shiur_categories (name, description, sort_order, active)
VALUES ('העמוד היומי', 'שיעור העמוד היומי העולמי', 5, true)
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description, active = true;

UPDATE public.announcements
SET kind = 'general',
    body = E'שיעור העמוד היומי העולמי\nכל יום בשעה 16:15 (משך השיעור: חצי שעה)\nהמגיד שיעור: הרב יעקב טננבוים, הידוע בבהירות ובהסבר נפלאים.\nיוגש כיבוד לעמלי התורה.\nמחכה לכולם הרב אושרי.\nלכל נושא ביהדות: הרב אושרי 054-6473461',
    pinned = true,
    notification_enabled = true,
    show_on_home = true,
    sort_order = 5,
    style = '{"preset":"gold","background":"#fffaf0","foreground":"#172c57","accent":"#c89416","titleSize":28,"bodySize":18,"align":"center","radius":20,"shadow":true}'::jsonb
WHERE title = 'בשורה משמחת – שיעור העמוד היומי העולמי';

INSERT INTO public.announcements
  (kind, title, body, pinned, notification_enabled, show_on_home, sort_order, style)
SELECT
  'general',
  'בשורה משמחת – שיעור העמוד היומי העולמי',
  E'שיעור העמוד היומי העולמי\nכל יום בשעה 16:15 (משך השיעור: חצי שעה)\nהמגיד שיעור: הרב יעקב טננבוים, הידוע בבהירות ובהסבר נפלאים.\nיוגש כיבוד לעמלי התורה.\nמחכה לכולם הרב אושרי.\nלכל נושא ביהדות: הרב אושרי 054-6473461',
  true,
  true,
  true,
  5,
  '{"preset":"gold","background":"#fffaf0","foreground":"#172c57","accent":"#c89416","titleSize":28,"bodySize":18,"align":"center","radius":20,"shadow":true}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.announcements
  WHERE title = 'בשורה משמחת – שיעור העמוד היומי העולמי'
);

UPDATE public.shiurim
SET teacher = 'הרב יעקב טננבוים',
    day_of_week = 0,
    schedule_type = 'daily',
    time_text = '16:15 · חצי שעה',
    location = 'בית הכנסת ב.ס.ר 3, קומה 34',
    description = 'המגיד שיעור ידוע בבהירות ובהסבר נפלאים. יוגש כיבוד לעמלי התורה. מחכה לכולם הרב אושרי. לכל נושא ביהדות: הרב אושרי 054-6473461.',
    category_id = (SELECT id FROM public.shiur_categories WHERE name = 'העמוד היומי'),
    sort_order = 5,
    active = true,
    notification_enabled = true,
    reminder_minutes = 15
WHERE title = 'שיעור העמוד היומי העולמי';

INSERT INTO public.shiurim
  (title, teacher, day_of_week, schedule_type, time_text, location, description, category_id, sort_order, active, notification_enabled, reminder_minutes)
SELECT
  'שיעור העמוד היומי העולמי',
  'הרב יעקב טננבוים',
  0,
  'daily',
  '16:15 · חצי שעה',
  'בית הכנסת ב.ס.ר 3, קומה 34',
  'המגיד שיעור ידוע בבהירות ובהסבר נפלאים. יוגש כיבוד לעמלי התורה. מחכה לכולם הרב אושרי. לכל נושא ביהדות: הרב אושרי 054-6473461.',
  (SELECT id FROM public.shiur_categories WHERE name = 'העמוד היומי'),
  5,
  true,
  true,
  15
WHERE NOT EXISTS (
  SELECT 1 FROM public.shiurim
  WHERE title = 'שיעור העמוד היומי העולמי'
);
