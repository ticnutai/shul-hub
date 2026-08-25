-- Add mobile-specific settings columns
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS font_settings_mobile jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS display_settings_mobile jsonb DEFAULT '{}'::jsonb;