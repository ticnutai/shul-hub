-- הפטרה בכרטיס השבת של "תורה ואהבתה" (כרטיס השבת הרגיל, בלי ערכה משלו). אפשר להריץ שוב.
update public.tv_config set config = jsonb_set(config, '{occasions,41,elements}', '["title","parasha","items","times","shma","pictures","haftarah"]'::jsonb) where community_id = '443392eb-a434-4a17-bda4-05be24eb7a20' and config->'occasions'->41->>'id' = 'shabbat';
