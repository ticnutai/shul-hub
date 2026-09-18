import { useEffect, useMemo, useState } from "react";
import { prayerLabel, type Announcement, type Shiur } from "@community/lib/data";
import type { ResolvedMinyan } from "@community/lib/minyan-time";
import { formatTime, ZMAN_LABELS, type SolarEvent, type Zmanim } from "@community/lib/zmanim";
import { dafYomi, upcomingDays, weeklyParasha } from "./learning";
import { jerusalemMinutes, shiurMinutes, type BoardSlide } from "./useBoardData";

/**
 * The slide bodies. Pure presentation: everything they need arrives as props,
 * so the admin preview can render any slide, in any layout, at any time.
 */

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

/** Column-flowing two-column grid needs an explicit row count to fill column by column. */
function twoColRows(n: number) {
  return n > 7 ? { gridTemplateRows: `repeat(${Math.ceil(n / 2)}, minmax(0, 1fr))` } : undefined;
}

function untilLabel(minutes: number): string {
  if (minutes <= 0) return "מתחיל עכשיו";
  if (minutes < 60) return `בעוד ${minutes} דק׳`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `בעוד ${h === 1 ? "שעה" : `${h} שע׳`}${m ? ` ו־${m} דק׳` : ""}`;
}

export function SlideView({
  slide,
  now,
  zmanim,
  paused,
}: {
  slide: BoardSlide;
  /** Minute precision is all a slide body needs (see TvBoard). */
  now: Date;
  zmanim: Zmanim;
  paused: boolean;
}) {
  switch (slide.kind) {
    case "prayer":
      return <PrayerSlide slide={slide} now={now} zmanim={zmanim} />;
    case "learning":
      return <LearningSlide layout={slide.layout} now={now} />;
    case "announcements":
      return <AnnouncementsSlide slide={slide} />;
    case "shiurim":
      return <ShiurimSlide slide={slide} now={now} />;
    case "slideshow":
      return <SlideshowSlide slide={slide} paused={paused} />;
  }
}

/* ------------------------------------------------------------------ prayer */

function PrayerSlide({
  slide,
  now,
  zmanim,
}: {
  slide: Extract<BoardSlide, { kind: "prayer" }>;
  now: Date;
  zmanim: Zmanim;
}) {
  const nowMin = jerusalemMinutes(now);
  const nextIndex = slide.rows.findIndex((r) => r.minutes >= nowMin);
  const heading = (
    <h2 className="tv-slide-heading">
      זמני התפילות {slide.title && <small>{slide.title}</small>}
    </h2>
  );

  if (slide.rows.length === 0) {
    return (
      <section className="tv-slide">
        {heading}
        <div className="tv-prayer-grid">
          <div className="tv-panel tv-empty">לא הוגדרו מניינים להיום</div>
          <ZmanimPanel zmanim={zmanim} now={now} />
        </div>
      </section>
    );
  }

  if (slide.layout === "next") {
    const next = nextIndex >= 0 ? slide.rows[nextIndex] : null;
    const rest = slide.rows.filter((_, i) => i !== nextIndex && (nextIndex < 0 || i > nextIndex)).slice(0, 6);
    return (
      <section className="tv-slide">
        {heading}
        <div className="tv-next-grid">
          <div className="tv-panel tv-hero">
            {next ? (
              <>
                <div className="tv-hero-kicker">המניין הבא · {prayerLabel(slide.subcategories, next.minyan.prayer)}</div>
                <div className="tv-hero-title">{next.minyan.label}</div>
                <div className="tv-hero-time">{next.time}</div>
                <div className="tv-hero-until">{untilLabel(next.minutes - nowMin)}</div>
                {(next.minyan.room || next.minyan.note) && (
                  <div className="tv-hero-meta">{[next.minyan.room, next.minyan.note].filter(Boolean).join(" · ")}</div>
                )}
              </>
            ) : (
              <>
                <div className="tv-hero-kicker">להיום</div>
                <div className="tv-hero-title">המניינים הסתיימו</div>
                <div className="tv-hero-meta">להתראות מחר</div>
              </>
            )}
            {rest.length > 0 && (
              <div className="tv-chip-row">
                {rest.map((r) => (
                  <div key={r.minyan.id} className="tv-chip">
                    <span className="tv-chip-time">{r.time}</span>
                    <span>{r.minyan.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <ZmanimPanel zmanim={zmanim} now={now} />
        </div>
      </section>
    );
  }

  if (slide.layout === "timeline") {
    return (
      <section className="tv-slide">
        {heading}
        <ol className={`tv-timeline${slide.rows.length > 7 ? " is-two-col" : ""}`} style={twoColRows(slide.rows.length)}>
          {slide.rows.map((r, i) => (
            <li
              key={r.minyan.id}
              className={`tv-tl-row${i === nextIndex ? " is-next" : ""}${nextIndex === -1 || i < nextIndex ? " is-past" : ""}`}
            >
              <span className="tv-tl-dot" />
              <span className="tv-tl-time">{r.time}</span>
              <span className="tv-tl-body">
                <span className="tv-tl-kind">{prayerLabel(slide.subcategories, r.minyan.prayer)}</span>
                <span className="tv-tl-name">{r.minyan.label}</span>
              </span>
              {i === nextIndex && <span className="tv-badge">הבא</span>}
            </li>
          ))}
        </ol>
      </section>
    );
  }

  // split
  return (
    <section className="tv-slide">
      {heading}
      <div className="tv-prayer-grid">
        <div className="tv-panel">
          <h3 className="tv-panel-title">מניינים</h3>
          <ul className={`tv-minyan-list${slide.rows.length > 7 ? " is-two-col" : ""}`} style={twoColRows(slide.rows.length)}>
            {slide.rows.map((r: ResolvedMinyan, i) => (
              <li
                key={r.minyan.id}
                className={`tv-minyan-row${i === nextIndex ? " is-next" : ""}${nextIndex === -1 || i < nextIndex ? " is-past" : ""}`}
              >
                <span className="tv-minyan-name">
                  {r.minyan.label}
                  {i === nextIndex && <span className="tv-badge">הבא</span>}
                  <span className="tv-minyan-source">{r.source}</span>
                </span>
                <span className="tv-minyan-time">{r.time}</span>
              </li>
            ))}
          </ul>
        </div>
        <ZmanimPanel zmanim={zmanim} now={now} />
      </div>
    </section>
  );
}

function ZmanimPanel({ zmanim, now }: { zmanim: Zmanim; now: Date }) {
  const nowMs = now.getTime();
  const nextEvent = SHOWN_ZMANIM.find((e) => (zmanim[e]?.getTime() ?? 0) > nowMs);
  return (
    <div className="tv-panel">
      <h3 className="tv-panel-title">זמני היום</h3>
      <dl className="tv-zman-list">
        {SHOWN_ZMANIM.map((event) => {
          const t = zmanim[event];
          const past = t ? t.getTime() <= nowMs : false;
          return (
            <div className={`tv-zman-row${event === nextEvent ? " is-next" : ""}${past ? " is-past" : ""}`} key={event}>
              <dt>{ZMAN_LABELS[event]}</dt>
              <dd>{formatTime(t)}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

/* ---------------------------------------------------------------- learning */

function whenLabel(inDays: number, date: Date): string {
  const weekday = new Intl.DateTimeFormat("he-IL", { weekday: "long" }).format(date);
  if (inDays === 0) return "היום";
  if (inDays === 1) return `מחר · ${weekday}`;
  if (inDays === 2) return `מחרתיים · ${weekday}`;
  return `${weekday} · בעוד ${inDays} ימים`;
}

function LearningSlide({ layout, now }: { layout: string; now: Date }) {
  const dayKey = now.toDateString();
  const facts = useMemo(() => {
    const day = new Date(dayKey);
    return { parasha: weeklyParasha(day), daf: dafYomi(day), upcoming: upcomingDays(day) };
  }, [dayKey]);

  const parashaName = facts.parasha?.replace(/^פרשת\s+/, "") ?? "—";

  if (layout === "hero") {
    return (
      <section className="tv-slide tv-learning-hero">
        <div className="tv-hero-kicker">פרשת השבוע</div>
        <div className="tv-parasha-huge">{parashaName}</div>
        <div className="tv-learning-strip">
          {facts.daf && (
            <div className="tv-panel tv-mini">
              <span className="tv-mini-label">הדף היומי</span>
              <span className="tv-mini-value">{facts.daf.label}</span>
            </div>
          )}
          {facts.upcoming.slice(0, 3).map((u) => (
            <div key={u.title + u.inDays} className={`tv-panel tv-mini${u.major ? " is-major" : ""}`}>
              <span className="tv-mini-label">{whenLabel(u.inDays, u.date)}</span>
              <span className="tv-mini-value">{u.title}</span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="tv-slide">
      <h2 className="tv-slide-heading">לימוד יומי ולוח שנה</h2>
      <div className="tv-learning-grid">
        <div className="tv-panel tv-feature">
          <span className="tv-feature-label">פרשת השבוע</span>
          <span className="tv-feature-value">{parashaName}</span>
        </div>
        <div className="tv-panel tv-feature">
          <span className="tv-feature-label">הדף היומי</span>
          <span className="tv-feature-value">{facts.daf?.label ?? "—"}</span>
        </div>
        <div className="tv-panel tv-upcoming">
          <h3 className="tv-panel-title">בימים הקרובים</h3>
          {facts.upcoming.length === 0 ? (
            <p className="tv-empty">אין מועדים בשלושת השבועות הקרובים</p>
          ) : (
            <ul>
              {facts.upcoming.map((u) => (
                <li key={u.title + u.inDays} className={u.major ? "is-major" : ""}>
                  <span className="tv-up-title">{u.title}</span>
                  <span className="tv-up-when">{whenLabel(u.inDays, u.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- announcements */

function AnnouncementCard({ item, large }: { item: Announcement; large?: boolean }) {
  return (
    <article className={`tv-card${item.pinned ? " is-pinned" : ""}${large ? " is-large" : ""}${item.image_url ? " has-image" : ""}`}>
      {item.image_url && <img className="tv-card-image" src={item.image_url} alt="" />}
      <div className="tv-card-text">
        <h3 className="tv-card-title">{item.title}</h3>
        <p className="tv-card-body">{item.body}</p>
      </div>
    </article>
  );
}

function AnnouncementsSlide({ slide }: { slide: Extract<BoardSlide, { kind: "announcements" }> }) {
  const spotlight = slide.layout === "spotlight";
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
      {spotlight ? (
        <div className="tv-spotlight">{slide.items[0] && <AnnouncementCard item={slide.items[0]} large />}</div>
      ) : (
        <div className="tv-cards" data-count={slide.items.length}>
          {slide.items.map((a) => (
            <AnnouncementCard key={a.id} item={a} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ----------------------------------------------------------------- shiurim */

function ShiurimSlide({ slide, now }: { slide: Extract<BoardSlide, { kind: "shiurim" }>; now: Date }) {
  const nowMin = jerusalemMinutes(now);
  const nextIndex = slide.items.findIndex((s) => shiurMinutes(s.time_text) >= nowMin);
  const state = (s: Shiur, i: number) =>
    `${i === nextIndex ? " is-next" : ""}${shiurMinutes(s.time_text) < nowMin ? " is-past" : ""}`;

  return (
    <section className="tv-slide">
      <h2 className="tv-slide-heading">
        שיעורי תורה <small>היום</small>
      </h2>
      {slide.layout === "cards" ? (
        <div className="tv-shiur-cards">
          {slide.items.map((s, i) => (
            <article key={s.id} className={`tv-panel tv-shiur-card${state(s, i)}`}>
              <span className="tv-shiur-time">{s.time_text}</span>
              <span className="tv-shiur-title">{s.title}</span>
              <span className="tv-shiur-teacher">{s.teacher}</span>
              {s.location && <span className="tv-shiur-meta">{s.location}</span>}
            </article>
          ))}
        </div>
      ) : (
        <ul className="tv-shiur-list">
          {slide.items.map((s, i) => (
            <li className={`tv-shiur-row${state(s, i)}`} key={s.id}>
              <span className="tv-shiur-time">{s.time_text}</span>
              <span>
                <span className="tv-shiur-title">
                  {s.title}
                  {i === nextIndex && <span className="tv-badge">הבא</span>}
                </span>
                {(s.location || s.description) && (
                  <span className="tv-shiur-meta">{[s.location, s.description].filter(Boolean).join(" · ")}</span>
                )}
              </span>
              <span className="tv-shiur-teacher">{s.teacher}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* --------------------------------------------------------------- slideshow */

function SlideshowSlide({
  slide,
  paused,
}: {
  slide: Extract<BoardSlide, { kind: "slideshow" }>;
  paused: boolean;
}) {
  const n = slide.images.length;
  const [active, setActive] = useState(0);
  // Own timer, restarted per pass (the slide is re-keyed each time it shows).
  useEffect(() => {
    if (paused || n <= 1) return;
    const id = window.setInterval(() => setActive((a) => Math.min(n - 1, a + 1)), slide.secondsPerImage * 1000);
    return () => window.clearInterval(id);
  }, [paused, n, slide.secondsPerImage]);
  return (
    <section className={`tv-slide tv-slideshow is-${slide.layout}`}>
      {slide.images.map((img, i) => (
        <figure
          key={img.url + i}
          className={`tv-show-item${i === active ? " is-active" : ""}`}
          style={{ animationDuration: `${slide.secondsPerImage + 2}s` }}
        >
          <img src={img.url} alt="" />
          {img.caption && <figcaption>{img.caption}</figcaption>}
        </figure>
      ))}
    </section>
  );
}
