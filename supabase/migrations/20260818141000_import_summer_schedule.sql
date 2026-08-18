-- Summer schedule imported from the supplied synagogue flyer.
ALTER TABLE public.shiurim
  ADD COLUMN IF NOT EXISTS schedule_type text NOT NULL DEFAULT 'weekly'
  CHECK (schedule_type IN ('weekly', 'daily'));

-- Reconcile the original sample weekday rows with the flyer.
UPDATE public.minyanim SET label = 'שחרית א׳', time_mode = 'fixed', fixed_time = '06:15', relative_to = NULL, offset_minutes = 0, sort_order = 10
WHERE day_type = 'weekday' AND prayer = 'shacharit' AND label = 'שחרית א׳ (ותיקין)';
UPDATE public.minyanim SET label = 'שחרית ב׳', fixed_time = '07:15', sort_order = 20
WHERE day_type = 'weekday' AND prayer = 'shacharit' AND label = 'שחרית ב׳';
UPDATE public.minyanim SET label = 'שחרית ג׳', fixed_time = '08:15', sort_order = 30
WHERE day_type = 'weekday' AND prayer = 'shacharit' AND label = 'שחרית ג׳';

INSERT INTO public.minyanim (prayer, label, day_type, time_mode, fixed_time, sort_order, active)
SELECT 'shacharit', 'שחרית ד׳', 'weekday', 'fixed', '09:00', 40, true
WHERE NOT EXISTS (SELECT 1 FROM public.minyanim WHERE day_type = 'weekday' AND prayer = 'shacharit' AND fixed_time = '09:00');

INSERT INTO public.minyanim (prayer, label, day_type, time_mode, fixed_time, sort_order, active)
SELECT 'shacharit', 'שחרית יום שישי', 'friday', 'fixed', '08:30', 10, true
WHERE NOT EXISTS (SELECT 1 FROM public.minyanim WHERE day_type = 'friday' AND prayer = 'shacharit' AND fixed_time = '08:30');

UPDATE public.minyanim SET label = 'מנחה 13:30', sort_order = 50
WHERE day_type = 'weekday' AND prayer = 'mincha' AND fixed_time = '13:30';
UPDATE public.minyanim SET label = 'מנחה 10 דקות לפני השקיעה', time_mode = 'relative', fixed_time = NULL, relative_to = 'sunset', offset_minutes = -10, sort_order = 110
WHERE day_type = 'weekday' AND prayer = 'mincha' AND label = 'מנחה קטנה';

INSERT INTO public.minyanim (prayer, label, day_type, time_mode, fixed_time, sort_order, active)
SELECT 'mincha', 'מנחה ' || seed.time_text, 'weekday', 'fixed', seed.time_text::time, seed.sort_order, true
FROM (VALUES ('14:00', 60), ('15:00', 70), ('16:00', 80), ('17:00', 90), ('18:00', 100)) AS seed(time_text, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.minyanim m WHERE m.day_type = 'weekday' AND m.prayer = 'mincha' AND m.fixed_time = seed.time_text::time);

UPDATE public.minyanim SET label = 'ערבית בשקיעה', time_mode = 'relative', fixed_time = NULL, relative_to = 'sunset', offset_minutes = 0, sort_order = 120
WHERE day_type = 'weekday' AND prayer = 'arvit' AND label = 'ערבית א׳';
UPDATE public.minyanim SET label = 'ערבית 22:30', time_mode = 'fixed', fixed_time = '22:30', relative_to = NULL, offset_minutes = 0, sort_order = 140
WHERE day_type = 'weekday' AND prayer = 'arvit' AND label = 'ערבית ב׳';

INSERT INTO public.minyanim (prayer, label, day_type, time_mode, relative_to, offset_minutes, sort_order, active)
SELECT 'arvit', 'ערבית 30 דקות אחרי השקיעה', 'weekday', 'relative', 'sunset', 30, 130, true
WHERE NOT EXISTS (SELECT 1 FROM public.minyanim WHERE day_type = 'weekday' AND prayer = 'arvit' AND relative_to = 'sunset' AND offset_minutes = 30);

INSERT INTO public.shiur_categories (name, description, sort_order, active)
VALUES ('דף יומי', 'שיעורי הדף היומי המתקיימים בכל יום', 10, true)
ON CONFLICT (name) DO UPDATE SET active = true, description = EXCLUDED.description;

UPDATE public.shiurim
SET title = 'דף יומי', teacher = '', day_of_week = 0, schedule_type = 'daily', time_text = '08:45',
    category_id = (SELECT id FROM public.shiur_categories WHERE name = 'דף יומי'), sort_order = 10, active = true
WHERE title = 'דף יומי' AND time_text = '05:45';

INSERT INTO public.shiurim (title, teacher, day_of_week, schedule_type, time_text, location, description, category_id, sort_order, active)
SELECT 'דף יומי', '', 0, 'daily', seed.time_text, '', 'שיעור יומי', c.id, seed.sort_order, true
FROM public.shiur_categories c
CROSS JOIN (VALUES ('08:45', 10), ('14:15', 20), ('15:15', 30)) AS seed(time_text, sort_order)
WHERE c.name = 'דף יומי'
AND NOT EXISTS (
  SELECT 1 FROM public.shiurim s
  WHERE s.category_id = c.id AND s.schedule_type = 'daily' AND s.time_text = seed.time_text
);
