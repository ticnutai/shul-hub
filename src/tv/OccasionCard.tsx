import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { HDate } from "@hebcal/core";
import type { Settings } from "@community/lib/data";
import { jerusalemWeekday, type ResolvedMinyan } from "@community/lib/minyan-time";
import {
  combinedDay,
  holyDayEnd,
  specialDaysOn,
  specialZmanim,
  verseFor,
  type SpecialDayDef,
} from "@community/lib/specialDays";
import { formatTime, type Zmanim } from "@community/lib/zmanim";
import { zmanimFor as zmanimOf } from "@community/lib/minyan-time";
import { DefaultArt } from "./EventSplash";
import { upcomingDays, weeklyParasha } from "./learning";
import { SHABBAT_ID, type ActiveOccasion, type CardElement, type OccasionPage } from "./occasions";
import { ShabbatPicture } from "./ShabbatScene";
import { torahReadingOn } from "./torahReading";

/**
 * An occasion's screen: whatever the gabbai chose for it, and nothing else.
 *
 * One component for every occasion - Shabbat, a festival, the shul's own day
 * - drawing its parts (occasions.CARD_ELEMENTS) over its pictures. It stands
 * two ways:
 *   stage   the whole board: the pictures behind, the card over them
 *   banner  a line along the bottom of an ordinary screen
 */

export interface DaySchedule {
  id: string;
  title: string;
  rows: ResolvedMinyan[];
}

/** The zmanim of the day, in the order of the day. */
const DAY_ZMANIM: { key: keyof Zmanim; label: string }[] = [
  { key: "alot", label: "עלות השחר" },
  { key: "sunrise", label: "הנץ החמה" },
  { key: "sof_zman_shma", label: "סוף זמן ק״ש" },
  { key: "sof_zman_tefila", label: "סוף זמן תפילה" },
  { key: "chatzot", label: "חצות היום" },
  { key: "mincha_gedola", label: "מנחה גדולה" },
  { key: "plag", label: "פלג המנחה" },
  { key: "sunset", label: "שקיעה" },
  { key: "tzeit", label: "צאת הכוכבים" },
];

const PRAYER_LABELS: Record<string, string> = { shacharit: "שחרית", mincha: "מנחה", arvit: "ערבית" };

/** The day's minyanim, one line per prayer: "שחרית 6:15 · 7:00 · 7:55". */
function prayerLines(schedules: DaySchedule[]): { label: string; times: { time: string; cancelled?: boolean }[] }[] {
  const lines = new Map<string, { time: string; cancelled?: boolean; minutes: number }[]>();
  for (const s of schedules) {
    for (const r of s.rows) {
      const label = PRAYER_LABELS[r.minyan.prayer] ?? r.minyan.label;
      const list = lines.get(label) ?? [];
      if (!list.some((x) => x.time === r.time)) list.push({ time: r.time, cancelled: r.cancelled, minutes: r.minutes });
      lines.set(label, list);
    }
  }
  return [...lines.entries()].map(([label, times]) => ({ label, times: times.sort((a, b) => a.minutes - b.minutes) }));
}

const SHABBAT_DEF: SpecialDayDef = { key: "shabbat", name: "שבת קודש", group: "shabbatot", match: /(?!)/ };
const stripNote = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, "");

/** The calendar's day an occasion stands for (for its verse, colours and built-in pictures). */
function defOf(a: ActiveOccasion): SpecialDayDef {
  const o = a.occasion;
  if (o.when.type === "shabbat") return SHABBAT_DEF;
  if (o.when.type === "calendar") {
    const key = o.when.key;
    return specialDaysOn(a.date).find((d) => d.key === key) ?? { key, name: o.name, group: "other", match: /(?!)/ };
  }
  return { key: o.id, name: o.name, group: "other", match: /(?!)/ };
}

export interface OccasionCardProps {
  page: OccasionPage;
  /** The whole board / a line along its bottom / a frame of the occasion's own screen. */
  mode: "stage" | "banner" | "frame";
  /** Second precision: the clock and the pictures' turns. */
  now: Date;
  settings: Settings | null | undefined;
  endMinutes: number;
  zmanimFor: (date: Date) => Zmanim;
  /** The day's minyanim (the board's own schedules for that date, worked out with the slides). */
  schedules?: DaySchedule[];
}

export function OccasionCard({ page, mode, now, settings, endMinutes, zmanimFor, schedules }: OccasionCardProps) {
  const { main } = page;
  const o = main.occasion;
  const date = main.date;
  const all = [main, ...page.with];
  const show = (e: CardElement) => o.elements.includes(e);
  const dayKey = `${date.toDateString()}|${page.with.map((w) => w.occasion.id).join()}`;

  // Everything that depends on the day, not the second.
  const day = useMemo(() => {
    const z = zmanimFor(date);
    const def = defOf(main);
    const withShabbat = all.some((a) => a.occasion.id === SHABBAT_ID);
    const saturday = jerusalemWeekday(date) === 6 ? date : null;

    // The name: the gabbai's, or the day's own - with Shabbat, "שבת · סוכות".
    const festivalLeads = o.when.type === "calendar" && withShabbat;
    const title =
      o.title ??
      (festivalLeads
        ? combinedDay(def, date).title
        : [stripNote(o.name), ...page.with.map((w) => stripNote(w.occasion.name))].join(" · "));

    const inPage = new Set(all.flatMap((a) => (a.occasion.when.type === "calendar" ? [a.occasion.when.key] : [])));
    const also = specialDaysOn(date)
      .filter((d) => !d.national && !inPage.has(d.key))
      .map((d) => stripNote(d.name));

    const ownVerse = verseFor(def.key);
    const pair = festivalLeads && ownVerse ? { shabbat: verseFor("shabbat")!, day: ownVerse, head: stripNote(def.name) } : null;
    const verse = pair ? null : ownVerse ?? (withShabbat ? verseFor("shabbat") : null);

    // Shabbat's own two times, beside the day's: candle lighting on Friday and its end.
    const times = specialZmanim(date, z, endMinutes).map((r) => ({ key: r.key, label: r.label, time: r.time }));
    if (withShabbat && saturday) {
      const friday = zmanimFor(new Date(saturday.getTime() - 86_400_000));
      const end = holyDayEnd(z, endMinutes);
      if (friday.candle && !times.some((t) => t.key === "candle")) times.unshift({ key: "candle", label: "הדלקת נרות", time: friday.candle });
      if (end && !times.some((t) => t.key === "chag_end" || t.key === "fast_end"))
        times.push({ key: "shabbat_end", label: "צאת השבת", time: end });
    }
    const shma = [
      { key: "shma", label: "סוף זמן ק״ש", time: z.sof_zman_shma },
      { key: "tefila", label: "סוף זמן תפילה", time: z.sof_zman_tefila },
    ].filter((r) => r.time);
    const zmanim = DAY_ZMANIM.filter((r) => z[r.key]).map((r) => ({ key: r.key, label: r.label, time: z[r.key] as Date }));

    const parashaDay = saturday ?? new Date(date.getTime() + ((6 - jerusalemWeekday(date) + 7) % 7) * 86_400_000);
    const special =
      upcomingDays(parashaDay, 1, 4).find((u) => u.inDays === 0 && /^שבת /.test(u.title) && u.title !== "שבת")?.title ?? null;
    const parasha = [weeklyParasha(parashaDay), special].filter(Boolean).join(" · ");

    return {
      z,
      def,
      withShabbat,
      title,
      also,
      verse,
      pair,
      times,
      shma,
      zmanim,
      parasha,
      torah: torahReadingOn(date),
      hebrew: new HDate(date).renderGematriya(true),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey, o, settings, endMinutes]);

  const items = all.flatMap((a) => a.occasion.items);
  const rows = [
    ...(show("times") ? day.times : []),
    ...(show("shma") ? day.shma.filter((r) => !day.times.some((t) => t.label === r.label)) : []),
    ...(show("zmanim")
      ? day.zmanim.filter((r) => !day.times.some((t) => t.label === r.label) && !(show("shma") && day.shma.some((s) => s.label === r.label)))
      : []),
  ].filter((r) => r.time);
  const itemTimes = show("items") ? items.filter((i) => i.kind === "time") : [];
  const itemTexts = show("items") ? items.filter((i) => i.kind === "text") : [];
  const prayers = show("prayers") && schedules ? prayerLines(schedules) : [];

  // Before any early return: a hook is called on every render.
  const fit = useCardFit(`${dayKey}|${o.elements.join()}|${rows.length}|${prayers.length}|${items.length}`, mode === "frame");
  if (mode === "banner")
    return (
      <div className="tv-event-splash is-info is-banner" role="region" aria-label={day.title}>
        <div className="tv-event-banner">
          <span className="tv-event-banner-title">{day.title}</span>
          {[...day.times, ...(show("shma") ? day.shma : [])].map((r) => (
            <span key={r.key} className="tv-event-banner-time">
              {r.label} <b>{formatTime(r.time)}</b>
            </span>
          ))}
        </div>
      </div>
    );

  // The pictures take turns, each as long as the gabbai set.
  const pictures = show("pictures") ? o.pictures : [];
  const seconds = Math.floor(now.getTime() / 1000);
  const active = pictures.length ? Math.floor(seconds / Math.max(5, o.pictureSeconds)) % pictures.length : 0;
  const full = rows.length + prayers.length + itemTimes.length > 4 || show("torah");

  return (
    <div
      className={`tv-event-splash tv-occasion is-${mode}${full ? " is-full" : ""}${pictures.length ? "" : " is-plain"}`}
      role="region"
      aria-label={day.title}
      data-occasion={o.id}
    >
      {mode === "stage" && <div className="tv-event-clock">{formatTime(now)}</div>}
      {pictures.map((p, i) => (
        <div key={`${i}:${p}`} className={`tv-event-layer${i === active ? " is-active" : ""}`} data-slide={i}>
          {p.startsWith("art:") ? (
            <div className="tv-occasion-art">
              <ShabbatPicture scene={p} flickerKey={Math.floor(now.getTime() / 600_000)} />
            </div>
          ) : p.startsWith("style:") ? (
            <DefaultArt def={day.def} variant={Number(p.slice(6))} withShabbat={day.withShabbat} />
          ) : (
            <>
              {/* The whole picture, never cropped; the same picture, blurred, fills the edges. */}
              <div className="tv-event-photo-fill" style={{ backgroundImage: `url("${p}")` }} />
              <div className="tv-event-photo" style={{ backgroundImage: `url("${p}")` }} />
            </>
          )}
        </div>
      ))}
      <div className="tv-event-card" ref={fit.ref} style={fit.style}>
        {show("date") && <div className="tv-event-date">{day.hebrew}</div>}
        {show("title") && <div className="tv-event-title">{day.title}</div>}
        {show("parasha") && day.parasha && <div className="tv-event-also">{day.parasha}</div>}
        {show("also") && day.also.length > 0 && <div className="tv-event-also">{day.also.join(" · ")}</div>}
        {show("verse") && day.pair && (
          <div className="tv-event-verses">
            <figure className="tv-event-verse">
              <div className="tv-event-verse-head">שבת קודש</div>
              <blockquote>{day.pair.shabbat.text}</blockquote>
              <figcaption>{day.pair.shabbat.source}</figcaption>
            </figure>
            <figure className="tv-event-verse">
              <div className="tv-event-verse-head">{day.pair.head}</div>
              <blockquote>{day.pair.day.text}</blockquote>
              <figcaption>{day.pair.day.source}</figcaption>
            </figure>
          </div>
        )}
        {show("verse") && day.verse && (
          <figure className="tv-event-verse">
            <blockquote>{day.verse.text}</blockquote>
            <figcaption>{day.verse.source}</figcaption>
          </figure>
        )}
        {itemTexts.map((i) => (
          <p key={i.id} className="tv-occasion-text">
            {i.label && <b>{i.label}: </b>}
            {i.value}
          </p>
        ))}
        <div className={prayers.length ? "tv-event-grid" : undefined}>
          {rows.length + itemTimes.length > 0 && (
            <dl className="tv-event-times">
              {rows.map((r) => (
                <div key={r.key}>
                  <dt>{r.label}</dt>
                  <dd>{formatTime(r.time)}</dd>
                </div>
              ))}
              {itemTimes.map((i) => (
                <div key={i.id}>
                  <dt>{i.label}</dt>
                  <dd>{i.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {prayers.length > 0 && (
            <dl className="tv-event-prayers" data-testid="event-prayers">
              {prayers.map((p) => (
                <div key={p.label}>
                  <dt>{p.label}</dt>
                  <dd>
                    {p.times.map((t, i) => (
                      <span key={t.time + i} className={t.cancelled ? "is-cancelled" : undefined}>
                        {t.time}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        {(show("torah") || show("haftarah")) && day.torah && (
          <dl className="tv-event-torah">
            {show("torah") && (
              <div>
                <dt>{day.torah.parasha ? `קריאת התורה · ${day.torah.parasha}` : "קריאת התורה"}</dt>
                <dd>{day.torah.reading}</dd>
              </div>
            )}
            {show("torah") && day.torah.maftir && (
              <div>
                <dt>מפטיר</dt>
                <dd>{day.torah.maftir}</dd>
              </div>
            )}
            {show("haftarah") && day.torah.haftarah && (
              <div>
                <dt>הפטרה</dt>
                <dd>{day.torah.haftarah}</dd>
              </div>
            )}
          </dl>
        )}
        {pictures.length > 1 && (
          <div className="tv-event-dots" aria-hidden>
            {pictures.map((_, i) => (
              <span key={i} className={i === active ? "is-active" : ""} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The card in a frame of the occasion's own screen (occasions.ts, `screen`),
 * beside the blocks the gabbai put there. The screen is drawn once a minute;
 * the card keeps its pictures turning on a clock of its own, and only when it
 * has more than one - a board at rest stays at rest.
 */
export function OccasionFrame({
  slide,
}: {
  slide: { page: OccasionPage; settings: Settings | null; endMinutes: number; schedules: DaySchedule[] };
}) {
  const o = slide.page.main.occasion;
  const turning = o.elements.includes("pictures") && o.pictures.length > 1;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!turning) return;
    const t = window.setInterval(() => setNow(new Date()), Math.max(5, o.pictureSeconds) * 1000);
    return () => window.clearInterval(t);
  }, [turning, o.pictureSeconds]);
  const zmanimFor = useMemo(() => (d: Date) => zmanimOf(d, slide.settings), [slide.settings]);
  return (
    <div className="tv-occasion-frame" data-block="festival">
      <OccasionCard
        page={slide.page}
        mode="frame"
        now={now}
        settings={slide.settings}
        endMinutes={slide.endMinutes}
        zmanimFor={zmanimFor}
        schedules={slide.schedules}
      />
    </div>
  );
}

/**
 * A card with everything ticked (every zman, the minyanim, the Torah
 * reading, two verses) can be taller than the screen, and its name at the
 * top was cut off. It is measured once its contents change and scaled down
 * to fit - never below 60%, which is still readable across a hall.
 *
 * In a frame of the occasion's screen (`grow`) it is sized for the board and
 * came out small in a frame a third as wide; there it also grows, as far as
 * the frame allows in both directions, and again when the frame is resized.
 */
function useCardFit(key: string, grow = false) {
  const ref = useRef<HTMLDivElement>(null);
  const fitRef = useRef(1);
  const [size, setSize] = useState("");
  useLayoutEffect(() => {
    const card = ref.current;
    const box = card?.parentElement;
    if (!card || !box) return;
    card.style.setProperty("--card-fit", "1");
    const room = box.clientHeight * 0.94;
    const need = card.scrollHeight;
    let fit = need > room && room > 0 ? Math.max(0.6, Math.floor((room / need) * 100) / 100) : 1;
    if (grow && room > 0 && need > 0) {
      const wide = (box.clientWidth * 0.92) / Math.max(1, card.offsetWidth);
      fit = Math.max(0.6, Math.min(3, Math.floor(Math.min(room / need, wide) * 100) / 100));
    }
    fitRef.current = fit;
    card.style.setProperty("--card-fit", String(fit));
  }, [key, grow, size]);
  useEffect(() => {
    const box = ref.current?.parentElement;
    if (!grow || !box || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setSize(`${Math.round(e.contentRect.width)}x${Math.round(e.contentRect.height)}`));
    ro.observe(box);
    return () => ro.disconnect();
  }, [grow]);
  return { ref, style: { "--card-fit": fitRef.current } as CSSProperties };
}
