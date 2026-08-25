BEGIN;

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS siddur_display_settings jsonb;

COMMENT ON COLUMN public.user_settings.siddur_display_settings IS
  'Synced Siddur layout and display-style preferences.';

COMMIT;
