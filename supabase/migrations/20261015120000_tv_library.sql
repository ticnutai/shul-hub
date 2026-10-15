-- The library shared by every board: kits and parts kept once, for any
-- synagogue's board to wear (tv_library_items), and each gabbai's own order
-- of it - folders, where each kit and part stands, tags, favourites - the
-- same on every board they edit (tv_library_order).
--
-- tv_library_items
--   kind   'kit' (a SavedDesign) or 'part' (a SavedElementSet)
--   data   the kit or the parts, as the editor keeps them in a board; a board
--          that wears one keeps its own copy, so a TV never reads this table
--
-- Any gabbai reads the library and adds to it - that is what makes it
-- shared. Only whoever kept an item, or a platform admin, changes or removes
-- it: another synagogue may be using it (as logo_library).
--
-- tv_library_order: one row per gabbai, theirs alone.
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.tv_library_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  name text NOT NULL,
  data jsonb NOT NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tv_library_items DROP CONSTRAINT IF EXISTS tv_library_items_kind_check;
ALTER TABLE public.tv_library_items ADD CONSTRAINT tv_library_items_kind_check CHECK (kind IN ('kit', 'part'));
ALTER TABLE public.tv_library_items DROP CONSTRAINT IF EXISTS tv_library_items_name_check;
ALTER TABLE public.tv_library_items ADD CONSTRAINT tv_library_items_name_check CHECK (char_length(name) BETWEEN 1 AND 80);
-- A kit of parts with its pictures referenced by address is far below this; a pasted picture is not.
ALTER TABLE public.tv_library_items DROP CONSTRAINT IF EXISTS tv_library_items_size_check;
ALTER TABLE public.tv_library_items ADD CONSTRAINT tv_library_items_size_check CHECK (octet_length(data::text) < 1500000);

ALTER TABLE public.tv_library_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tv library read" ON public.tv_library_items;
CREATE POLICY "tv library read" ON public.tv_library_items
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "tv library admin insert" ON public.tv_library_items;
CREATE POLICY "tv library admin insert" ON public.tv_library_items
  FOR INSERT TO authenticated WITH CHECK (public.is_admin() AND created_by = auth.uid());

DROP POLICY IF EXISTS "tv library owner update" ON public.tv_library_items;
CREATE POLICY "tv library owner update" ON public.tv_library_items
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin() OR (public.is_admin() AND created_by = auth.uid()))
  WITH CHECK (public.is_platform_admin() OR (public.is_admin() AND created_by = auth.uid()));

DROP POLICY IF EXISTS "tv library owner delete" ON public.tv_library_items;
CREATE POLICY "tv library owner delete" ON public.tv_library_items
  FOR DELETE TO authenticated
  USING (public.is_platform_admin() OR (public.is_admin() AND created_by = auth.uid()));

DROP TRIGGER IF EXISTS tv_library_items_updated_at ON public.tv_library_items;
CREATE TRIGGER tv_library_items_updated_at BEFORE UPDATE ON public.tv_library_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tv_library_items TO authenticated;


CREATE TABLE IF NOT EXISTS public.tv_library_order (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  library jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tv_library_order DROP CONSTRAINT IF EXISTS tv_library_order_size_check;
ALTER TABLE public.tv_library_order ADD CONSTRAINT tv_library_order_size_check CHECK (octet_length(library::text) < 200000);

ALTER TABLE public.tv_library_order ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tv library order own" ON public.tv_library_order;
CREATE POLICY "tv library order own" ON public.tv_library_order
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.is_admin())
  WITH CHECK (user_id = auth.uid() AND public.is_admin());

DROP TRIGGER IF EXISTS tv_library_order_updated_at ON public.tv_library_order;
CREATE TRIGGER tv_library_order_updated_at BEFORE UPDATE ON public.tv_library_order
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tv_library_order TO authenticated;
