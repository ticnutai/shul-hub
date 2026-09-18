import { useEffect, useMemo, useState } from "react";
import { HDate } from "@hebcal/core";
import {
  useAnnouncements,
  useMinyanim,
  useSettings,
  useShiurim,
  DAYS_HE,
  type Announcement,
  type Shiur,
} from "@community/lib/data";
import {
  DAY_TYPE_LABEL,
  dayTypeFor,
  jerusalemWeekday,
  resolveDay,
  zmanimFor,
  type ResolvedMinyan,
} from "@community/lib/minyan-time";
import { formatTime, ZMAN_LABELS, type SolarEvent } from "@community/lib/zmanim";
import { useNow, useRealtimeSync, type SyncStatus } from "@community/lib/realtime";
import { useOfflineSnapshot } from "./useOfflineSnapshot";
import "./tv.css";

/** Seconds each slide stays on screen. Long enough to read a full notice. */
const SLIDE_SECONDS = 20;

/** Notices per announcement slide; more than this stops being readable. */
const ANNOUNCEMENTS_PER_SLIDE = 4;

const SHOWN_ZMANIM: SolarEvent[] = [
  "alot",
  "sunrise",
  "sof_zman_shma",
  "sof_zman_tefila",
  "chatzot",
  "plag",
  "sunset",
  "tzeit",
];

type Slide =
  | { kind: "prayer" }
  | { kind: "announcements"; items: Announcement[]; page: number; pages: number }
  | { kind: "shiurim"; items: Shiur[] };

export function TvDisplay() {
  // One socket feeds every panel on this screen.
  const sync = useRealtimeSync(["settings", "minyanim", "announcements", "shiurim"]);

  const settingsQuery = useSettings();
  const minyanimQuery = useMinyanim();
  const announcementsQuery = useAnnouncements();
  const shiurimQuery = useShiurim();

  const settings = useOfflineSnapshot("settings", settingsQuery.data);
  const minyanim = useOfflineSnapshot("minyanim", minyanimQuery.data);
  const announcements = useOfflineSnapshot("announcements", announcementsQuery.data);
  const shiurim = useOfflineSnapshot("shiurim", shiurimQuery.data);

  // Ticks every second for the clock; also what re-evaluates "next minyan".
  const now = useNow(1000);

  const dayType = dayTypeFor(now);
  const zmanim = useMemo(() => zmanimFor(now, settings.data), [now, settings.data]);

  const todaysMinyanim = useMemo(
    () => (minyanim.data ? resolveDay(minyanim.data, dayType, zmanim) : []),
    [minyanim.data, dayType, zmanim],
  );

  const visibleAnnouncements = useMemo(() => {
    const list = announcements.data ?? [];
    const nowMs = now.getTime();
    return list.filter(
      (a) => !a.expires_at || new Date(a.expires_at).getTime() > nowMs,
    );
  }, [announcements.data, now]);

  const todaysShiurim = useMemo(() => {
    const list = shiurim.data ?? [];
    const weekday = jerusalemWeekday(now);
    return list.filter(
      (s) => s.active && (s.schedule_type !== "weekly" || s.day_of_week === weekday),
    )
      // `sort_order` is the admin's ordering for the website, which on the
      // wall read as 16:15, 08:45, 14:15, 15:15. A schedule is scanned by time.
      .sort((a, b) => shiurMinutes(a.time_text) - shiurMinutes(b.time_text));
  }, [shiurim.data, now]);

  const slides = useMemo<Slide[]>(() => {
    const built: Slide[] = [{ kind: "prayer" }];

    const pages = Math.ceil(visibleAnnouncements.length / ANNOUNCEMENTS_PER_SLIDE);
    for (let page = 0; page < pages; page += 1) {
      built.push({
        kind: "announcements",
        items: visibleAnnouncements.slice(
          page * ANNOUNCEMENTS_PER_SLIDE,
          (page + 1) * ANNOUNCEMENTS_PER_SLIDE,
        ),
        page: page + 1,
        pages,
      });
    }

    if (todaysShiurim.length > 0) built.push({ kind: "shiurim", items: todaysShiurim });

    return built;
  }, [visibleAnnouncements, todaysShiurim]);

  const [index, setIndex] = useState(0);

  // Rotate. Restarting on `slides.length` keeps a freshly added notice from
  // having to wait a whole cycle, and keeps the index inside the array when
  // a notice expires while it is on screen.
  useEffect(() => {
    if (slides.length <= 1) {
      setIndex(0);
      return;
    }
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % slides.length),
      SLIDE_SECONDS * 1000,
    );
    return () => window.clearInterval(id);
  }, [slides.length]);

  const slide = slides[Math.min(index, slides.length - 1)] ?? { kind: "prayer" as const };

  const anyLoaded =
    settings.data !== null ||
    minyanim.data !== null ||
    announcements.data !== null ||
    shiurim.data !== null;

  const showingStale =
    minyanim.isStale || announcements.isStale || shiurim.isStale || settings.isStale;

  return (
    <div className="tv-root">
      <TvHeader
        name={settings.data?.name ?? "בית הכנסת"}
        address={settings.data?.address ?? null}
        now={now}
      />

      <main className="tv-stage">
        {!anyLoaded ? (
          <BootState status={sync.status} />
        ) : slide.kind === "prayer" ? (
          <PrayerSlide
            dayType={dayType}
            minyanim={todaysMinyanim}
            zmanim={zmanim}
            now={now}
          />
        ) : slide.kind === "announcements" ? (
          <AnnouncementsSlide slide={slide} />
        ) : (
          <ShiurimSlide items={slide.items} />
        )}
      </main>

      <TvFooter
        count={slides.length}
        index={Math.min(index, slides.length - 1)}
        status={sync.status}
        showingStale={showingStale}
        lastSyncedAt={sync.lastSyncedAt}
        now={now}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function TvHeader({
  name,
  address,
  now,
}: {
  name: string;
  address: string | null;
  now: Date;
}) {
  // `now` ticks every second; the Hebrew date only needs recomputing when the
  // calendar day rolls over, so key the memo on the day rather than the instant.
  const dayKey = now.toDateString();
  const hebrewDate = useMemo(
    () => new HDate(new Date(dayKey)).renderGematriya(true),
    [dayKey],
  );

  const gregorian = now.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <header className="tv-header">
      <div>
        <h1 className="tv-title">{name}</h1>
        <div className="tv-subtitle">
          {DAYS_HE[jerusalemWeekday(now)] ? `יום ${DAYS_HE[jerusalemWeekday(now)]}` : ""}
          {address ? ` · ${address}` : ""}
        </div>
      </div>
      <div className="tv-clock">
        <div className="tv-clock-time">{formatTime(now)}</div>
        <div className="tv-clock-date">
          {hebrewDate} · {gregorian}
        </div>
      </div>
    </header>
  );
}

function PrayerSlide({
  dayType,
  minyanim,
  zmanim,
  now,
}: {
  dayType: "weekday" | "friday";
  minyanim: ResolvedMinyan[];
  zmanim: Record<SolarEvent, Date | null>;
  now: Date;
}) {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nextIndex = minyanim.findIndex((m) => m.minutes >= nowMinutes);

  return (
    <section className="tv-slide">
      <h2 className="tv-slide-heading">
        זמני התפילות <small>{DAY_TYPE_LABEL[dayType]}</small>
      </h2>

      <div className="tv-prayer-grid">
        <div className="tv-panel">
          <h3 className="tv-panel-title">מניינים</h3>
          {minyanim.length === 0 ? (
            <p className="tv-centered-note">לא הוגדרו מניינים ליום זה</p>
          ) : (
            <ul className="tv-minyan-list">
              {minyanim.map((item, i) => (
                <li
                  key={item.minyan.id}
                  className={`tv-minyan-row${i === nextIndex ? " is-next" : ""}`}
                >
                  <span className="tv-minyan-name">
                    {item.minyan.label}
                    {i === nextIndex && <span className="tv-next-badge">הבא</span>}
                    <span className="tv-minyan-source">{item.source}</span>
                  </span>
                  <span className="tv-minyan-time">{item.time}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="tv-panel">
          <h3 className="tv-panel-title">זמני היום</h3>
          <dl className="tv-zman-list">
            {SHOWN_ZMANIM.map((event) => (
              <div className="tv-zman-row" key={event}>
                <dt>{ZMAN_LABELS[event]}</dt>
                <dd>{formatTime(zmanim[event])}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

function AnnouncementsSlide({
  slide,
}: {
  slide: Extract<Slide, { kind: "announcements" }>;
}) {
  return (
    <section className="tv-slide">
      <h2 className="tv-slide-heading">
        מודעות לציבור
        {slide.pages > 1 && (
          <small>
            {slide.page} מתוך {slide.pages}
          </small>
        )}
      </h2>
      <div className="tv-cards" data-count={slide.items.length}>
        {slide.items.map((item) => (
          <article
            key={item.id}
            className={`tv-card${item.pinned ? " tv-card-pinned" : ""}`}
          >
            <h3 className="tv-card-title">{item.title}</h3>
            <p className="tv-card-body">{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ShiurimSlide({ items }: { items: Shiur[] }) {
  return (
    <section className="tv-slide">
      <h2 className="tv-slide-heading">
        שיעורי תורה <small>היום</small>
      </h2>
      <ul className="tv-shiur-list">
        {items.map((shiur) => (
          <li className="tv-shiur-row" key={shiur.id}>
            <span className="tv-shiur-time">{shiur.time_text}</span>
            <span>
              <div className="tv-shiur-title">{shiur.title}</div>
              {(shiur.location || shiur.description) && (
                <div className="tv-shiur-meta">
                  {[shiur.location, shiur.description].filter(Boolean).join(" · ")}
                </div>
              )}
            </span>
            <span className="tv-shiur-teacher">{shiur.teacher}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BootState({ status }: { status: SyncStatus }) {
  return (
    <div className="tv-centered">
      <div className="tv-centered-title">
        {status === "offline" ? "אין חיבור לרשת" : "טוען נתונים…"}
      </div>
      <p className="tv-centered-note">
        {status === "offline"
          ? "המסך ינסה להתחבר שוב אוטומטית. ברגע שהחיבור יחזור, הנתונים יוצגו."
          : "מתחבר לשרת בית הכנסת."}
      </p>
    </div>
  );
}

function TvFooter({
  count,
  index,
  status,
  showingStale,
  lastSyncedAt,
  now,
}: {
  count: number;
  index: number;
  status: SyncStatus;
  showingStale: boolean;
  lastSyncedAt: Date | null;
  now: Date;
}) {
  const statusClass =
    status === "live" && !showingStale
      ? ""
      : status === "connecting"
        ? " is-connecting"
        : " is-offline";

  let label: string;
  if (status === "live" && !showingStale) {
    label = "מעודכן";
  } else if (status === "connecting") {
    label = "מתחבר…";
  } else {
    const reference = lastSyncedAt;
    label = reference
      ? `מציג מידע מ־${describeAge(now.getTime() - reference.getTime())}`
      : "אין חיבור";
  }

  return (
    <footer className="tv-footer">
      <div className="tv-dots">
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className={`tv-dot${i === index ? " is-active" : ""}`} />
        ))}
      </div>
      <div className="tv-status">
        <span className={`tv-status-dot${statusClass}`} />
        <span>{label}</span>
      </div>
    </footer>
  );
}

/**
 * Minutes past midnight from a shiur's free-text time ("16:15 · חצי שעה",
 * "8:45"). `time_text` is typed by the admin, so anything without a clock time
 * sorts after the timed entries instead of breaking the order.
 */
function shiurMinutes(timeText: string | null | undefined): number {
  const match = timeText?.match(/(\d{1,2}):(\d{2})/);
  if (!match) return Number.POSITIVE_INFINITY;
  return Number(match[1]) * 60 + Number(match[2]);
}

function describeAge(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "הרגע";
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}
