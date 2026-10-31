-- בית הכנסת אפי קפיטל: הכיתוב "לוגואים" מעל הלוגו נכתב בשחור קטן על הרקע הכחול הכהה ולא נראה בכלל (נמדד: 0% מהמסך משתנה בלעדיו).
-- נמחק מהלוח הרגיל בלבד; שאר החלקים כמו שהם.
update public.tv_config
set config = jsonb_set(
  config,
  '{elements}',
  (select coalesce(jsonb_agg(e order by i), '[]'::jsonb)
     from jsonb_array_elements(config->'elements') with ordinality as t(e, i)
    where e->>'id' <> 'el_98102e3c-1f84-421d-8341-f6e079f7a721')
)
where community_id = 'c9a613bb-d253-4249-b91c-11dcc82fe649'
  and config->'elements' @> '[{"id":"el_98102e3c-1f84-421d-8341-f6e079f7a721","text":"לוגואים"}]'::jsonb;
