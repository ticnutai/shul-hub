-- Add every public navigation function to the configurable home page.
-- Existing administrator visibility and ordering choices are preserved.

INSERT INTO public.home_widgets (key, label, kind, sort_order, visible) VALUES
  ('shiurim', 'שיעורי תורה', 'section', 40, true),
  ('chavrutot', 'חברותות', 'section', 50, true),
  ('contact', 'הודעה לגבאי', 'section', 60, true)
ON CONFLICT (key) DO UPDATE
SET label = EXCLUDED.label,
    kind = EXCLUDED.kind;
