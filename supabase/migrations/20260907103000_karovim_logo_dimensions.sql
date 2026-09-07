-- Shared responsive dimensions for the optional Karovim header logo.
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS karovim_logo_mobile_width integer NOT NULL DEFAULT 230,
  ADD COLUMN IF NOT EXISTS karovim_logo_mobile_height integer NOT NULL DEFAULT 130,
  ADD COLUMN IF NOT EXISTS karovim_logo_desktop_width integer NOT NULL DEFAULT 480,
  ADD COLUMN IF NOT EXISTS karovim_logo_desktop_height integer NOT NULL DEFAULT 270;

ALTER TABLE public.settings
  DROP CONSTRAINT IF EXISTS settings_karovim_logo_mobile_width_check,
  DROP CONSTRAINT IF EXISTS settings_karovim_logo_mobile_height_check,
  DROP CONSTRAINT IF EXISTS settings_karovim_logo_desktop_width_check,
  DROP CONSTRAINT IF EXISTS settings_karovim_logo_desktop_height_check;

ALTER TABLE public.settings
  ADD CONSTRAINT settings_karovim_logo_mobile_width_check
    CHECK (karovim_logo_mobile_width BETWEEN 140 AND 360),
  ADD CONSTRAINT settings_karovim_logo_mobile_height_check
    CHECK (karovim_logo_mobile_height BETWEEN 70 AND 240),
  ADD CONSTRAINT settings_karovim_logo_desktop_width_check
    CHECK (karovim_logo_desktop_width BETWEEN 240 AND 720),
  ADD CONSTRAINT settings_karovim_logo_desktop_height_check
    CHECK (karovim_logo_desktop_height BETWEEN 120 AND 420);
