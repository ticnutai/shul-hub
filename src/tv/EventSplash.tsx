import { useMemo } from "react";
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

/**
 * The special day on the wall: its picture, its name and its own times
 * (a fast's start and end, צאת החג), over the board for a few seconds now and
 * then, all day long. Shown for a day the gabbai set up (an active tab of its
 * own, or a picture he uploaded); national days never.
 *
 * A day without an uploaded picture gets a built-in design: its own colours
 * and a simple emblem, drawn here, so nothing needs to be downloaded.
 */

const CYCLE_SECONDS = 90;
const SHOW_SECONDS = 15;


const PALETTE: Record<SpecialGroup, [string, string, string]> = {
  noraim: ["#0f1d3a", "#2d4a7c", "#e8c66a"],
  sukkot: ["#1f3b1c", "#4f7a2e", "#f0d27a"],
  chanukah_purim: ["#10275a", "#2f5fb3", "#ffd35c"],
  pesach_shavuot: ["#3b2a12", "#8a6b2e", "#f6e7b8"],
  fasts: ["#1c1f26", "#454b57", "#d9dde5"],
  shabbatot: ["#1b1540", "#4a3a8c", "#f2d479"],
  other: ["#0f3a3a", "#2f7a74", "#f1e2a6"],
  national: ["#0d2d6b", "#2a64c6", "#ffffff"],
};

function Emblem({ def, color }: { def: SpecialDayDef; color: string }) {
  const s = { fill: "none", stroke: color, strokeWidth: 4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (def.key === "chanukah") {
    // A menorah: eight branches and the shamash.
    return (
      <svg viewBox="0 0 200 160" className="tv-event-emblem" aria-hidden>
        {[-70, -52, -34, -16, 16, 34, 52, 70].map((x) => (
          <g key={x}>
            <path d={`M${100 + x} 40 V${60 + Math.abs(x) * 0.5}`} {...s} />
            <path d={`M${100 + x} 28 q4 6 0 10 q-4 -4 0 -10`} fill={color} />
          </g>
        ))}
        <path d="M100 22 V120 M30 60 Q100 150 170 60" {...s} />
        <path d="M100 10 q5 7 0 12 q-5 -5 0 -12" fill={color} />
        <path d="M70 140 H130 M100 120 V140" {...s} />
      </svg>
    );
  }
  if (def.group === "noraim") {
    // A shofar.
    return (
      <svg viewBox="0 0 200 160" className="tv-event-emblem" aria-hidden>
        <path d="M30 120 C60 60 120 40 170 30 L176 52 C130 62 80 90 52 132 Z" {...s} />
        <path d="M150 35 L156 56 M120 44 L128 66 M92 58 L102 80" {...s} strokeWidth={3} />
      </svg>
    );
  }
  if (def.group === "sukkot") {
    // A sukkah: walls and the s'chach above.
    return (
      <svg viewBox="0 0 200 160" className="tv-event-emblem" aria-hidden>
        <path d="M40 60 V140 H160 V60" {...s} />
        <path d="M30 60 H170" {...s} />
        {[40, 60, 80, 100, 120, 140, 160].map((x) => (
          <path key={x} d={`M${x - 8} 50 L${x + 8} 42`} {...s} strokeWidth={3} />
        ))}
        <path d="M85 140 V100 H115 V140" {...s} strokeWidth={3} />
      </svg>
    );
  }
  if (def.group === "fasts") {
    // A single candle.
    return (
      <svg viewBox="0 0 200 160" className="tv-event-emblem" aria-hidden>
        <rect x="88" y="60" width="24" height="80" rx="4" {...s} />
        <path d="M100 30 q12 16 0 26 q-12 -10 0 -26" fill={color} />
      </svg>
    );
  }
  if (def.group === "pesach_shavuot") {
    // Stalks of wheat.
    return (
      <svg viewBox="0 0 200 160" className="tv-event-emblem" aria-hidden>
        {[-30, 0, 30].map((dx) => (
          <g key={dx} transform={`translate(${dx} 0)`}>
            <path d="M100 150 V40" {...s} />
            {[50, 66, 82, 98].map((y) => (
              <g key={y}>
                <path d={`M100 ${y} q-12 -4 -14 -16`} {...s} strokeWidth={3} />
                <path d={`M100 ${y} q12 -4 14 -16`} {...s} strokeWidth={3} />
              </g>
            ))}
          </g>
        ))}
      </svg>
    );
  }
  // Magen David.
  return (
    <svg viewBox="0 0 200 160" className="tv-event-emblem" aria-hidden>
      <path d="M100 18 L150 105 H50 Z M100 142 L50 55 H150 Z" {...s} />
    </svg>
  );
}

export function DefaultArt({ def }: { def: SpecialDayDef }) {
  const [a, b, ink] = PALETTE[def.group];
  return (
    <div
      className="tv-event-art"
      style={{
        background: `radial-gradient(circle at 70% 30%, ${b}, ${a} 70%)`,
        color: ink,
      }}
    >
      <svg className="tv-event-pattern" viewBox="0 0 80 80" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <pattern id={`p-${def.key}`} width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M20 6 L30 24 H10 Z M20 34 L10 16 H30 Z" fill="none" stroke={ink} strokeOpacity="0.12" strokeWidth="1.2" />
          </pattern>
        </defs>
        <rect width="80" height="80" fill={`url(#p-${def.key})`} />
      </svg>
      <Emblem def={def} color={ink} />
    </div>
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
  const found = useMemo(() => boardSpecialDay(categories, config, now), [categories, config, dayKey]);
  const def = day ?? found; // eslint-disable-line react-hooks/exhaustive-deps
  const phase = Math.floor(now.getTime() / 1000) % CYCLE_SECONDS;
  if (!def || (!config.eventSplash && !force)) return null;
  if (!force && phase >= SHOW_SECONDS) return null;
  const image = config.eventImages[def.key];
  const rows = specialZmanim(now, zmanim);
  return (
    <div className="tv-event-splash" role="region" aria-label={def.name}>
      {image ? <div className="tv-event-photo" style={{ backgroundImage: `url("${image}")` }} /> : <DefaultArt def={def} />}
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
      </div>
    </div>
  );
}
