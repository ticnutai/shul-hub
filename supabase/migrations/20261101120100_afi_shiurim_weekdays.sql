-- בית הכנסת אפי קפיטל: שיעורי הדף היומי והעמוד היומי לא מתקיימים בשבת - "בימי חול" במקום "בכל יום".
-- להריץ רק אחרי שהקוד שמכיר את "בימי חול" פורסם (אחרת התזכורות יישלחו רק בימי ראשון). אפשר להריץ שוב.
update public.shiurim
set schedule_type = 'weekdays'
where community_id = 'c9a613bb-d253-4249-b91c-11dcc82fe649' and schedule_type = 'daily' and active;
