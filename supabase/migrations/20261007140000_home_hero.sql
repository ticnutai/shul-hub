-- The strip at the top of the synagogue's home page (website and app): its
-- layout and its look, as the gabbai chooses them in the admin's home-page tab
-- (src/community/lib/homeHero.ts reads it, and anything unknown in it is the
-- default). An empty object is the strip as it was, with its name shown only
-- where the header above does not already show it.
-- Idempotent: safe to run again.
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS home_hero jsonb NOT NULL DEFAULT '{}'::jsonb;
