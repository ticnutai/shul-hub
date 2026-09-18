-- Grant the admin role to jj1212t@gmail.com.
--
-- Written for Shul Hub's actual schema. The bootstrap script that circulates
-- with the other projects targets `app_roles` + `user_roles(user_id, role_id)`,
-- neither of which exists here: this project stores the role as an `app_role`
-- enum directly on `user_roles(user_id, role)`. That script's role section is
-- wrapped in `IF EXISTS`, so on this database it would have silently done
-- nothing while appearing to succeed.
--
-- `claim_admin()` cannot be used for this either. It only grants the role while
-- no admin exists at all; once the first administrator is in place it degrades
-- to a read-only check of the caller's own role.
--
-- No password appears in this file on purpose. Create the login first (see
-- below) so this repository never carries a credential into git or Lovable.
--
--   Supabase Dashboard -> Authentication -> Users -> Add user
--     email:    jj1212t@gmail.com
--     password: <your choice>
--     Auto Confirm User: on
--
-- Idempotent: safe to re-run.

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = 'jj1212t@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION
      'No auth user for jj1212t@gmail.com. Create the login first (Authentication -> Users -> Add user, with Auto Confirm on), then re-run this migration.';
  END IF;

  -- The app reads display names from `profiles`; without a row the admin shows
  -- up unnamed in the management screens.
  INSERT INTO public.profiles (id, display_name)
  VALUES (v_user_id, 'jj1212t')
  ON CONFLICT (id) DO UPDATE
    SET display_name = COALESCE(public.profiles.display_name, 'jj1212t');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE 'jj1212t@gmail.com is now an admin (user_id=%)', v_user_id;
END;
$$;
