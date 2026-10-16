-- The shared library keeps images too: every picture a gabbai uploads to a
-- board is kept as an item of kind 'image' ({ url, name }), to be put on any
-- board again from "התמונות שלי". Same rights as the kits and the parts.
-- Idempotent.

ALTER TABLE public.tv_library_items DROP CONSTRAINT IF EXISTS tv_library_items_kind_check;
ALTER TABLE public.tv_library_items ADD CONSTRAINT tv_library_items_kind_check CHECK (kind IN ('kit', 'part', 'image'));
