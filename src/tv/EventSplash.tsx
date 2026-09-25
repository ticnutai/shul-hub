import { useMemo, type ReactNode } from "react";
import type { MinyanCategory } from "@community/lib/data";
import { HDate } from "@hebcal/core";
import { formatTime, type Zmanim } from "@community/lib/zmanim";
import {
  boardSpecialDay,
  specialZmanim,
  type SpecialDayDef,
  type SpecialGroup,
} from "@community/lib/specialDays";
import type { TvConfig } from "./config";
import { BUILTIN_VARIANTS, eventSlides } from "./eventSlides";

/**
 * The special day on the wall: its pictures, its name and its own times
 * (a fast's start and end, צאת החג), over the board for 15 seconds every
 * minute and a half, all day long. Shown for a day the gabbai set up (an
 * active tab of its own, or pictures he uploaded); national days never.
 *
 * A day can have several pictures; they take turns, crossfading every few
 * seconds. A day without uploaded pictures gets three built-in designs -
 * "זוהר", "מסגרת זהב" and "לילה" - in its own colours with its own emblems
 * (a menorah for Chanukah, a sukkah and the four species for Sukkot, a
 * shofar and a pomegranate for Rosh Hashana...). They are drawn here, one SVG
 * each, so nothing is downloaded and they are sharp on any screen.
 */

const CYCLE_SECONDS = 90;
const SHOW_SECONDS = 15;
const SLIDE_SECONDS = 5;

/* ----------------------------------------------------------- palettes -- */

type Palette = { deep: string; mid: string; gold: string; ink: string };

const PALETTE: Record<SpecialGroup, Palette> = {
  noraim: { deep: "#0b1733", mid: "#27457a", gold: "#f0cf73", ink: "#fbf3da" },
  sukkot: { deep: "#132a12", mid: "#3f6b25", gold: "#f3d57a", ink: "#fbf6df" },
  chanukah_purim: { deep: "#0b1d4d", mid: "#2a56aa", gold: "#ffd35c", ink: "#fff8e1" },
  pesach_shavuot: { deep: "#2e1f0b", mid: "#7c5c25", gold: "#f7dd92", ink: "#fff8e6" },
  fasts: { deep: "#14171d", mid: "#3a404b", gold: "#d8dde6", ink: "#eef1f5" },
  shabbatot: { deep: "#150f36", mid: "#44348a", gold: "#f3d57b", ink: "#fbf5e0" },
  other: { deep: "#0b2f30", mid: "#2b6d69", gold: "#f2df9f", ink: "#f6f7ee" },
  national: { deep: "#0b2a66", mid: "#2a64c6", gold: "#ffffff", ink: "#ffffff" },
};

const PURIM = new Set(["purim", "erev_purim", "shushan_purim"]);
function paletteFor(def: SpecialDayDef): Palette {
  if (PURIM.has(def.key)) return { deep: "#2a0f3d", mid: "#7a2f8f", gold: "#ffd35c", ink: "#fff3fb" };
  if (def.key === "tisha_bav" || def.key === "erev_tisha_bav") return { deep: "#0d0d10", mid: "#2b2b31", gold: "#c9ccd3", ink: "#e8e9ec" };
  return PALETTE[def.group];
}

/* ------------------------------------------------------------ emblems -- */

/** Each emblem is drawn in a 200×200 box, in `c`. */
type EmblemFn = (c: string) => ReactNode;
const line = (c: string, w = 5) => ({ fill: "none", stroke: c, strokeWidth: w, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });
const flame = (x: number, y: number, c: string, s = 1) => (
  <path d={`M${x} ${y} q${7 * s} ${10 * s} 0 ${18 * s} q${-7 * s} ${-8 * s} 0 ${-18 * s}`} fill={c} />
);

const EMBLEMS: Record<string, EmblemFn> = {
  menorah: (c) => (
    <g>
      {[-72, -54, -36, -18, 18, 36, 54, 72].map((x) => (
        <g key={x}>
          <path d={`M${100 + x} 62 V${80 + Math.abs(x) * 0.45}`} {...line(c)} />
          {flame(100 + x, 42, c)}
        </g>
      ))}
      <path d="M100 42 V150 M26 80 Q100 180 174 80" {...line(c)} />
      {flame(100, 20, c, 1.2)}
      <path d="M66 184 H134 M100 150 V184" {...line(c, 6)} />
    </g>
  ),
  dreidel: (c) => (
    <g>
      <path d="M100 30 V58 M70 58 H130 L130 130 L100 172 L70 130 Z" {...line(c)} />
      <text x="100" y="118" textAnchor="middle" fontSize="44" fontWeight="700" fill={c} fontFamily="serif">נ</text>
    </g>
  ),
  shofar: (c) => (
    <g>
      <path d="M22 150 C58 76 128 50 180 38 L186 64 C138 76 84 108 50 164 Z" {...line(c)} />
      <path d="M160 44 L167 69 M128 55 L137 82 M96 72 L108 98 M68 96 L82 118" {...line(c, 3)} />
    </g>
  ),
  pomegranate: (c) => (
    <g>
      <circle cx="100" cy="112" r="58" {...line(c)} />
      <path d="M80 56 L86 40 L94 54 L100 36 L106 54 L114 40 L120 56" {...line(c)} />
      {[[82, 100], [102, 92], [118, 108], [90, 124], [110, 130], [128, 128], [74, 120]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="5" fill={c} />
      ))}
    </g>
  ),
  gates: (c) => (
    <g>
      <path d="M36 184 V96 Q36 40 100 40 Q164 40 164 96 V184" {...line(c)} />
      <path d="M100 42 V184 M36 184 H164" {...line(c)} />
      <path d="M58 184 V104 Q58 64 92 60 M142 184 V104 Q142 64 108 60" {...line(c, 3)} />
      <circle cx="88" cy="126" r="4" fill={c} />
      <circle cx="112" cy="126" r="4" fill={c} />
    </g>
  ),
  candles2: (c) => (
    <g>
      <rect x="62" y="80" width="26" height="100" rx="5" {...line(c)} />
      <rect x="112" y="80" width="26" height="100" rx="5" {...line(c)} />
      {flame(75, 46, c, 1.5)}
      {flame(125, 46, c, 1.5)}
      <path d="M40 184 H160" {...line(c, 6)} />
    </g>
  ),
  candle: (c) => (
    <g>
      <rect x="84" y="80" width="32" height="104" rx="6" {...line(c)} />
      {flame(100, 34, c, 2)}
    </g>
  ),
  sukkah: (c) => (
    <g>
      <path d="M34 82 V184 H166 V82" {...line(c)} />
      <path d="M22 82 H178" {...line(c)} />
      {[30, 52, 74, 96, 118, 140, 162].map((x) => (
        <path key={x} d={`M${x - 10} 72 L${x + 10} 58`} {...line(c, 4)} />
      ))}
      <path d="M84 184 V130 H116 V184" {...line(c, 4)} />
      <circle cx="60" cy="118" r="7" fill={c} />
      <circle cx="140" cy="118" r="7" fill={c} />
    </g>
  ),
  lulav: (c) => (
    <g>
      <path d="M100 190 V20" {...line(c, 6)} />
      <path d="M100 150 Q70 120 64 70 M100 150 Q130 120 136 70" {...line(c, 4)} />
      {[70, 90, 110].map((y) => (
        <path key={y} d={`M100 ${y} q-18 -8 -22 -24 M100 ${y} q18 -8 22 -24`} {...line(c, 3)} />
      ))}
      <ellipse cx="152" cy="160" rx="24" ry="18" {...line(c)} />
    </g>
  ),
  torah: (c) => (
    <g>
      <rect x="44" y="50" width="112" height="120" rx="6" {...line(c)} />
      <path d="M44 36 V184 M156 36 V184" {...line(c, 8)} />
      {[76, 96, 116, 136].map((y) => (
        <path key={y} d={`M64 ${y} H136`} {...line(c, 3)} />
      ))}
    </g>
  ),
  mask: (c) => (
    <g>
      <path d="M20 90 Q100 50 180 90 Q176 150 128 150 Q108 150 100 124 Q92 150 72 150 Q24 150 20 90 Z" {...line(c)} />
      <ellipse cx="66" cy="102" rx="18" ry="11" fill={c} />
      <ellipse cx="134" cy="102" rx="18" ry="11" fill={c} />
      <path d="M180 90 Q196 60 176 40" {...line(c, 4)} />
    </g>
  ),
  megillah: (c) => (
    <g>
      <rect x="36" y="60" width="128" height="96" rx="4" {...line(c)} />
      <circle cx="36" cy="108" r="16" {...line(c)} />
      {[80, 100, 120, 140].map((y) => (
        <path key={y} d={`M64 ${y} H148`} {...line(c, 3)} />
      ))}
    </g>
  ),
  cup: (c) => (
    <g>
      <path d="M52 40 H148 Q148 118 100 124 Q52 118 52 40 Z" {...line(c)} />
      <path d="M100 124 V168 M66 176 H134" {...line(c, 6)} />
      <path d="M60 64 H140" {...line(c, 3)} />
    </g>
  ),
  matzah: (c) => (
    <g>
      <rect x="30" y="50" width="140" height="120" rx="10" {...line(c)} />
      {[70, 90, 110, 130, 150].map((y) => (
        <g key={y}>
          {[50, 70, 90, 110, 130, 150].map((x) => (
            <circle key={x} cx={x} cy={y} r="3" fill={c} />
          ))}
        </g>
      ))}
    </g>
  ),
  tablets: (c) => (
    <g>
      <path d="M28 186 V70 Q28 30 64 30 Q98 30 98 70 V186 Z M102 186 V70 Q102 30 136 30 Q172 30 172 70 V186 Z" {...line(c)} />
      {[80, 104, 128, 152].map((y) => (
        <path key={y} d={`M44 ${y} H82 M118 ${y} H156`} {...line(c, 3)} />
      ))}
    </g>
  ),
  wheat: (c) => (
    <g>
      {[-36, 0, 36].map((dx) => (
        <g key={dx} transform={`translate(${dx} 0)`}>
          <path d="M100 190 V40" {...line(c, 4)} />
          {[52, 72, 92, 112].map((y) => (
            <path key={y} d={`M100 ${y} q-14 -4 -16 -20 M100 ${y} q14 -4 16 -20`} {...line(c, 3)} />
          ))}
        </g>
      ))}
    </g>
  ),
  moon: (c) => (
    <g>
      <path d="M126 30 A76 76 0 1 0 126 170 A58 58 0 1 1 126 30 Z" fill={c} />
      {[[160, 60], [174, 110], [150, 150]].map(([x, y]) => (
        <circle key={`${x}`} cx={x} cy={y} r="4" fill={c} />
      ))}
    </g>
  ),
  fire: (c) => (
    <g>
      <path d="M100 30 Q150 90 128 150 Q146 120 150 100 Q170 150 132 184 H68 Q30 150 50 100 Q54 120 72 150 Q50 90 100 30 Z" {...line(c)} />
      <path d="M44 186 L156 160 M44 160 L156 186" {...line(c, 6)} />
    </g>
  ),
  tree: (c) => (
    <g>
      <path d="M100 190 V110 M100 140 L72 116 M100 128 L128 104" {...line(c, 6)} />
      <circle cx="100" cy="76" r="52" {...line(c)} />
      {[[80, 64], [118, 58], [104, 92], [74, 96]].map(([x, y]) => (
        <circle key={`${x}`} cx={x} cy={y} r="6" fill={c} />
      ))}
    </g>
  ),
  heart: (c) => (
    <path d="M100 176 C40 128 20 96 40 66 C60 38 92 46 100 72 C108 46 140 38 160 66 C180 96 160 128 100 176 Z" {...line(c)} />
  ),
  star: (c) => <path d="M100 16 L172 142 H28 Z M100 184 L28 58 H172 Z" {...line(c)} />,
  wall: (c) => (
    <g>
      {[0, 1, 2, 3].map((r) => (
        <g key={r}>
          {[0, 1, 2].map((k) => (
            <rect key={k} x={24 + k * 52 + (r % 2) * 26} y={60 + r * 30} width="48" height="26" rx="3" {...line(c, 3)} />
          ))}
        </g>
      ))}
      {flame(100, 20, c, 1.4)}
    </g>
  ),
};

/** Which emblems each day draws, first to last variant. */
function emblemsFor(def: SpecialDayDef): string[] {
  const k = def.key;
  if (k === "chanukah") return ["menorah", "dreidel", "menorah"];
  if (k.includes("rosh_hashana")) return ["shofar", "pomegranate", "shofar"];
  if (k.includes("yom_kippur")) return ["gates", "candles2", "gates"];
  if (k === "shmini_atzeret") return ["torah", "lulav", "sukkah"];
  if (def.group === "sukkot") return ["sukkah", "lulav", "sukkah"];
  if (PURIM.has(k)) return ["mask", "megillah", "mask"];
  if (k === "shavuot" || k === "erev_shavuot") return ["tablets", "wheat", "tablets"];
  if (def.group === "pesach_shavuot" || k === "pesach_sheni") return ["cup", "matzah", "cup"];
  if (k === "tisha_bav" || k === "erev_tisha_bav") return ["wall", "candle", "wall"];
  if (def.group === "fasts") return ["candle", "star", "candle"];
  if (def.group === "shabbatot" || def.group === "noraim") return ["candles2", "star", "candles2"];
  if (k === "rosh_chodesh") return ["moon", "star", "moon"];
  if (k === "lag_baomer") return ["fire", "star", "fire"];
  if (k === "tu_bishvat") return ["tree", "star", "tree"];
  if (k === "tu_bav") return ["heart", "star", "heart"];
  return ["star", "star", "star"];
}

/* ------------------------------------------------------------ designs -- */

/** A small deterministic sequence (so the stars are the same on every screen). */
function seeded(n: number, seed: number): number[] {
  let x = seed;
  return Array.from({ length: n }, () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  });
}

/**
 * One built-in design, a full-screen SVG (1600×900). The right side is left
 * calm for the card with the name and times; the emblem sits on the left.
 */
export function DefaultArt({ def, variant = 0 }: { def: SpecialDayDef; variant?: number }) {
  const p = paletteFor(def);
  const v = ((variant % BUILTIN_VARIANTS) + BUILTIN_VARIANTS) % BUILTIN_VARIANTS;
  const emblem = EMBLEMS[emblemsFor(def)[v] ?? "star"]!;
  const id = `ev-${def.key}-${v}`;

  const emblemAt = (x: number, y: number, size: number, glow: boolean) => (
    <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${size / 200})`} filter={glow ? `url(#${id}-glow)` : undefined}>
      {emblem(p.gold)}
    </g>
  );

  return (
    <svg className="tv-event-art" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id={`${id}-bg`} cx={v === 1 ? "50%" : "30%"} cy="40%" r="85%">
          <stop offset="0%" stopColor={p.mid} />
          <stop offset="100%" stopColor={p.deep} />
        </radialGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={p.gold} />
          <stop offset="50%" stopColor={p.ink} />
          <stop offset="100%" stopColor={p.gold} />
        </linearGradient>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="10" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern id={`${id}-pat`} width="120" height="120" patternUnits="userSpaceOnUse">
          <path d="M60 18 L84 60 H36 Z M60 102 L36 60 H84 Z" fill="none" stroke={p.gold} strokeOpacity="0.09" strokeWidth="2" />
        </pattern>
      </defs>
      <rect width="1600" height="900" fill={`url(#${id}-bg)`} />

      {v === 0 && (
        // "זוהר": a soft glow, the star pattern, the emblem in a halo.
        <g>
          <rect width="1600" height="900" fill={`url(#${id}-pat)`} />
          <circle cx="480" cy="430" r="330" fill={p.gold} opacity="0.08" />
          <circle cx="480" cy="430" r="250" fill="none" stroke={p.gold} strokeOpacity="0.35" strokeWidth="3" />
          <circle cx="480" cy="430" r="268" fill="none" stroke={p.gold} strokeOpacity="0.18" strokeWidth="1.5" />
          {emblemAt(480, 430, 380, true)}
        </g>
      )}

      {v === 1 && (
        // "מסגרת זהב": a double gold frame with rosettes, the emblem centred high.
        <g>
          <rect x="40" y="40" width="1520" height="820" rx="18" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="8" />
          <rect x="64" y="64" width="1472" height="772" rx="12" fill="none" stroke={p.gold} strokeOpacity="0.55" strokeWidth="2.5" />
          {[
            [64, 64],
            [1536, 64],
            [64, 836],
            [1536, 836],
          ].map(([x, y]) => (
            <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
              <circle r="30" fill={p.deep} stroke={p.gold} strokeWidth="4" />
              <path d="M0 -18 L10 0 L0 18 L-10 0 Z M-18 0 L0 10 L18 0 L0 -10 Z" fill={p.gold} />
            </g>
          ))}
          <path d="M480 160 H1120" stroke={`url(#${id}-gold)`} strokeWidth="3" />
          <path d="M620 176 H980" stroke={p.gold} strokeOpacity="0.5" strokeWidth="1.5" />
          {emblemAt(480, 470, 440, true)}
        </g>
      )}

      {v === 2 && (
        // "לילה": a starry sky, gold arcs on the horizon, the emblem glowing.
        <g>
          {seeded(140, def.key.length * 31 + 7).map((r, i, a) => {
            const x = (r * 1600 + i * 37) % 1600;
            const y = ((a[(i + 17) % a.length]! * 620 + i * 11) % 620) + 10;
            return <circle key={i} cx={x} cy={y} r={0.8 + (i % 4) * 0.6} fill={p.ink} opacity={0.25 + (i % 5) * 0.12} />;
          })}
          <path d="M0 820 Q800 600 1600 820" fill="none" stroke={p.gold} strokeOpacity="0.5" strokeWidth="3" />
          <path d="M0 860 Q800 660 1600 860" fill="none" stroke={p.gold} strokeOpacity="0.25" strokeWidth="2" />
          <circle cx="470" cy="420" r="230" fill={p.gold} opacity="0.12" filter={`url(#${id}-glow)`} />
          {emblemAt(470, 420, 410, true)}
        </g>
      )}
    </svg>
  );
}

export function EventSplash({
  categories,
  config,
  now,
  zmanim,
  force = false,
  day,
}: {
  categories: Pick<MinyanCategory, "system_key" | "active">[] | undefined;
  config: Pick<TvConfig, "eventImages" | "eventSplash">;
  now: Date;
  zmanim: Zmanim;
  /** Always show (the admin's preview). */
  force?: boolean;
  /** Show this day, whatever today is (the admin's preview). */
  day?: SpecialDayDef;
}) {
  const dayKey = now.toDateString();
  // Once a day is enough: `now` ticks every second, the special day does not.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const found = useMemo(() => boardSpecialDay(categories, config, now), [categories, config, dayKey]);
  const def = day ?? found;
  const seconds = Math.floor(now.getTime() / 1000);
  const phase = seconds % CYCLE_SECONDS;
  if (!def || (!config.eventSplash && !force)) return null;
  if (!force && phase >= SHOW_SECONDS) return null;
  const slides = eventSlides(config.eventImages[def.key]);
  // Each appearance moves on through the pictures; within it, a new one every few seconds.
  const step = force
    ? Math.floor(seconds / SLIDE_SECONDS)
    : Math.floor(seconds / CYCLE_SECONDS) * Math.ceil(SHOW_SECONDS / SLIDE_SECONDS) + Math.floor(phase / SLIDE_SECONDS);
  const active = step % slides.length;
  const rows = specialZmanim(now, zmanim);
  return (
    <div className="tv-event-splash" role="region" aria-label={def.name}>
      {slides.map((s, i) => (
        <div key={i} className={`tv-event-layer${i === active ? " is-active" : ""}`} data-slide={i}>
          {"image" in s ? <div className="tv-event-photo" style={{ backgroundImage: `url("${s.image}")` }} /> : <DefaultArt def={def} variant={s.variant} />}
        </div>
      ))}
      <div className="tv-event-card">
        <div className="tv-event-date">{new HDate(now).renderGematriya(true)}</div>
        <div className="tv-event-title">{def.name}</div>
        {rows.length > 0 && (
          <dl className="tv-event-times">
            {rows.map((r) => (
              <div key={r.key}>
                <dt>{r.label}</dt>
                <dd>{formatTime(r.time)}</dd>
              </div>
            ))}
          </dl>
        )}
        {slides.length > 1 && (
          <div className="tv-event-dots" aria-hidden>
            {slides.map((_, i) => (
              <span key={i} className={i === active ? "is-active" : ""} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
