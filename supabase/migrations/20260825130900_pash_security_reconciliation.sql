
-- 1. Restrict profile reads to authenticated users
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 2. Add DELETE policy for user_settings
CREATE POLICY "Users can delete own settings"
ON public.user_settings
FOR DELETE
USING (auth.uid() = user_id);

-- 3. Fix mutable search_path on remaining functions
ALTER FUNCTION public.update_omer_email_reminders_updated_at() SET search_path = public;
ALTER FUNCTION public.update_omer_whatsapp_reminders_updated_at() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
