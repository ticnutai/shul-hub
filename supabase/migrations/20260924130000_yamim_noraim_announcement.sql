-- The High Holidays event notice, as an ordinary announcement.
--
-- It used to be a banner written into the code (YamimNoraimAnnouncement.tsx),
-- placed by hand above the announcements list, so the gabbai could not see,
-- edit or delete it, and with no end date it kept showing after the event.
-- As a row it is in the admin's announcements tab like any other notice.
--
-- expires_at is the event's last day (21.9.2026). Public reads already hide
-- expired rows ("announcements public read"), the admin still sees it and can
-- extend or delete it. The event page itself stays at its address, for links
-- already shared.
--
-- Idempotent: inserts only if this community has no announcement by this title.

INSERT INTO public.announcements
  (community_id, kind, title, body, image_url, expires_at, show_on_home, pinned, sort_order, home_width, style)
SELECT
  c.id,
  'general',
  'תפילות הימים הנוראים באולמי קונקורד',
  E'ראש השנה ויום כיפור בנוסח ספרדי\n'
  || E'11–21 בספטמבר 2026 · רחוב מצדה 9, בני ברק\n'
  || E'פרטים והרשמה: הרב עושרי 054-6473461\n'
  || E'כל הזמנים: shul-hub.lovable.app/events/yamim-noraim-concord-2026',
  'https://shul-hub.lovable.app/events/yamim-noraim-concord-2026.jpg',
  DATE '2026-09-21',
  true,
  false,
  10,
  'full',
  '{"preset": "classic", "background": "#102c57", "foreground": "#ffffff", "accent": "#f4bd35", "align": "right", "radius": 16, "shadow": true}'::jsonb
FROM public.communities c
WHERE c.slug = 'main'
  AND NOT EXISTS (
    SELECT 1 FROM public.announcements a
    WHERE a.community_id = c.id
      AND a.title = 'תפילות הימים הנוראים באולמי קונקורד'
  );
