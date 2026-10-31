-- שיעור "בימי חול": כל יום חוץ משבת - בנוסף ל"בכל יום" ו"יום קבוע בשבוע". רק מאפשר את הערך; אפשר להריץ שוב.
-- כל הגבלה קודמת על התדירות יורדת (גם אם נקראה בשם אחר), ובמקומה אחת שמכירה את שלושת הערכים.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.shiurim'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%schedule_type%'
  loop
    execute format('alter table public.shiurim drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.shiurim add constraint shiurim_schedule_type_check check (schedule_type in ('weekly', 'daily', 'weekdays'));
