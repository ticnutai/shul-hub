-- "עדכון אפליקציה עכשיו": a command the admin can send to a screen.
--
-- From app 1.38 a box on Android 12+ updates itself silently at night
-- (android-tv AutoUpdate). This lets the admin ask for it now, from
-- "מסכים מחוברים", instead of waiting for the night. The board handles it in
-- TvApp ("update") by asking the app, through NativeBridge, to check, fetch
-- and install. The command list is a CHECK constraint, so it is widened here
-- together with the code that sends it. Idempotent.

ALTER TABLE public.tv_commands DROP CONSTRAINT IF EXISTS tv_commands_command_check;
ALTER TABLE public.tv_commands ADD CONSTRAINT tv_commands_command_check CHECK (command IN
  ('pause', 'resume', 'next', 'prev', 'goto', 'reload', 'theme', 'snapshot', 'message', 'identify', 'update'));
