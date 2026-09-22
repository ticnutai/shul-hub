-- =====================================================================
-- is_admin_of() answers about a synagogue that exists, or says no.
--
-- As written, a platform admin was "admin of" any uuid at all, including
-- one belonging to no synagogue. Nothing could be reached through it -
-- no row carries an id that is not in communities - so this closed no
-- hole. But a question about a synagogue that does not exist has one
-- honest answer, and a permission check that says yes to nonsense is a
-- check nobody can reason about later.
--
-- Idempotent.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_admin_of(_community uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT _community IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.communities WHERE id = _community)
     AND (
       public.is_platform_admin() OR EXISTS (
         SELECT 1 FROM public.user_roles
         WHERE user_id = auth.uid() AND role = 'admin' AND community_id = _community
       )
     );
$$;
