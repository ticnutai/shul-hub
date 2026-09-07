-- Shared responsive offsets for positioning the optional Karovim header logo.
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS karovim_logo_mobile_offset_x integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS karovim_logo_mobile_offset_y integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS karovim_logo_desktop_offset_x integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS karovim_logo_desktop_offset_y integer NOT NULL DEFAULT 0;

ALTER TABLE public.settings
  DROP CONSTRAINT IF EXISTS settings_karovim_logo_mobile_offset_x_check,
  DROP CONSTRAINT IF EXISTS settings_karovim_logo_mobile_offset_y_check,
  DROP CONSTRAINT IF EXISTS settings_karovim_logo_desktop_offset_x_check,
  DROP CONSTRAINT IF EXISTS settings_karovim_logo_desktop_offset_y_check;

ALTER TABLE public.settings
  ADD CONSTRAINT settings_karovim_logo_mobile_offset_x_check
    CHECK (karovim_logo_mobile_offset_x BETWEEN -120 AND 120),
  ADD CONSTRAINT settings_karovim_logo_mobile_offset_y_check
    CHECK (karovim_logo_mobile_offset_y BETWEEN -80 AND 80),
  ADD CONSTRAINT settings_karovim_logo_desktop_offset_x_check
    CHECK (karovim_logo_desktop_offset_x BETWEEN -240 AND 240),
  ADD CONSTRAINT settings_karovim_logo_desktop_offset_y_check
    CHECK (karovim_logo_desktop_offset_y BETWEEN -120 AND 120);
