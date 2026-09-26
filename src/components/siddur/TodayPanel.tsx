import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp } from "lucide-react";
import { loadSiddurCategory } from "@/hooks/useSiddurData";
import { zmanimFor } from "@community/lib/minyan-time";
import type { DayProfile } from "@/lib/jewishDay";
import { useServiceSections } from "@/hooks/useServiceSections";
import { siddurToday, type Nusach, type TodayItem } from "@/lib/siddurToday";
import type { SiddurSearchHit } from "@/utils/siddurSearch";

/**
 * "לפי לוח שנה": what is said today, at the top of the siddur, and a mark on
 * every section that is said today (or, like Tachanun, is not).
 *
 * The day is worked out by lib/jewishDay (from nightfall it is tomorrow's),
 * what it means for the prayers by lib/siddurToday. This file only finds the
 * sections in the open nusach and draws them.
 */

/** Section title -> said today / not said today. Empty when the mode is off. */
export const TodaySectionsContext = createContext<Map<string, boolean>>(new Map());

export function TodayBadge({ title }: { title: string }) {
  const marks = useContext(TodaySectionsContext);
  const say = marks.get(title);
  if (say === undefined) return null;
  return (
    <span
      className="ms-2 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 align-middle text-[11px] font-bold leading-none"
      style={
        say
          ? { background: "hsl(142 60% 40% / 0.14)", color: "hsl(142 55% 32%)" }
          : { background: "hsl(0 70% 50% / 0.12)", color: "hsl(0 60% 42%)" }
      }
      data-today={say ? "say" : "skip"}
    >
      {say ? "היום" : "לא היום"}
    </span>
  );
}

/** Which prayer of the day it is, for opening the siddur on it. */
export function prayerNow(now: Date, profile: DayProfile, cats: string[]): string | null {
  const z = zmanimFor(now, null);
  const has = (id: string) => cats.includes(id);
  let base: "shacharit" | "mincha" | "arvit";
  if (z.chatzot && now < z.chatzot) base = "shacharit";
  else if (z.tzeit && now < z.tzeit) base = "mincha";
  else base = "arvit";
  // Friday evening: Kabbalat Shabbat. Otherwise Shabbat's own prayer where the nusach has one.
  if (profile.shabbat && base === "arvit" && has("shabbat_kabbalat")) return "shabbat_kabbalat";
  if (profile.shabbat && has(`shabbat_${base}`)) return `shabbat_${base}`;
  return has(base) ? base : null;
}

interface Resolved {
  item: TodayItem;
  hit?: SiddurSearchHit;
}

export function TodayPanel({
  nusach,
  categories,
  accent,
  onOpen,
  onMarks,
  current,
  profile,
}: {
  nusach: string;
  categories: { id: string; name: string }[];
  accent: string;
  onOpen: (hit: SiddurSearchHit) => void;
  /** Tells the page which sections to mark. */
  onMarks: (marks: Map<string, boolean>) => void;
  /** The open prayer as shown (composed for the day): found there first, so a tap stays in it. */
  current?: { catId: string; sections: { title: string }[] };
  /** The day (the page's, so the list and the prayer agree). */
  profile: DayProfile;
}) {
  const items = useMemo(() => siddurToday(profile, nusach as Nusach), [profile, nusach]);
  // Shacharit as said today: what the day adds (הלל, הושענות, מוסף...) is found there, in its place.
  const { sections: shacharit } = useServiceSections(nusach, "shacharit", profile);

  const [resolved, setResolved] = useState<Resolved[]>(() => items.map((item) => ({ item })));
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem("siddur-today-open") !== "0";
    } catch {
      return true;
    }
  });

  // Find each prayer in the open nusach: the first section whose title matches.
  useEffect(() => {
    let alive = true;
    void Promise.all(categories.map(async (c) => ({ c, cat: await loadSiddurCategory(nusach, c.id) }))).then((loaded) => {
      if (!alive) return;
      // The open prayer as it is shown comes first, then today's Shacharit, then the rest.
      const shown = (id: string, sections: { title: string }[] | null | undefined) => {
        const c = categories.find((x) => x.id === id);
        return c && sections ? [{ c, cat: { name: c.name, sections } }] : [];
      };
      const first = [...(current ? shown(current.catId, current.sections) : []), ...shown("shacharit", shacharit)];
      const seen = new Set<string>();
      const all = [...first, ...loaded].filter((x) => !seen.has(x.c.id) && seen.add(x.c.id));
      const marks = new Map<string, boolean>();
      const out = items.map((item) => {
        // What is not said today is not in today's prayer: nothing to open.
        if (!item.match || !item.say) return { item };
        // A list of patterns is in order of preference: the first that is found anywhere wins.
        for (const re of [item.match].flat()) {
          for (const { c, cat } of all) {
            const index = cat?.sections.findIndex((s) => re.test(s.title.trim())) ?? -1;
            if (cat && index >= 0) {
              const title = cat.sections[index].title;
              marks.set(title, item.say);
              return { item, hit: { catId: c.id, catName: c.name, index, title } };
            }
          }
        }
        return { item };
      });
      setResolved(out);
      onMarks(marks);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, nusach, categories, current?.catId, current?.sections, shacharit]);

  const toggle = () => {
    setOpen((v) => {
      try {
        localStorage.setItem("siddur-today-open", v ? "0" : "1");
      } catch {
        /* not remembered */
      }
      return !v;
    });
  };

  const said = resolved.filter((r) => r.item.say && !r.item.amidah && !r.item.meal);
  const amidah = resolved.filter((r) => r.item.amidah);
  const meal = resolved.filter((r) => r.item.meal);
  const skipped = resolved.filter((r) => !r.item.say && !r.item.amidah);

  const Chip = ({ r }: { r: Resolved }) => (
    <button
      type="button"
      disabled={!r.hit}
      onClick={() => r.hit && onOpen(r.hit)}
      title={r.item.note ?? (r.hit ? `מעבר ל${r.hit.title} (${r.hit.catName})` : "אין סעיף נפרד בנוסח הזה")}
      className="rounded-full border px-2.5 py-1 text-right text-xs font-medium transition enabled:hover:opacity-80 disabled:cursor-default"
      style={{ borderColor: `${accent}55`, color: r.hit ? accent : "hsl(var(--foreground))" }}
      data-testid={`today-${r.item.id}`}
    >
      {r.item.label}
      {r.item.note && <span className="ms-1 opacity-70">· {r.item.note}</span>}
    </button>
  );

  return (
    <section
      dir="rtl"
      aria-label="מה אומרים היום"
      className="mb-4 rounded-xl border p-3"
      style={{ borderColor: `${accent}40`, background: "hsl(var(--card))" }}
      data-testid="siddur-today"
    >
      <button type="button" onClick={toggle} className="flex w-full items-center justify-between gap-2 text-right" aria-expanded={open}>
        <span className="flex min-w-0 items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0" style={{ color: accent }} />
          <span className="font-bold" style={{ color: accent }}>
            היום: {profile.title}
          </span>
          <span className="truncate text-xs text-muted-foreground">{profile.hebrewDate}</span>
        </span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2.5">
          {said.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold text-muted-foreground">אומרים היום</div>
              <div className="flex flex-wrap gap-1.5">{said.map((r) => <Chip key={r.item.id} r={r} />)}</div>
            </div>
          )}
          {amidah.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold text-muted-foreground">בתפילת העמידה</div>
              <div className="flex flex-wrap gap-1.5">{amidah.map((r) => <Chip key={r.item.id} r={r} />)}</div>
            </div>
          )}
          {meal.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold text-muted-foreground">בברכת המזון ובברכה מעין שלוש</div>
              <div className="flex flex-wrap gap-1.5">{meal.map((r) => <Chip key={r.item.id} r={r} />)}</div>
            </div>
          )}
          {skipped.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold text-muted-foreground">לא אומרים היום</div>
              <div className="flex flex-wrap gap-1.5">{skipped.map((r) => <Chip key={r.item.id} r={r} />)}</div>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            לפי הלוח העברי בארץ ישראל. מצאת הכוכבים מוצג היום הבא. במקום שהמנהג חלוק, לפי הנוסח שנבחר.
          </p>
        </div>
      )}
    </section>
  );
}
