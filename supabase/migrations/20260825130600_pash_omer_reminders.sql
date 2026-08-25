-- =====================================================
-- Omer Email Reminders table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.omer_email_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  reminder_time TIME NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  last_sent_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_omer_email_reminders_email ON public.omer_email_reminders(email);
CREATE INDEX IF NOT EXISTS idx_omer_email_reminders_active ON public.omer_email_reminders(is_active);

-- RLS
ALTER TABLE public.omer_email_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert email reminders"
  ON public.omer_email_reminders FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read email reminders"
  ON public.omer_email_reminders FOR SELECT USING (true);

CREATE POLICY "Service role full access email reminders"
  ON public.omer_email_reminders FOR ALL
  USING (auth.role() = 'service_role');

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_omer_email_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_omer_email_reminders_updated ON public.omer_email_reminders;
CREATE TRIGGER trg_omer_email_reminders_updated
  BEFORE UPDATE ON public.omer_email_reminders
  FOR EACH ROW EXECUTE FUNCTION update_omer_email_reminders_updated_at();

-- =====================================================
-- Omer WhatsApp Reminders table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.omer_whatsapp_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  reminder_time TIME NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sent_date DATE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_omer_whatsapp_reminders_phone ON public.omer_whatsapp_reminders(phone_number);
CREATE INDEX IF NOT EXISTS idx_omer_whatsapp_reminders_active ON public.omer_whatsapp_reminders(is_active);

-- RLS
ALTER TABLE public.omer_whatsapp_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert whatsapp reminders"
  ON public.omer_whatsapp_reminders FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read whatsapp reminders"
  ON public.omer_whatsapp_reminders FOR SELECT USING (true);

CREATE POLICY "Service role full access whatsapp reminders"
  ON public.omer_whatsapp_reminders FOR ALL
  USING (auth.role() = 'service_role');

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_omer_whatsapp_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_omer_whatsapp_reminders_updated ON public.omer_whatsapp_reminders;
CREATE TRIGGER trg_omer_whatsapp_reminders_updated
  BEFORE UPDATE ON public.omer_whatsapp_reminders
  FOR EACH ROW EXECUTE FUNCTION update_omer_whatsapp_reminders_updated_at();
