-- בית הכנסת אושר של יהודי: זמני תפילות זמן חורף, לפי המודעה.
-- מוסיף רק את מה שחסר (מנחה 12:30 ו-13:00, ערבית 17:30) ומסדר את האותיות של המנחות.
-- לא מוחק שום מניין. אפשר להריץ שוב בלי כפילות.
do $$
declare
  c uuid := 'c9a613bb-d253-4249-b91c-11dcc82fe649';
  cat uuid := (select category_id from public.minyanim where community_id = c and prayer = 'shacharit' and day_type = 'weekday' and category_id is not null limit 1);
begin
  insert into public.minyanim (community_id, prayer, day_type, time_mode, fixed_time, label, sort_order, category_id, active)
  select c, v.prayer, 'weekday', 'fixed', v.t::time, v.label, v.sort_order, cat, true
  from (values
    ('mincha', '12:30', 'מנחה א''', 42),
    ('mincha', '13:00', 'מנחה ב''', 45),
    ('arvit',  '17:30', 'ערבית 17:30', 125)
  ) as v(prayer, t, label, sort_order)
  where not exists (
    select 1 from public.minyanim m
    where m.community_id = c and m.prayer = v.prayer and m.day_type = 'weekday' and m.time_mode = 'fixed' and m.fixed_time = v.t::time
  );

  -- המנחות לפי הסדר: 12:30 א', 13:00 ב', 13:30 ג', 14:00 ד', 15:00 ה', 16:00 ו'.
  update public.minyanim m set label = v.label
  from (values ('13:30', 'מנחה ג'''), ('14:00', 'מנחה ד'''), ('15:00', 'מנחה ה'''), ('16:00', 'מנחה ו''')) as v(t, label)
  where m.community_id = c and m.prayer = 'mincha' and m.day_type = 'weekday' and m.time_mode = 'fixed' and m.fixed_time = v.t::time;

  -- ערבית 22:30 בשם שמבדיל אותה מ-17:30.
  update public.minyanim set label = 'ערבית 22:30'
  where community_id = c and prayer = 'arvit' and day_type = 'weekday' and time_mode = 'fixed' and fixed_time = '22:30'::time;
end $$;
