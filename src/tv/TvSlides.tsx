import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { prayerLabel, type Announcement, type Shiur } from "@community/lib/data";
import type { ResolvedMinyan } from "@community/lib/minyan-time";
import { formatTime, ZMAN_LABELS, type Zmanim } from "@community/lib/zmanim";
import { SHOWN_ZMANIM, useBoardEdit, type BoardEditApi } from "./boardEdit";
import type { FlipArea } from "./config";
import { dafYomi, upcomingDays, weeklyParasha } from "./learning";
import { ShabbatSlide } from "./ShabbatScene";
import { jerusalemMinutes, shiurMinutes, type BoardSlide } from "./useBoardData";

/**
 * The slide bodies. Pure presentation: everything they need arrives as props,
 * so the admin preview can render any slide, in any layout, at any time.
 *
 * Wording, hidden elements and swapped panels come from the admin through
 * useBoardEdit() (boardEdit.ts); `edit.attr(key)` marks an element for the
 * editor's click-to-edit and renders nothing on the TV.
 */

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

/**
 * Side-by-side panels: drops the hidden ones, swaps the order when the admin
 * moved them, and gives the grid matching column widths - as --cols, so the
 * portrait layout (tv.css) can still force a single column.
 */
function panelGrid(
  edit: BoardEditApi,
  area: FlipArea,
  panels: Array<{ key: string; width: number; node: ReactNode }>,
): { style: CSSProperties; nodes: ReactNode[] } {
  const shown = panels.filter((p) => !edit.hidden(p.key));
  const ordered = edit.flipped(area) ? [...shown].reverse() : shown;
  return {
    style: { "--cols": ordered.map((p) => `${p.width}fr`).join(" ") || "1fr" } as CSSProperties,
    nodes: ordered.map((p) => <PanelSlot key={p.key}>{p.node}</PanelSlot>),
  };
}

function PanelSlot({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function SlideHeading({ k, fallback, children }: { k: string; fallback: string; children?: ReactNode }) {
  const edit = useBoardEdit();
  if (edit.hidden(k)) return null;
  return (
    <h2 className="tv-slide-heading" {...edit.attr(k)}>
      {edit.text(k, fallback)} {children}
    </h2>
  );
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
    case "shabbat":
      return <ShabbatSlide times={slide.times} now={now} scenes={slide.scenes} secondsPerScene={slide.secondsPerScene} paused={paused} />;
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
  const edit = useBoardEdit();
  const nowMin = jerusalemMinutes(now);
  const nextIndex = slide.rows.findIndex((r) => r.minutes >= nowMin);
  const heading = (
    <SlideHeading k="heading.prayer" fallback="זמני התפילות">
      {slide.title && <small>{slide.title}</small>}
    </SlideHeading>
  );
  const zmanimPanel = { key: "panel.zmanim", width: 1, node: <ZmanimPanel zmanim={zmanim} now={now} /> };
  const label = (r: ResolvedMinyan) => <span {...edit.attr(`minyan:${r.minyan.id}:label`)}>{r.minyan.label}</span>;

  if (slide.rows.length === 0) {
    const grid = panelGrid(edit, "prayer", [
      { key: "panel.minyanim-empty", width: 1.4, node: <div className="tv-panel tv-empty">לא הוגדרו מניינים להיום</div> },
      zmanimPanel,
    ]);
    return (
      <section className="tv-slide">
        {heading}
        <div className="tv-prayer-grid" style={grid.style}>
          {grid.nodes}
        </div>
      </section>
    );
  }

  if (slide.layout === "next") {
    const next = nextIndex >= 0 ? slide.rows[nextIndex] : null;
    const rest = slide.rows.filter((_, i) => i !== nextIndex && (nextIndex < 0 || i > nextIndex)).slice(0, 6);
    const hero = (
      <div className="tv-panel tv-hero" {...edit.attr(next ? `minyan:${next.minyan.id}` : "hero.kicker")}>
        {next ? (
          <>
            <div className="tv-hero-kicker" {...edit.attr("hero.kicker")}>
              {edit.text("hero.kicker", "המניין הבא")} · {prayerLabel(slide.subcategories, next.minyan.prayer)}
            </div>
            <div className="tv-hero-title">{label(next)}</div>
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
          // After the last minyan these are the day's earlier ones - seen on
          // the TV listed under "המניינים הסתיימו" as if still to come.
          <div className="tv-chip-row">
            {!next && <span className="tv-chip-caption">היום היו:</span>}
            {rest.map((r) => (
              <div key={r.minyan.id} className={`tv-chip${next ? "" : " is-past"}`} {...edit.attr(`minyan:${r.minyan.id}`)}>
                <span className="tv-chip-time">{r.time}</span>
                {label(r)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
    const grid = panelGrid(edit, "prayer", [{ key: "panel.hero", width: 1.7, node: hero }, zmanimPanel]);
    return (
      <section className="tv-slide">
        {heading}
        <div className="tv-next-grid" style={grid.style}>
          {grid.nodes}
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
              {...edit.attr(`minyan:${r.minyan.id}`)}
            >
              <span className="tv-tl-dot" />
              <span className="tv-tl-time">{r.time}</span>
              <span className="tv-tl-body">
                <span className="tv-tl-kind">{prayerLabel(slide.subcategories, r.minyan.prayer)}</span>
                <span className="tv-tl-name">{label(r)}</span>
              </span>
              {i === nextIndex && <span className="tv-badge">הבא</span>}
            </li>
          ))}
        </ol>
      </section>
    );
  }

  // split
  const minyanim = (
    <div className="tv-panel">
      {!edit.hidden("panel.minyanim") && (
        <h3 className="tv-panel-title" {...edit.attr("panel.minyanim")}>
          {edit.text("panel.minyanim", "מניינים")}
        </h3>
      )}
      <ul className={`tv-minyan-list${slide.rows.length > 7 ? " is-two-col" : ""}`} style={twoColRows(slide.rows.length)}>
        {slide.rows.map((r: ResolvedMinyan, i) => (
          <li
            key={r.minyan.id}
            className={`tv-minyan-row${i === nextIndex ? " is-next" : ""}${nextIndex === -1 || i < nextIndex ? " is-past" : ""}`}
            {...edit.attr(`minyan:${r.minyan.id}`)}
          >
            <span className="tv-minyan-name">
              {label(r)}
              {i === nextIndex && <span className="tv-badge">הבא</span>}
              <span className="tv-minyan-source">{r.source}</span>
            </span>
            <span className="tv-minyan-time">{r.time}</span>
          </li>
        ))}
      </ul>
    </div>
  );
  const grid = panelGrid(edit, "prayer", [{ key: "panel.minyanim-list", width: 1.4, node: minyanim }, zmanimPanel]);
  return (
    <section className="tv-slide">
      {heading}
      <div className="tv-prayer-grid" style={grid.style}>
        {grid.nodes}
      </div>
    </section>
  );
}

function ZmanimPanel({ zmanim, now }: { zmanim: Zmanim; now: Date }) {
  const edit = useBoardEdit();
  const nowMs = now.getTime();
  const shown = SHOWN_ZMANIM.filter((e) => !edit.hidden(`zman.${e}`));
  const nextEvent = shown.find((e) => (zmanim[e]?.getTime() ?? 0) > nowMs);
  return (
    <div className="tv-panel" {...edit.attr("panel.zmanim")}>
      <h3 className="tv-panel-title">{edit.text("panel.zmanim", "זמני היום")}</h3>
      <dl className="tv-zman-list">
        {shown.map((event) => {
          const t = zmanim[event];
          const past = t ? t.getTime() <= nowMs : false;
          return (
            <div
              className={`tv-zman-row${event === nextEvent ? " is-next" : ""}${past ? " is-past" : ""}`}
              key={event}
              {...edit.attr(`zman.${event}`)}
            >
              <dt>{edit.text(`zman.${event}`, ZMAN_LABELS[event])}</dt>
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
  const edit = useBoardEdit();
  const dayKey = now.toDateString();
  const facts = useMemo(() => {
    const day = new Date(dayKey);
    return { parasha: weeklyParasha(day), daf: dafYomi(day), upcoming: upcomingDays(day) };
  }, [dayKey]);

  const parashaName = facts.parasha?.replace(/^פרשת\s+/, "") ?? "—";
  const parashaLabel = edit.text("learning.parasha", "פרשת השבוע");
  const dafLabel = edit.text("learning.daf", "הדף היומי");

  if (layout === "hero") {
    return (
      <section className="tv-slide tv-learning-hero">
        {!edit.hidden("learning.parasha") && (
          <>
            <div className="tv-hero-kicker" {...edit.attr("learning.parasha")}>
              {parashaLabel}
            </div>
            <div className="tv-parasha-huge" {...edit.attr("learning.parasha")}>
              {parashaName}
            </div>
          </>
        )}
        <div className="tv-learning-strip">
          {facts.daf && !edit.hidden("learning.daf") && (
            <div className="tv-panel tv-mini" {...edit.attr("learning.daf")}>
              <span className="tv-mini-label">{dafLabel}</span>
              <span className="tv-mini-value">{facts.daf.label}</span>
            </div>
          )}
          {!edit.hidden("learning.upcoming") &&
            facts.upcoming.slice(0, 3).map((u) => (
              <div key={u.title + u.inDays} className={`tv-panel tv-mini${u.major ? " is-major" : ""}`} {...edit.attr("learning.upcoming")}>
                <span className="tv-mini-label">{whenLabel(u.inDays, u.date)}</span>
                <span className="tv-mini-value">{u.title}</span>
              </div>
            ))}
        </div>
      </section>
    );
  }

  const grid = panelGrid(edit, "learning", [
    {
      key: "learning.parasha",
      width: 1,
      node: (
        <div className="tv-panel tv-feature" {...edit.attr("learning.parasha")}>
          <span className="tv-feature-label">{parashaLabel}</span>
          <span className="tv-feature-value">{parashaName}</span>
        </div>
      ),
    },
    {
      key: "learning.daf",
      width: 1,
      node: (
        <div className="tv-panel tv-feature" {...edit.attr("learning.daf")}>
          <span className="tv-feature-label">{dafLabel}</span>
          <span className="tv-feature-value">{facts.daf?.label ?? "—"}</span>
        </div>
      ),
    },
    {
      key: "learning.upcoming",
      width: 1.25,
      node: (
        <div className="tv-panel tv-upcoming" {...edit.attr("learning.upcoming")}>
          <h3 className="tv-panel-title">{edit.text("learning.upcoming", "בימים הקרובים")}</h3>
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
      ),
    },
  ]);

  return (
    <section className="tv-slide">
      <SlideHeading k="heading.learning" fallback="לימוד יומי ולוח שנה" />
      <div className="tv-learning-grid" style={grid.style}>
        {grid.nodes}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- announcements */

function AnnouncementCard({ item, large }: { item: Announcement; large?: boolean }) {
  const edit = useBoardEdit();
  return (
    <article
      className={`tv-card${item.pinned ? " is-pinned" : ""}${large ? " is-large" : ""}${item.image_url ? " has-image" : ""}`}
      {...edit.attr(`ann:${item.id}`)}
    >
      {item.image_url && <img className="tv-card-image" src={item.image_url} alt="" decoding="async" />}
      <div className="tv-card-text">
        <h3 className="tv-card-title" {...edit.attr(`ann:${item.id}:title`)}>
          {item.title}
        </h3>
        <p className="tv-card-body" {...edit.attr(`ann:${item.id}:body`)}>
          {item.body}
        </p>
      </div>
    </article>
  );
}

function AnnouncementsSlide({ slide }: { slide: Extract<BoardSlide, { kind: "announcements" }> }) {
  const spotlight = slide.layout === "spotlight";
  return (
    <section className="tv-slide">
      <SlideHeading k="heading.announcements" fallback="מודעות לציבור">
        {slide.pages > 1 && (
          <small>
            {slide.page} מתוך {slide.pages}
          </small>
        )}
      </SlideHeading>
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
  const edit = useBoardEdit();
  const nowMin = jerusalemMinutes(now);
  const nextIndex = slide.items.findIndex((s) => shiurMinutes(s.time_text) >= nowMin);
  const state = (s: Shiur, i: number) =>
    `${i === nextIndex ? " is-next" : ""}${shiurMinutes(s.time_text) < nowMin ? " is-past" : ""}`;
  const title = (s: Shiur) => <span {...edit.attr(`shiur:${s.id}:title`)}>{s.title}</span>;
  const teacher = (s: Shiur) => (
    <span className="tv-shiur-teacher" {...edit.attr(`shiur:${s.id}:teacher`)}>
      {s.teacher}
    </span>
  );

  return (
    <section className="tv-slide">
      <SlideHeading k="heading.shiurim" fallback="שיעורי תורה">
        <small>היום</small>
      </SlideHeading>
      {slide.layout === "cards" ? (
        <div className="tv-shiur-cards">
          {slide.items.map((s, i) => (
            <article key={s.id} className={`tv-panel tv-shiur-card${state(s, i)}`} {...edit.attr(`shiur:${s.id}`)}>
              <span className="tv-shiur-time">{s.time_text}</span>
              <span className="tv-shiur-title">{title(s)}</span>
              {teacher(s)}
              {s.location && <span className="tv-shiur-meta">{s.location}</span>}
            </article>
          ))}
        </div>
      ) : (
        <ul className="tv-shiur-list">
          {slide.items.map((s, i) => (
            <li className={`tv-shiur-row${state(s, i)}`} key={s.id} {...edit.attr(`shiur:${s.id}`)}>
              <span className="tv-shiur-time">{s.time_text}</span>
              <span>
                <span className="tv-shiur-title">
                  {title(s)}
                  {i === nextIndex && <span className="tv-badge">הבא</span>}
                </span>
                {(s.location || s.description) && (
                  <span className="tv-shiur-meta">{[s.location, s.description].filter(Boolean).join(" · ")}</span>
                )}
              </span>
              {teacher(s)}
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
          <img src={img.url} alt="" decoding="async" />
          {img.caption && <figcaption>{img.caption}</figcaption>}
        </figure>
      ))}
    </section>
  );
}
