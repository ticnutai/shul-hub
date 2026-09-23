-- A minyan that is different on one day, without changing the minyan.
--
-- The timetable on the wall is the regular week. What it cannot say today is
-- "מנחה היום ב-13:00 ולא ב-13:30", or "ערבית מבוטלת היום". Until now the only
-- way to say either was to edit the minyan itself, which changes every other
-- day too - and then to remember to change it back. Nobody remembers to
-- change it back, so a board quietly carries last week's exception for a
-- month.
--
-- One row, one minyan, one date. No row is the normal case and costs nothing:
-- a board with no overrides behaves exactly as it did before this table
-- existed.
--
-- Deliberately *not* a second timetable. It holds only what differs, it is
-- keyed to a single date, and a row whose date has passed is dead weight
-- rather than a rule - which is what makes it safe to forget about.

CREATE TABLE IF NOT EXISTS public.minyan_overrides (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  minyan_id    uuid NOT NULL REFERENCES public.minyanim(id)    ON DELETE CASCADE,
  on_date      date NOT NULL,
  -- NULL keeps the minyan's own time: an override can be only a cancellation,
  -- or only a note ("היום בעזרת הנשים").
  at_time      time,
  cancelled    boolean NOT NULL DEFAULT false,
  note         text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- One exception per minyan per day. A second one would be two answers to
  -- "what time is mincha today", and the board would pick whichever came back
  -- first.
  CONSTRAINT minyan_overrides_one_per_day UNIQUE (minyan_id, on_date),

  -- A row that changes nothing is a row somebody will later read as meaning
  -- something.
  CONSTRAINT minyan_overrides_says_something
    CHECK (cancelled OR at_time IS NOT NULL OR btrim(note) <> '')
);

CREATE INDEX IF NOT EXISTS minyan_overrides_community_date_idx
  ON public.minyan_overrides (community_id, on_date);

ALTER TABLE public.minyan_overrides ENABLE ROW LEVEL SECURITY;

-- Read by everyone, like the timetable it belongs to: the board on the wall
-- has no account, and neither does somebody checking mincha from the street.
DROP POLICY IF EXISTS "minyan overrides public read" ON public.minyan_overrides;
CREATE POLICY "minyan overrides public read"
  ON public.minyan_overrides FOR SELECT USING (true);

DROP POLICY IF EXISTS "minyan overrides admin write" ON public.minyan_overrides;
CREATE POLICY "minyan overrides admin write"
  ON public.minyan_overrides FOR ALL TO authenticated
  USING (public.is_admin_of(community_id))
  WITH CHECK (public.is_admin_of(community_id));

GRANT SELECT ON public.minyan_overrides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.minyan_overrides TO authenticated;

-- Housekeeping: yesterday's exception is not a rule and should not be read as
-- one. Kept for a week so that "what happened last Tuesday" is still
-- answerable, then removed. Called from the admin; nothing depends on it
-- having run.
CREATE OR REPLACE FUNCTION public.prune_minyan_overrides()
RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH gone AS (
    DELETE FROM public.minyan_overrides
    WHERE on_date < (current_date - 7) AND public.is_admin_of(community_id)
    RETURNING 1
  )
  SELECT count(*)::integer FROM gone;
$$;

REVOKE ALL ON FUNCTION public.prune_minyan_overrides() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prune_minyan_overrides() TO authenticated;
