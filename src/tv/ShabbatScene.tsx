import { useId, useMemo } from "react";
import { formatTime } from "@community/lib/zmanim";
import { useBoardEdit } from "./boardEdit";
import { upcomingDays, weeklyParasha } from "./learning";
import type { ShabbatTimes } from "./shabbat";

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

export function ShabbatSlide({ times, now }: { times: ShabbatTimes; now: Date }) {
  const edit = useBoardEdit();
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
            <ShabbatArt flickerKey={bucket} />
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

function Candle({
  x,
  id,
  flickerKey,
  delay,
}: {
  x: number;
  id: string;
  flickerKey: number;
  delay: number;
}) {
  return (
    <g>
      {/* glow */}
      <circle cx={x} cy={118} r={120} fill={`url(#${id}-glow)`} />
      {/* candlestick */}
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
      {/* candle */}
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
      {/* flame: keyed so the flicker replays every 10 minutes, then rests */}
      <g
        key={flickerKey}
        className="tv-flame"
        style={{ transformOrigin: `${x}px 150px`, animationDelay: `${delay}ms` }}
      >
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

export function ShabbatArt({ flickerKey = 0 }: { flickerKey?: number }) {
  const raw = useId();
  const id = `sb${raw.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg
      viewBox="0 0 900 520"
      role="img"
      aria-label="נרות שבת דולקים וחלות שבת"
      className="tv-shabbat-svg"
    >
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
      </defs>

      <rect x={0} y={0} width={900} height={520} fill={`url(#${id}-warm)`} />

      {/* velvet challah cover laid behind the loaves, gold trim and embroidery */}
      <path d="M240 330 Q450 196 660 330 L682 410 Q450 380 218 410 Z" fill={`url(#${id}-velvet)`} />
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

      {/* board */}
      <rect x={230} y={418} width={440} height={34} rx={10} fill={`url(#${id}-wood)`} />
      <rect x={230} y={418} width={440} height={6} rx={3} fill="#b07a4b" opacity={0.7} />

      {/* two braided challot */}
      <Loaf x={318} y={394} length={268} height={74} id={id} />
      <Loaf x={292} y={424} length={318} height={86} id={id} />

      {/* candles */}
      <Candle x={140} id={id} flickerKey={flickerKey} delay={0} />
      <Candle x={760} id={id} flickerKey={flickerKey} delay={240} />
    </svg>
  );
}
