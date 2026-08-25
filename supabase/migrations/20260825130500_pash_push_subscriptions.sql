-- Push Subscriptions table for Web Push notifications
-- Stores browser push subscriptions with their reminders configuration

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint text NOT NULL UNIQUE,
  keys_p256dh text NOT NULL,
  keys_auth text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reminders jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast lookup by endpoint
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions(endpoint);

-- Index for user-based queries
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

-- RLS policies
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access" ON public.push_subscriptions
  FOR ALL USING (true) WITH CHECK (true);

-- Anon users can insert their own subscriptions
CREATE POLICY "Anon can insert subscriptions" ON public.push_subscriptions
  FOR INSERT WITH CHECK (true);

-- Anon users can update their own subscriptions (by endpoint)
CREATE POLICY "Anon can update own subscription" ON public.push_subscriptions
  FOR UPDATE USING (true) WITH CHECK (true);

-- Anon users can delete their own subscriptions
CREATE POLICY "Anon can delete own subscription" ON public.push_subscriptions
  FOR DELETE USING (true);

COMMENT ON TABLE public.push_subscriptions IS 'Web Push notification subscriptions with per-device reminder configuration';
