-- "הפניות שלי": a member sees what they sent the gabbai - messages and
-- chavruta requests - and what became of them (read / approved / declined).
--
-- Neither table recorded who sent a row, so a member could not be shown their
-- own. Each row now carries its sender, set by the database from the session
-- (never from the request body, so nobody can file a message under someone
-- else's name), and a signed-in member may read their own rows. Everything
-- the gabbai could do before is unchanged. Rows sent before this have no
-- sender and stay visible to the gabbai only.

ALTER TABLE public.admin_messages
  ADD COLUMN IF NOT EXISTS sender_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;
ALTER TABLE public.chavruta_requests
  ADD COLUMN IF NOT EXISTS sender_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS admin_messages_sender_idx ON public.admin_messages (sender_id) WHERE sender_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS chavruta_requests_sender_idx ON public.chavruta_requests (sender_id) WHERE sender_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.stamp_sender()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.sender_id := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_messages_stamp_sender ON public.admin_messages;
CREATE TRIGGER admin_messages_stamp_sender
  BEFORE INSERT ON public.admin_messages
  FOR EACH ROW EXECUTE FUNCTION public.stamp_sender();

DROP TRIGGER IF EXISTS chavruta_requests_stamp_sender ON public.chavruta_requests;
CREATE TRIGGER chavruta_requests_stamp_sender
  BEFORE INSERT ON public.chavruta_requests
  FOR EACH ROW EXECUTE FUNCTION public.stamp_sender();

DROP POLICY IF EXISTS "sender reads own messages" ON public.admin_messages;
CREATE POLICY "sender reads own messages" ON public.admin_messages
  FOR SELECT TO authenticated
  USING (sender_id IS NOT NULL AND sender_id = auth.uid());

DROP POLICY IF EXISTS "sender reads own chavruta requests" ON public.chavruta_requests;
CREATE POLICY "sender reads own chavruta requests" ON public.chavruta_requests
  FOR SELECT TO authenticated
  USING (sender_id IS NOT NULL AND sender_id = auth.uid());
