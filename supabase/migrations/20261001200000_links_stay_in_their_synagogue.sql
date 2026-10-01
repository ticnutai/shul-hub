-- A row may point only at a row of its own synagogue.
--
-- Three links run between the tables each synagogue owns:
--   minyanim.category_id          -> minyan_categories   (delete: CASCADE)
--   minyan_overrides.minyan_id    -> minyanim            (delete: CASCADE)
--   shiurim.category_id           -> shiur_categories    (delete: SET NULL)
--
-- Each was a plain foreign key on the id alone, and a cascade runs past row
-- level security. So a minyan of synagogue B that pointed at a category of
-- synagogue A was deleted when A's gabbai deleted that category - by someone
-- with no rights over B at all. Nothing wrote such a link (none exists, checked
-- 2026-10-01), but nothing refused one either.
--
-- Now each link is on (id, community_id): the database itself refuses a link
-- across synagogues, so a delete can only ever reach rows of the synagogue it
-- was made in. The delete behaviour is as before.
--
-- One statement, so it is applied whole or not at all.
DO $$
DECLARE
  r record;
  c record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('minyanim',         'category_id', 'minyan_categories', 'CASCADE'),
    ('minyan_overrides', 'minyan_id',   'minyanim',          'CASCADE'),
    ('shiurim',          'category_id', 'shiur_categories',  'SET NULL (category_id)')
  ) AS v(child, col, parent, on_delete) LOOP
    -- The parent's (id, community_id) is what the child's pair points at.
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = format('public.%I', r.parent)::regclass AND conname = r.parent || '_id_community_key'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (id, community_id)',
                     r.parent, r.parent || '_id_community_key');
    END IF;

    -- Every foreign key on the column alone goes, whatever it was named.
    FOR c IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
      WHERE con.conrelid = format('public.%I', r.child)::regclass
        AND con.contype = 'f'
        AND array_length(con.conkey, 1) = 1
        AND att.attname = r.col
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.child, c.conname);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', r.child, r.child || '_' || r.col || '_same_community_fkey');
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I, community_id)
         REFERENCES public.%I (id, community_id) ON DELETE %s',
      r.child, r.child || '_' || r.col || '_same_community_fkey', r.col, r.parent, r.on_delete);
  END LOOP;
END $$;
