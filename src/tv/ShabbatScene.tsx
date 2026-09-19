import { useEffect, useId, useMemo, useState } from "react";
import { formatTime } from "@community/lib/zmanim";
import { useBoardEdit } from "./boardEdit";
import { upcomingDays, weeklyParasha } from "./learning";
import { SHABBAT_ART, type ShabbatArtId, type ShabbatTimes } from "./shabbat";

/**
 * The Shabbat screen: shown alone, without rotation, from candle lighting on
 * Friday until Shabbat ends (buildSlides / shabbat.ts).
 *
 * Drawn as SVG, so it is sharp on any screen and costs no download. Two
 * things keep it kind to the TV box and the panel over ~25 hours on one
 * screen:
 *   - the flames flicker for about a minute and a half every 10 minutes and
 *     are still in between (an endless animation costs the box ~45% CPU);
 *   - the whole scene shifts slightly every 10 minutes (burn-in).
 */

/** Small offsets (cqw, cqh) stepped through every 10 minutes. */
const DRIFT: Array<[number, number]> = [
  [0, 0],
  [-0.6, 0.4],
  [0.5, -0.3],
  [-0.3, -0.5],
  [0.6, 0.5],
  [0.2, -0.2],
];

export function ShabbatSlide({
  times,
  now,
  scenes = ["art:classic"],
  secondsPerScene = 60,
  paused = false,
}: {
  times: ShabbatTimes;
  now: Date;
  scenes?: string[];
  secondsPerScene?: number;
  paused?: boolean;
}) {
  const edit = useBoardEdit();
  // The picture slideshow: one timer per slide, only when there is more
  // than one picture. Each switch is a finite fade, so the screen is still
  // between switches.
  const n = scenes.length;
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (paused || n <= 1) return;
    const id = window.setInterval(() => setActive((a) => (a + 1) % n), secondsPerScene * 1000);
    return () => window.clearInterval(id);
  }, [paused, n, secondsPerScene]);
  const scene = scenes[active % Math.max(1, n)] ?? "art:classic";
  const bucket = Math.floor(now.getTime() / 600_000);
  const [dx, dy] = DRIFT[bucket % DRIFT.length];

  const dayKey = now.toDateString();
  const { parasha, special } = useMemo(() => {
    const day = new Date(dayKey);
    // On Friday night the parasha is tomorrow's reading; on Saturday, today's.
    const saturday = day.getDay() === 5 ? new Date(day.getTime() + 86_400_000) : day;
    return {
      parasha: weeklyParasha(saturday),
      special:
        upcomingDays(saturday, 1, 4).find(
          (u) => u.inDays === 0 && /^שבת /.test(u.title) && u.title !== "שבת",
        )?.title ?? null,
    };
  }, [dayKey]);

  const rows = [
    { label: "הדלקת נרות", at: times.candle },
    { label: "סוף זמן ק״ש", at: times.shma },
    { label: "צאת השבת", at: times.end },
  ].filter((r) => r.at);

  return (
    // The drift sits on an inner box: .tv-slide keeps `transform` for its
    // entrance animation (fill-mode both), which would override it here.
    <section className="tv-slide tv-shabbat-slide">
      <div className="tv-shabbat" style={{ transform: `translate(${dx}cqw, ${dy}cqh)` }}>
        <div className="tv-shabbat-text">
          <h2 className="tv-shabbat-title" {...edit.attr("shabbat.title")}>
            {edit.text("shabbat.title", "שבת שלום")}
          </h2>
          {(parasha || special) && (
            <div className="tv-shabbat-parasha">
              {[parasha, special].filter(Boolean).join(" · ")}
            </div>
          )}
          {!edit.hidden("shabbat.blessing") && (
            <p className="tv-shabbat-blessing" {...edit.attr("shabbat.blessing")}>
              {edit.text(
                "shabbat.blessing",
                "בּוֹאִי בְשָׁלוֹם עֲטֶרֶת בַּעְלָהּ, גַּם בְּשִׂמְחָה וּבְצָהֳלָה",
              )}
            </p>
          )}
          {!edit.hidden("shabbat.times") && rows.length > 0 && (
            <dl className="tv-shabbat-times" {...edit.attr("shabbat.times")}>
              {rows.map((r) => (
                <div key={r.label} className="tv-shabbat-time">
                  <dt>{r.label}</dt>
                  <dd>{formatTime(r.at)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        {!edit.hidden("shabbat.art") && (
          <div className="tv-shabbat-art" {...edit.attr("shabbat.art")}>
            <div key={`${active}:${scene}`} className="tv-shabbat-scene">
              <ShabbatPicture scene={scene} flickerKey={bucket} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ the art -- */

/**
 * A braided challah seen from the side: an elongated loaf with two rows of
 * diagonal strands leaning opposite ways (how a plait reads), glazed and
 * sprinkled with sesame. `y` is the bottom line of the loaf.
 */
function Loaf({
  x,
  y,
  length,
  height,
  id,
}: {
  x: number;
  y: number;
  length: number;
  height: number;
  id: string;
}) {
  const segments = 6;
  const segW = length / segments;
  // Height of the loaf's top above the bottom line at 0..1 along it.
  const top = (t: number) => height * Math.pow(Math.sin(Math.PI * t), 0.7);
  const lobes: Array<{ cx: number; cy: number; rx: number; ry: number; rot: number }> = [];
  for (let i = 0; i < segments; i++) {
    for (const row of [0, 1]) {
      const t = (i + 0.5 + row * 0.5) / (segments + 0.5);
      const h = top(t);
      if (h < height * 0.25) continue;
      const size = 0.55 + 0.45 * Math.sin(Math.PI * t);
      lobes.push({
        cx: x + t * length,
        cy: y - h * (row === 0 ? 0.62 : 0.3),
        rx: segW * 0.72 * size,
        ry: h * 0.3,
        rot: row === 0 ? -30 : 30,
      });
    }
  }
  // Lower row first, so the upper strands overlap it like a real braid.
  lobes.sort((a, b) => b.cy - a.cy);
  const body = `M${x} ${y - 6} C${x + length * 0.12} ${y - height * 1.05} ${x + length * 0.88} ${
    y - height * 1.05
  } ${x + length} ${y - 6} C${x + length * 0.8} ${y + 8} ${x + length * 0.2} ${y + 8} ${x} ${
    y - 6
  } Z`;
  return (
    <g>
      <ellipse
        cx={x + length / 2}
        cy={y + 4}
        rx={length / 2 + 26}
        ry={12}
        fill="#000"
        opacity={0.3}
      />
      <path d={body} fill={`url(#${id}-crust)`} />
      {lobes.map((l, i) => (
        <g key={i} transform={`rotate(${l.rot} ${l.cx} ${l.cy})`}>
          <ellipse
            cx={l.cx}
            cy={l.cy}
            rx={l.rx}
            ry={l.ry}
            fill={`url(#${id}-crust)`}
            stroke="#6e3610"
            strokeOpacity={0.45}
            strokeWidth={1.6}
          />
          <ellipse
            cx={l.cx - l.rx * 0.18}
            cy={l.cy - l.ry * 0.38}
            rx={l.rx * 0.5}
            ry={l.ry * 0.28}
            fill="#fff1bf"
            opacity={0.35}
          />
          {[-0.45, -0.1, 0.25, 0.55].map((p, j) => (
            <ellipse
              key={j}
              cx={l.cx + p * l.rx}
              cy={l.cy + (j % 2 ? 0.15 : -0.2) * l.ry}
              rx={2.3}
              ry={1.1}
              transform={`rotate(${20 + j * 35} ${l.cx + p * l.rx} ${
                l.cy + (j % 2 ? 0.15 : -0.2) * l.ry
              })`}
              fill="#fff6dc"
              opacity={0.9}
            />
          ))}
        </g>
      ))}
    </g>
  );
}

/**
 * A lit candle in a silver candlestick; the base stands at y=452, the flame
 * tip at y=88 (viewBox 900x520). `lag` (ms) is how far into the current
 * flicker cycle the flame already is - see ShabbatArt.
 */
function Candle({
  x,
  id,
  flickerKey,
  lag,
  delay,
}: {
  x: number;
  id: string;
  flickerKey: number;
  lag: number;
  delay: number;
}) {
  return (
    <g>
      <circle cx={x} cy={118} r={120} fill={`url(#${id}-glow)`} />
      <ellipse cx={x} cy={452} rx={58} ry={12} fill="#000" opacity={0.3} />
      <path
        d={`M${x - 50} 448 Q${x} 425 ${x + 50} 448 L${x + 38} 436 Q${x} 418 ${x - 38} 436 Z`}
        fill={`url(#${id}-silver)`}
      />
      <rect x={x - 9} y={318} width={18} height={112} rx={6} fill={`url(#${id}-silver)`} />
      <ellipse cx={x} cy={372} rx={17} ry={8} fill={`url(#${id}-silver)`} />
      <ellipse cx={x} cy={340} rx={13} ry={6} fill={`url(#${id}-silver)`} />
      <path
        d={`M${x - 34} 300 Q${x} 336 ${x + 34} 300 L${x + 28} 318 Q${x} 330 ${x - 28} 318 Z`}
        fill={`url(#${id}-silver)`}
      />
      <ellipse cx={x} cy={300} rx={34} ry={8} fill="#e9eef5" />
      <rect x={x - 15} y={160} width={30} height={142} rx={4} fill={`url(#${id}-wax)`} />
      <ellipse cx={x} cy={160} rx={15} ry={4.5} fill="#fffdf6" />
      <path
        d={`M${x + 6} 160 q3 16 -1 26 q-2 8 1 14`}
        stroke="#f3eadb"
        strokeWidth={4}
        fill="none"
        strokeLinecap="round"
        opacity={0.9}
      />
      <line
        x1={x}
        y1={160}
        x2={x}
        y2={146}
        stroke="#2a1d12"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      {/* keyed so the flicker replays every 10 minutes, then rests */}
      <g key={flickerKey} className="tv-flame" style={{ animationDelay: `${delay - lag}ms` }}>
        <path
          d={`M${x} 88 C${x + 17} 112 ${x + 15} 136 ${x} 150 C${x - 15} 136 ${
            x - 17
          } 112 ${x} 88 Z`}
          fill={`url(#${id}-flame)`}
        />
        <path
          d={`M${x} 118 C${x + 6} 128 ${x + 6} 140 ${x} 148 C${x - 6} 140 ${x - 6} 128 ${x} 118 Z`}
          fill="#fffbe8"
          opacity={0.9}
        />
        <ellipse cx={x} cy={146} rx={3.5} ry={5} fill="#7fb6ff" opacity={0.7} />
      </g>
    </g>
  );
}

/** A silver kiddush cup filled with wine, standing on its saucer at y=462. */
function KiddushCup({ x, id }: { x: number; id: string }) {
  return (
    <g>
      <ellipse cx={x} cy={466} rx={118} ry={20} fill="#000" opacity={0.3} />
      <ellipse cx={x} cy={458} rx={112} ry={18} fill={`url(#${id}-silver)`} />
      <ellipse cx={x} cy={454} rx={96} ry={12} fill="#dfe5ee" opacity={0.6} />
      <path
        d={`M${x - 58} 452 Q${x} 420 ${x + 58} 452 L${x + 40} 440 Q${x} 408 ${x - 40} 440 Z`}
        fill={`url(#${id}-silver)`}
      />
      <rect x={x - 9} y={326} width={18} height={112} rx={6} fill={`url(#${id}-silver)`} />
      <ellipse cx={x} cy={386} rx={19} ry={9} fill={`url(#${id}-silver)`} />
      <ellipse cx={x} cy={340} rx={15} ry={7} fill={`url(#${id}-silver)`} />
      <path
        d={`M${x - 74} 206 L${x + 74} 206 Q${x + 70} 300 ${x} 332 Q${x - 70} 300 ${x - 74} 206 Z`}
        fill={`url(#${id}-silver)`}
      />
      {/* engraved band and vine */}
      <path
        d={`M${x - 72} 236 Q${x} 252 ${x + 72} 236`}
        stroke="#8e98a6"
        strokeWidth={2}
        fill="none"
        opacity={0.8}
      />
      <path
        d={`M${x - 66} 262 Q${x} 280 ${x + 66} 262`}
        stroke="#8e98a6"
        strokeWidth={2}
        fill="none"
        opacity={0.8}
      />
      {[-44, -22, 0, 22, 44].map((dx) => (
        <circle
          key={dx}
          cx={x + dx}
          cy={250 + Math.abs(dx) * -0.08}
          r={4.5}
          fill="#aeb7c4"
          opacity={0.9}
        />
      ))}
      <path
        d={`M${x - 36} 214 Q${x - 30} 280 ${x - 8} 318`}
        stroke="#ffffff"
        strokeWidth={7}
        fill="none"
        opacity={0.35}
        strokeLinecap="round"
      />
      {/* wine */}
      <ellipse cx={x} cy={207} rx={74} ry={13} fill="#e6ebf2" />
      <ellipse cx={x} cy={208} rx={68} ry={10} fill={`url(#${id}-wine)`} />
      <ellipse cx={x - 22} cy={205} rx={22} ry={3} fill="#ff9aa8" opacity={0.35} />
    </g>
  );
}

/** Jerusalem's Old City at dusk, as a silhouette against the evening sky. */
function Skyline({ id }: { id: string }) {
  const wall =
    "M0 360 L0 330 L60 330 L60 318 L70 318 L70 330 L90 330 L90 318 L100 318 L100 330 L150 330 L150 250 L162 250 L162 238 L176 238 L176 250 L188 250 L188 330 L240 330 L240 300 Q262 262 284 300 L284 330 L330 330 L330 318 L340 318 L340 330 L372 330 L372 280 L384 280 L384 330 L420 330 L420 270 Q470 190 520 270 L520 330 L560 330 L560 296 L572 280 L584 296 L584 330 L640 330 L640 318 L650 318 L650 330 L700 330 L700 262 L716 262 L716 244 L732 244 L732 262 L748 262 L748 330 L810 330 L810 318 L820 318 L820 330 L900 330 L900 360 Z";
  return (
    <g>
      <rect x={0} y={0} width={900} height={520} fill={`url(#${id}-sky)`} />
      {[
        [80, 60, 1.6],
        [180, 110, 1.1],
        [260, 40, 1.4],
        [350, 90, 1],
        [520, 50, 1.3],
        [610, 110, 1],
        [700, 70, 1.7],
        [820, 40, 1.2],
        [860, 130, 1],
        [430, 30, 1.1],
      ].map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="#fff8e1" opacity={0.85} />
      ))}
      <g transform="translate(0 72)">
        {/* far hills */}
        <path
          d="M0 300 Q150 250 300 285 T600 275 T900 290 L900 360 L0 360 Z"
          fill="#3b2a55"
          opacity={0.75}
        />
        {/* the walls, towers and the great dome */}
        <path d={wall} fill="#1d1430" />
        <path
          d="M430 262 Q470 214 510 262"
          stroke="#e9c46a"
          strokeWidth={3}
          fill="none"
          opacity={0.55}
        />
        <line x1={470} y1={210} x2={470} y2={192} stroke="#1d1430" strokeWidth={4} />
        {/* lit windows */}
        {[
          [160, 270],
          [172, 290],
          [256, 312],
          [378, 296],
          [470, 300],
          [486, 300],
          [454, 300],
          [572, 310],
          [712, 280],
          [728, 300],
        ].map(([wx, wy], i) => (
          <rect key={i} x={wx} y={wy} width={6} height={9} rx={2} fill="#ffcf6b" opacity={0.9} />
        ))}
        {/* cypresses */}
        {[112, 212, 612, 780].map((cx) => (
          <path
            key={cx}
            d={`M${cx} 330 Q${cx - 11} 300 ${cx} 262 Q${cx + 11} 300 ${cx} 330 Z`}
            fill="#140e22"
          />
        ))}
      </g>
      {/* stone sill in front, where the candles stand */}
      <rect x={0} y={440} width={900} height={80} fill={`url(#${id}-stone)`} />
      <rect x={0} y={440} width={900} height={6} fill="#f1e2c4" opacity={0.6} />
      <rect x={0} y={430} width={900} height={12} fill="#1d1430" />
    </g>
  );
}

/** A white Shabbat tablecloth with a lace edge, from y=`top` down. */
function Tablecloth({ top, id }: { top: number; id: string }) {
  return (
    <g>
      <rect x={0} y={top} width={900} height={520 - top} fill={`url(#${id}-cloth)`} />
      <path
        d={`M0 ${top} ${Array.from(
          { length: 30 },
          (_, i) => `Q${i * 30 + 15} ${top + 14} ${i * 30 + 30} ${top}`,
        ).join(" ")}`}
        stroke="#fffaf0"
        strokeWidth={2.5}
        fill="none"
        opacity={0.8}
      />
      {Array.from({ length: 30 }, (_, i) => (
        <circle key={i} cx={i * 30 + 15} cy={top + 18} r={2.2} fill="#fffaf0" opacity={0.7} />
      ))}
    </g>
  );
}

export function ShabbatArt({
  scene = "classic",
  flickerKey = 0,
}: {
  scene?: ShabbatArtId;
  flickerKey?: number;
}) {
  const raw = useId();
  const id = `sb${raw.replace(/[^a-zA-Z0-9]/g, "")}`;
  // A scene mounted mid-way (the slideshow switched to it) picks up the
  // flicker where the clock says it is, so a fast slideshow never keeps the
  // flames animating past the ~90 s window.
  const [mountedAt] = useState(() => Date.now());
  const lag = Math.max(0, mountedAt - flickerKey * 600_000);
  const candle = (x: number, delay: number) => (
    <Candle x={x} id={id} flickerKey={flickerKey} lag={lag} delay={delay} />
  );
  const label = SHABBAT_ART.find((a) => a.id === scene)?.label ?? "";

  return (
    <svg viewBox="0 0 900 520" role="img" aria-label={label} className="tv-shabbat-svg">
      <defs>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0%" stopColor="#ffd98a" stopOpacity={0.55} />
          <stop offset="45%" stopColor="#ffb347" stopOpacity={0.16} />
          <stop offset="100%" stopColor="#ffb347" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${id}-warm`} cx="50%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#ffcf7a" stopOpacity={0.22} />
          <stop offset="100%" stopColor="#ffcf7a" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`${id}-flame`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff4b0" />
          <stop offset="45%" stopColor="#ffc94a" />
          <stop offset="85%" stopColor="#ff8a1f" />
          <stop offset="100%" stopColor="#ff6a00" stopOpacity={0.6} />
        </linearGradient>
        <linearGradient id={`${id}-wax`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#e9e2d2" />
          <stop offset="40%" stopColor="#fffdf7" />
          <stop offset="100%" stopColor="#d8cfbb" />
        </linearGradient>
        <linearGradient id={`${id}-silver`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8e98a6" />
          <stop offset="35%" stopColor="#f4f7fb" />
          <stop offset="60%" stopColor="#c3cbd6" />
          <stop offset="100%" stopColor="#7c8694" />
        </linearGradient>
        <radialGradient id={`${id}-crust`} cx="40%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#f6c56b" />
          <stop offset="45%" stopColor="#d8892f" />
          <stop offset="85%" stopColor="#a4531a" />
          <stop offset="100%" stopColor="#7e3c10" />
        </radialGradient>
        <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8a5a33" />
          <stop offset="100%" stopColor="#5a3519" />
        </linearGradient>
        <linearGradient id={`${id}-velvet`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6d1026" />
          <stop offset="100%" stopColor="#3d0714" />
        </linearGradient>
        <radialGradient id={`${id}-wine`} cx="40%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#a3142e" />
          <stop offset="100%" stopColor="#4a0612" />
        </radialGradient>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#101a3d" />
          <stop offset="38%" stopColor="#3a2a6b" />
          <stop offset="58%" stopColor="#a4507a" />
          <stop offset="70%" stopColor="#f08a4b" />
          <stop offset="78%" stopColor="#ffc36b" />
        </linearGradient>
        <linearGradient id={`${id}-stone`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c9b28c" />
          <stop offset="100%" stopColor="#8a7552" />
        </linearGradient>
        <linearGradient id={`${id}-cloth`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbf7ee" />
          <stop offset="100%" stopColor="#d9d1c0" />
        </linearGradient>
        <clipPath id={`${id}-frame`}>
          <rect x={0} y={0} width={900} height={520} rx={26} />
        </clipPath>
      </defs>

      {scene === "classic" && (
        <g>
          <rect x={0} y={0} width={900} height={520} fill={`url(#${id}-warm)`} />
          <path
            d="M240 330 Q450 196 660 330 L682 410 Q450 380 218 410 Z"
            fill={`url(#${id}-velvet)`}
          />
          <path d="M240 330 Q450 196 660 330" stroke="#d9b45a" strokeWidth={5} fill="none" />
          <path
            d="M218 410 Q450 380 682 410"
            stroke="#d9b45a"
            strokeWidth={4}
            fill="none"
            opacity={0.8}
          />
          <text
            x={450}
            y={308}
            textAnchor="middle"
            fontSize={30}
            fontWeight={700}
            fill="#e8c874"
            fontFamily='"Frank Ruhl Libre", "David Libre", serif'
          >
            שבת קודש
          </text>
          <rect x={230} y={418} width={440} height={34} rx={10} fill={`url(#${id}-wood)`} />
          <rect x={230} y={418} width={440} height={6} rx={3} fill="#b07a4b" opacity={0.7} />
          <Loaf x={318} y={394} length={268} height={74} id={id} />
          <Loaf x={292} y={424} length={318} height={86} id={id} />
          {candle(140, 0)}
          {candle(760, 240)}
        </g>
      )}

      {scene === "kiddush" && (
        <g>
          <rect x={0} y={0} width={900} height={520} fill={`url(#${id}-warm)`} />
          {candle(90, 0)}
          {candle(230, 240)}
          <KiddushCup x={430} id={id} />
          {/* the challah, its velvet cover folded back behind it */}
          <path
            d="M580 368 Q720 300 860 368 L870 420 Q720 396 570 420 Z"
            fill={`url(#${id}-velvet)`}
          />
          <path d="M580 368 Q720 300 860 368" stroke="#d9b45a" strokeWidth={4} fill="none" />
          <rect x={574} y={440} width={296} height={30} rx={9} fill={`url(#${id}-wood)`} />
          <rect x={574} y={440} width={296} height={5} rx={3} fill="#b07a4b" opacity={0.7} />
          <Loaf x={600} y={446} length={244} height={82} id={id} />
        </g>
      )}

      {scene === "jerusalem" && (
        <g clipPath={`url(#${id}-frame)`}>
          <Skyline id={id} />
          {candle(96, 0)}
          {candle(804, 240)}
          <text
            x={450}
            y={498}
            textAnchor="middle"
            fontSize={34}
            fontWeight={700}
            fill="#4a371d"
            fontFamily='"Frank Ruhl Libre", "David Libre", serif'
          >
            ירושלים עיר הקודש
          </text>
        </g>
      )}

      {scene === "candles" && (
        <g clipPath={`url(#${id}-frame)`}>
          <rect x={0} y={0} width={900} height={520} fill="#1c1016" />
          <rect x={0} y={0} width={900} height={520} fill={`url(#${id}-warm)`} />
          <text
            x={450}
            y={52}
            textAnchor="middle"
            fontSize={42}
            fontWeight={700}
            fill="#e8c874"
            fontFamily='"Frank Ruhl Libre", "David Libre", serif'
          >
            לכבוד שבת קודש
          </text>
          <Tablecloth top={430} id={id} />
          {candle(340, 0)}
          {candle(560, 240)}
          <Loaf x={650} y={486} length={200} height={62} id={id} />
          <Loaf x={50} y={486} length={200} height={62} id={id} />
        </g>
      )}
    </svg>
  );
}

/** One Shabbat picture: a built-in drawing ("art:<id>") or an uploaded photo (URL). */
export function ShabbatPicture({ scene, flickerKey = 0 }: { scene: string; flickerKey?: number }) {
  if (scene.startsWith("art:")) {
    const id = scene.slice(4);
    const known = SHABBAT_ART.some((a) => a.id === id);
    return <ShabbatArt scene={(known ? id : "classic") as ShabbatArtId} flickerKey={flickerKey} />;
  }
  return <img className="tv-shabbat-photo" src={scene} alt="" decoding="async" />;
}
