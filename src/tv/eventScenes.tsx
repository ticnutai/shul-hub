import type { ReactNode } from "react";

/**
 * Full scenes for the special-day splash, next to the three plain designs:
 * a decorated sukkah by day, the same sukkah at night under its lights, and
 * the four species. Drawn as one SVG each (1600×900) like the plain designs,
 * so they are sharp on any screen and nothing is downloaded. The scene sits
 * on the left; the right is kept quieter for the card with the name and times.
 */

/** A small deterministic sequence (so the leaves and stars are the same on every screen). */
export function seeded(n: number, seed: number): number[] {
  let x = seed;
  return Array.from({ length: n }, () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  });
}

type Pt = [number, number];
/** A point on a hanging string from a to b that sags by `sag`, at t in 0..1. */
function hang(a: Pt, b: Pt, sag: number, t: number): Pt {
  const c: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag * 2];
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}

/* ---------------------------------------------------------- ornaments -- */

const pomegranate = (x: number, y: number, s: number, id: string) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <circle r="22" fill={`url(#${id}-pom)`} />
    <path d="M-7 -20 L-5 -30 L-1 -23 L2 -32 L4 -23 L8 -30 L8 -19 Z" fill="#8f1a1f" />
    <ellipse cx="-8" cy="-8" rx="6" ry="4" fill="#fff" opacity="0.28" />
  </g>
);

const grapes = (x: number, y: number, s: number, id: string) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M0 -26 Q10 -34 22 -30 Q14 -20 0 -22 Z" fill="#5d8a2f" />
    {[
      [-12, -12], [0, -14], [12, -12],
      [-6, -2], [6, -2], [-14, 0], [14, 0],
      [0, 8], [-8, 16], [8, 16], [0, 26],
    ].map(([gx, gy], i) => (
      <circle key={i} cx={gx} cy={gy} r="7.5" fill={`url(#${id}-grape)`} />
    ))}
  </g>
);

const lantern = (x: number, y: number, s: number, id: string, lit: boolean) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    {lit && <circle r="46" fill="#ffc861" opacity="0.28" filter={`url(#${id}-soft)`} />}
    <path d="M-8 -34 H8 L12 -26 H-12 Z" fill="#b8862e" />
    <path d="M-12 -26 L-20 -6 L-14 22 H14 L20 -6 L12 -26 Z" fill={lit ? "#ffcf6e" : "#e9b85a"} opacity="0.92" />
    <path d="M-12 -26 L-20 -6 L-14 22 H14 L20 -6 L12 -26 Z M0 -26 V22 M-20 -6 H20" fill="none" stroke="#8a5c17" strokeWidth="2.2" />
    <path d="M-14 22 H14 L8 30 H-8 Z" fill="#b8862e" />
    <path d="M0 30 V40" stroke="#b8862e" strokeWidth="3" strokeLinecap="round" />
  </g>
);

const star = (x: number, y: number, s: number, fill: string) => (
  <path
    transform={`translate(${x} ${y}) scale(${s})`}
    d="M0 -18 L5 -8 H16 L8 0 L16 8 H5 L0 18 L-5 8 H-16 L-8 0 L-16 -8 H-5 Z"
    fill={fill}
    stroke="#8a5c17"
    strokeWidth="1"
  />
);

const etrog = (x: number, y: number, s: number, rot: number, id: string) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
    <path d="M-60 0 C-60 -40 -20 -52 16 -48 C50 -44 70 -18 74 0 C70 18 50 44 16 48 C-20 52 -60 40 -60 0 Z" fill={`url(#${id}-etrog)`} />
    {seeded(40, 11).map((r, i) => (
      <circle key={i} cx={-48 + ((r * 997) % 1) * 112} cy={-36 + ((r * 7919) % 1) * 72} r="1.4" fill="#9a7a10" opacity="0.35" />
    ))}
    <path d="M74 0 Q84 -2 88 -6" stroke="#6f5a1c" strokeWidth="4" fill="none" strokeLinecap="round" />
    <circle cx="89" cy="-6" r="3.5" fill="#6f5a1c" />
    <path d="M-60 0 H-68" stroke="#6f7a2c" strokeWidth="5" strokeLinecap="round" />
    <ellipse cx="-10" cy="-26" rx="26" ry="9" fill="#fff" opacity="0.22" />
  </g>
);

/** Two lit candlesticks, for a festival on Shabbat. */
const shabbatCandles = (x: number, y: number, s: number, id: string) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    {[-22, 22].map((dx) => (
      <g key={dx} transform={`translate(${dx} 0)`}>
        <circle cy="-78" r="22" fill="#ffd27a" opacity="0.35" filter={`url(#${id}-soft)`} />
        <path d="M0 -92 Q7 -80 0 -68 Q-7 -80 0 -92 Z" fill="#ffcf5c" />
        <rect x="-5" y="-68" width="10" height="42" rx="2" fill="#fbf6ea" />
        <path d="M-12 -26 H12 L6 -18 V0 H14 L10 8 H-10 L-14 0 H-6 V-18 Z" fill={`url(#${id}-silver)`} />
      </g>
    ))}
  </g>
);

/* ------------------------------------------------------------- sukkah -- */

function Sukkah({ id, night, withShabbat }: { id: string; night: boolean; withShabbat: boolean }) {
  const L = 70;
  const R = 830;
  const beam = 196;
  const floor = 800;
  const leaves = seeded(260, 97);
  const lights: ReactNode[] = [];
  const strings: Array<[Pt, Pt, number]> = [
    [[L + 20, beam + 14], [R - 20, beam + 14], 46],
    [[L + 60, beam + 26], [(L + R) / 2, beam + 26], 34],
    [[(L + R) / 2, beam + 26], [R - 60, beam + 26], 34],
  ];
  strings.forEach(([a, b, sag], si) => {
    const n = si === 0 ? 26 : 13;
    for (let i = 1; i < n; i++) {
      const [x, y] = hang(a, b, sag, i / n);
      const warm = ["#ffe6a3", "#ffd06b", "#fff4d6"][i % 3]!;
      lights.push(
        <g key={`${si}-${i}`}>
          {night && <circle cx={x} cy={y + 6} r="11" fill={warm} opacity="0.55" filter={`url(#${id}-soft)`} />}
          <circle cx={x} cy={y + 6} r={night ? 4.2 : 3.4} fill={night ? "#fff8e0" : warm} />
        </g>,
      );
    }
  });

  // The paper chain: links along a hanging string, turned along it.
  const chain: ReactNode[] = [];
  const chainColours = ["#c8332f", "#e9b53c", "#2f7fb8", "#3f9a4a", "#9b3ea8"];
  [[[L + 10, beam + 4], [(L + R) / 2, beam + 4], 70], [[(L + R) / 2, beam + 4], [R - 10, beam + 4], 70]].forEach(
    ([a, b, sag], ci) => {
      const n = 22;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const [x, y] = hang(a as Pt, b as Pt, sag as number, t);
        const [x2, y2] = hang(a as Pt, b as Pt, sag as number, Math.min(1, t + 0.01));
        const angle = (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI;
        chain.push(
          <ellipse
            key={`${ci}-${i}`}
            cx={x}
            cy={y}
            rx="10"
            ry="5.5"
            transform={`rotate(${angle + (i % 2 ? 0 : 90) * 0.35} ${x} ${y})`}
            fill="none"
            stroke={chainColours[(i + ci * 2) % chainColours.length]}
            strokeWidth="4"
            opacity={night ? 0.85 : 1}
          />,
        );
      }
    },
  );

  const hanging: Array<[number, number, "pom" | "grapes" | "lantern" | "star"]> = [
    [150, 330, "pom"], [235, 290, "lantern"], [320, 350, "grapes"], [400, 300, "star"],
    [480, 340, "lantern"], [560, 300, "pom"], [640, 355, "grapes"], [720, 305, "lantern"], [790, 335, "star"],
  ];

  // Palm branches lying on the s'chach, some hanging over the front edge.
  const fronds = seeded(18, 23).map((r, i) => {
    const bx = L - 60 + i * ((R - L + 120) / 17);
    const by = beam - 40 - ((r * 11) % 1) * 60;
    const dir = i % 2 ? 1 : -1;
    const over = i % 3 === 0;
    const tip: Pt = [bx + dir * (160 + r * 120), over ? beam + 30 + r * 40 : by - 30 - r * 40];
    const ctrl: Pt = [(bx + tip[0]) / 2, Math.min(by, tip[1]) - 50];
    const colour = ["#3d7f2a", "#4f9434", "#6b9e3c", "#2f6b22", "#86a543"][i % 5]!;
    const at = (t: number): Pt => {
      const u = 1 - t;
      return [u * u * bx + 2 * u * t * ctrl[0] + t * t * tip[0], u * u * by + 2 * u * t * ctrl[1] + t * t * tip[1]];
    };
    const blades: ReactNode[] = [];
    for (let k = 1; k < 16; k++) {
      const t = k / 16;
      const [px, py] = at(t);
      const [qx, qy] = at(Math.min(1, t + 0.02));
      const len = Math.hypot(qx - px, qy - py) || 1;
      const tx = (qx - px) / len;
      const ty = (qy - py) / len;
      const size = 46 * (1 - t * 0.55);
      for (const side of [1, -1]) {
        const nx = -ty * side;
        const ny = tx * side;
        const ex = px + (nx * 0.75 + tx * 0.65) * size;
        const ey = py + (ny * 0.75 + ty * 0.65) * size + 8;
        blades.push(<path key={`${k}${side}`} d={`M${px} ${py} Q${(px + ex) / 2 + nx * 6} ${(py + ey) / 2 + ny * 6} ${ex} ${ey}`} stroke={colour} strokeWidth="4.5" strokeLinecap="round" fill="none" />);
      }
    }
    return (
      <g key={i}>
        {blades}
        <path d={`M${bx} ${by} Q${ctrl[0]} ${ctrl[1]} ${tip[0]} ${tip[1]}`} stroke="#b7a35a" strokeWidth="4" fill="none" strokeLinecap="round" />
      </g>
    );
  });

  return (
    <g>
      {/* Behind the sukkah: the sky, and Jerusalem far away on the right. */}
      {night ? (
        <g>
          {seeded(160, 5).map((r, i, a) => (
            <circle key={i} cx={(r * 1600 + i * 41) % 1600} cy={(a[(i + 9) % a.length]! * 520 + i * 7) % 520} r={0.7 + (i % 4) * 0.5} fill="#fff" opacity={0.3 + (i % 5) * 0.12} />
          ))}
          <circle cx="1440" cy="120" r="46" fill="#fff6d8" />
          <circle cx="1460" cy="108" r="44" fill="#0e1a36" />
          <circle cx="1440" cy="120" r="90" fill="#fff3c4" opacity="0.08" />
        </g>
      ) : (
        <circle cx="1380" cy="180" r="220" fill="#fff1c9" opacity="0.55" filter={`url(#${id}-soft)`} />
      )}
      <path
        d="M830 700 V640 H880 V610 H930 V650 H990 V590 H1010 V570 H1030 V590 H1050 V640 H1120 V600 Q1160 540 1200 600 V640 H1260 V620 H1320 V650 H1380 V610 H1400 V560 H1412 V610 H1440 V640 H1520 V620 H1600 V700 Z"
        fill={night ? "#1b2744" : "#d9b98c"}
        opacity={night ? 0.9 : 0.55}
      />
      <rect x="820" y="690" width="780" height="210" fill={night ? "#121a2e" : "#c7a375"} opacity={night ? 1 : 0.6} />

      {/* The back wall: fabric with woven stripes, lit from inside at night. */}
      <rect x={L} y={beam} width={R - L} height={floor - beam} fill={`url(#${id}-wall)`} />
      <rect x={L} y={beam} width={R - L} height={floor - beam} fill={`url(#${id}-stripes)`} />
      {night && <ellipse cx="450" cy="420" rx="420" ry="300" fill="#ffcf73" opacity="0.18" filter={`url(#${id}-soft)`} />}

      {/* A banner across the wall. */}
      <g>
        <path d="M250 380 H650 L630 410 L650 440 H250 L270 410 Z" fill="#7d1d2a" />
        <path d="M262 386 H638 M262 434 H638" stroke="#e7c16a" strokeWidth="2" />
        <text x="450" y="424" textAnchor="middle" fontFamily="'Frank Ruhl Libre', 'David Libre', serif" fontWeight="700" fontSize="38" fill="#f4d98c">
          {night ? "ושמחת בחגך" : "עולו אושפיזין"}
        </text>
      </g>

      {/* The table, with a white cloth and what is on it. */}
      <g>
        <path d="M170 640 H730 L770 760 H130 Z" fill={`url(#${id}-cloth)`} />
        <path
          d={`M130 760 ${Array.from({ length: 16 }, (_, i) => `q20 18 40 0`).join(" ")}`}
          fill="#f6f1e6"
          stroke="#d9cfb8"
          strokeWidth="1.5"
        />
        <path d="M170 640 H730" stroke="#e1d6bd" strokeWidth="2" />
        <rect x="170" y="760" width="16" height="50" fill="#6b4524" />
        <rect x="714" y="760" width="16" height="50" fill="#6b4524" />
        {/* A bowl of fruit. */}
        <path d="M230 640 Q280 690 330 640 Z" fill={`url(#${id}-silver)`} />
        {pomegranate(262, 624, 0.8, id)}
        {grapes(300, 622, 0.65, id)}
        {/* The kiddush cup. */}
        <path d="M430 586 H470 Q470 622 450 626 Q430 622 430 586 Z" fill={`url(#${id}-silver)`} />
        <path d="M450 626 V640 M438 642 H462" stroke="#b9b9c0" strokeWidth="4" strokeLinecap="round" />
        {/* The etrog in its box. */}
        <rect x="560" y="614" width="110" height="32" rx="6" fill="#6b3f1f" />
        <rect x="566" y="618" width="98" height="10" rx="3" fill="#a3302f" />
        {etrog(615, 608, 0.42, -8, id)}
        {withShabbat && shabbatCandles(372, 640, 0.95, id)}
      </g>

      {/* The floor. */}
      <rect x={L} y={floor} width={R - L} height={900 - floor} fill={night ? "#3a2716" : "#8a6038"} />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M${L} ${floor + 8 + i * 26} H${R}`} stroke="#000" strokeOpacity="0.18" strokeWidth="2" />
      ))}

      {/* Posts and beam. */}
      <rect x={L - 14} y={beam - 16} width="26" height={900 - beam + 16} fill={`url(#${id}-wood)`} />
      <rect x={R - 12} y={beam - 16} width="26" height={900 - beam + 16} fill={`url(#${id}-wood)`} />
      <rect x={L - 30} y={beam - 18} width={R - L + 60} height="22" fill={`url(#${id}-wood)`} />

      {/* The s'chach: bamboo poles and a thick layer of palm leaves over them. */}
      <path d={`M${L - 40} ${beam - 22} Q450 ${beam - 70} ${R + 40} ${beam - 22} L${R + 50} ${beam - 110} Q450 ${beam - 170} ${L - 50} ${beam - 110} Z`} fill="#264d1c" />
      {leaves.slice(0, 90).map((r, i) => {
        const x = L - 40 + (i / 90) * (R - L + 80);
        const y = beam - 30 - ((r * 7) % 1) * 80;
        const dx = (((r * 13) % 1) - 0.5) * 90;
        return <path key={i} d={`M${x} ${y} q${dx / 2} -24 ${dx} 6`} stroke={["#2f6b22", "#3f8a2c", "#355f20"][i % 3]} strokeWidth="6" strokeLinecap="round" fill="none" />;
      })}
      {fronds}
      {[beam - 34, beam - 8].map((y) => (
        <path key={y} d={`M${L - 50} ${y} H${R + 50}`} stroke="#c9a864" strokeWidth="8" strokeLinecap="round" />
      ))}
      {leaves.slice(0, 40).map((r, i) => {
        const x = L + (i / 40) * (R - L) + r * 10;
        return <path key={i} d={`M${x} ${beam - 6} q${(r - 0.5) * 20} ${16 + r * 18} ${(r - 0.5) * 40} ${24 + r * 22}`} stroke="#3f8a2c" strokeWidth="5" strokeLinecap="round" fill="none" />;
      })}

      {/* What hangs from the s'chach. */}
      {chain}
      {hanging.map(([x, y, kind]) => (
        <g key={x}>
          <path d={`M${x} ${beam} V${y - 26}`} stroke={night ? "#d7b46a" : "#8a6a3a"} strokeWidth="1.6" />
          {kind === "pom" && pomegranate(x, y, 1, id)}
          {kind === "grapes" && grapes(x, y, 1, id)}
          {kind === "lantern" && lantern(x, y, 1, id, night)}
          {kind === "star" && star(x, y, 1.2, "#f2c64d")}
        </g>
      ))}
      {lights}

      {/* Curtains tied back on both sides. */}
      {[0, 1].map((side) => (
        <g key={side} transform={side ? `translate(${L + R} 0) scale(-1 1)` : undefined}>
          <path d={`M${L - 6} ${beam + 4} H${L + 150} Q${L + 120} ${beam + 190} ${L + 58} ${beam + 330} Q${L + 90} ${beam + 480} ${L + 150} 900 H${L - 6} Z`} fill={`url(#${id}-curtain)`} />
          <path d={`M${L + 30} ${beam + 10} Q${L + 30} ${beam + 200} ${L + 34} ${beam + 330} M${L + 70} ${beam + 10} Q${L + 64} ${beam + 190} ${L + 46} ${beam + 330}`} stroke="#000" strokeOpacity="0.2" strokeWidth="3" fill="none" />
          <ellipse cx={L + 52} cy={beam + 332} rx="30" ry="10" fill="#e3b551" />
          <path d={`M${L + 70} ${beam + 336} q8 40 -4 70 M${L + 76} ${beam + 336} q16 36 8 66`} stroke="#e3b551" strokeWidth="4" fill="none" strokeLinecap="round" />
          <rect x={L - 10} y={beam - 4} width="170" height="14" rx="4" fill="#b9892f" />
        </g>
      ))}
    </g>
  );
}

/* ---------------------------------------------------- the four species -- */

function FourSpecies({ id, withShabbat }: { id: string; withShabbat: boolean }) {
  const cx = 470;
  const leaf = (x: number, y: number, len: number, w: number, rot: number, fill: string) => (
    <path transform={`translate(${x} ${y}) rotate(${rot})`} d={`M0 0 Q${w} ${-len / 2} 0 ${-len} Q${-w} ${-len / 2} 0 0 Z`} fill={fill} />
  );
  return (
    <g>
      {/* An arch of gold behind the species. */}
      <path d="M150 860 V360 Q150 110 470 110 Q790 110 790 360 V860" fill="#0c2415" stroke={`url(#${id}-goldline)`} strokeWidth="6" />
      <path d="M176 860 V366 Q176 138 470 138 Q764 138 764 366 V860" fill="none" stroke="#d9b45c" strokeOpacity="0.45" strokeWidth="2" />
      <ellipse cx={cx} cy="420" rx="300" ry="330" fill="#f5d98a" opacity="0.08" filter={`url(#${id}-soft)`} />

      {/* Willows, left: long narrow leaves. */}
      {[-58, -40].map((dx, k) => (
        <g key={dx}>
          <path d={`M${cx + dx} 760 Q${cx + dx - 30} 460 ${cx + dx - 60 - k * 10} 210`} stroke="#8a5a3a" strokeWidth="4" fill="none" />
          {seeded(16, 3 + k).map((r, i) => {
            const t = i / 16;
            const x = cx + dx - 30 * t * 2 * (1 - t) - (60 + k * 10) * t * t;
            const y = 740 - t * 520;
            return <g key={i}>{leaf(x, y, 70 + r * 20, 5, (i % 2 ? -32 : 26) - 8, i % 3 ? "#7fa45a" : "#6d9249")}</g>;
          })}
        </g>
      ))}

      {/* Myrtles, right: small leaves in threes. */}
      {[44, 62, 80].map((dx, k) => (
        <g key={dx}>
          <path d={`M${cx + dx - 20} 760 Q${cx + dx} 480 ${cx + dx + 18 + k * 8} 250`} stroke="#4a3a22" strokeWidth="3.5" fill="none" />
          {Array.from({ length: 14 }, (_, i) => {
            const t = i / 14;
            const x = cx + dx - 20 + 40 * t * (1 - t) + (38 + k * 8) * t * t;
            const y = 730 - t * 470;
            return (
              <g key={i}>
                {leaf(x, y, 30, 10, -50, "#2f6b2a")}
                {leaf(x, y, 30, 10, 0, "#3b7d32")}
                {leaf(x, y, 30, 10, 50, "#2f6b2a")}
              </g>
            );
          })}
        </g>
      ))}

      {/* The lulav in the middle. */}
      <path d={`M${cx - 20} 800 C${cx - 18} 500 ${cx - 12} 250 ${cx - 3} 70 L${cx} 92 L${cx + 4} 64 C${cx + 12} 250 ${cx + 18} 500 ${cx + 20} 800 Z`} fill={`url(#${id}-lulav)`} />
      <path d={`M${cx} 800 C${cx} 500 ${cx} 250 ${cx} 96`} stroke="#e4ebb0" strokeOpacity="0.6" strokeWidth="2.5" fill="none" />
      <path d={`M${cx - 10} 800 C${cx - 9} 500 ${cx - 6} 260 ${cx - 2} 110 M${cx + 10} 800 C${cx + 9} 500 ${cx + 6} 260 ${cx + 2} 110`} stroke="#3c6420" strokeOpacity="0.55" strokeWidth="1.5" fill="none" />
      {/* Woven palm rings holding the bundle. */}
      {[610, 650, 690].map((y) => (
        <g key={y}>
          <ellipse cx={cx} cy={y} rx="60" ry="12" fill="#c8a24e" />
          <path d={`M${cx - 58} ${y} Q${cx} ${y + 18} ${cx + 58} ${y}`} stroke="#8c6b24" strokeWidth="2" fill="none" />
        </g>
      ))}

      {/* The etrog, resting in front. */}
      <ellipse cx="640" cy="812" rx="150" ry="22" fill="#000" opacity="0.35" />
      {etrog(640, 760, 1.35, -14, id)}

      {withShabbat && shabbatCandles(250, 800, 1.3, id)}
    </g>
  );
}

/** The ids of the scenes (the plain designs are 0-2). */
export const SCENE_SUKKAH = 3;
export const SCENE_SUKKAH_NIGHT = 4;
export const SCENE_SPECIES = 5;

export function SceneArt({ scene, dayKey, withShabbat = false }: { scene: number; dayKey: string; withShabbat?: boolean }) {
  const id = `sc-${dayKey}-${scene}`;
  const night = scene === SCENE_SUKKAH_NIGHT;
  const species = scene === SCENE_SPECIES;
  return (
    <svg className="tv-event-art" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          {species ? (
            <>
              <stop offset="0%" stopColor="#123520" />
              <stop offset="100%" stopColor="#06140b" />
            </>
          ) : night ? (
            <>
              <stop offset="0%" stopColor="#081026" />
              <stop offset="100%" stopColor="#1d2c55" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#8fb8d8" />
              <stop offset="60%" stopColor="#f3d6a8" />
              <stop offset="100%" stopColor="#f0b98a" />
            </>
          )}
        </linearGradient>
        <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={night ? "#6b5436" : "#f5ecd8"} />
          <stop offset="100%" stopColor={night ? "#3b2c1a" : "#e6d5b3"} />
        </linearGradient>
        <pattern id={`${id}-stripes`} width="120" height="10" patternUnits="userSpaceOnUse">
          <rect x="0" width="10" height="10" fill="#b0392f" opacity={night ? 0.25 : 0.35} />
          <rect x="16" width="4" height="10" fill="#2e5d8a" opacity={night ? 0.2 : 0.3} />
          <rect x="100" width="4" height="10" fill="#c99a3a" opacity={night ? 0.25 : 0.4} />
        </pattern>
        <linearGradient id={`${id}-cloth`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={night ? "#efe2c6" : "#ffffff"} />
          <stop offset="100%" stopColor={night ? "#cdbd9a" : "#e9e3d6"} />
        </linearGradient>
        <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5a3a1e" />
          <stop offset="50%" stopColor="#9a6a3c" />
          <stop offset="100%" stopColor="#5a3a1e" />
        </linearGradient>
        <linearGradient id={`${id}-curtain`} x1="0" y1="0" x2="1" y2="0">
          {["#5e0f1c", "#8e1f2e", "#6a1320", "#a02838", "#6a1320", "#8e1f2e", "#5e0f1c"].map((c, i, a) => (
            <stop key={i} offset={`${(i / (a.length - 1)) * 100}%`} stopColor={c} />
          ))}
        </linearGradient>
        <linearGradient id={`${id}-silver`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f4f4f7" />
          <stop offset="50%" stopColor="#a9abb4" />
          <stop offset="100%" stopColor="#e3e4ea" />
        </linearGradient>
        <linearGradient id={`${id}-goldline`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6dc8e" />
          <stop offset="50%" stopColor="#b88a2c" />
          <stop offset="100%" stopColor="#f6dc8e" />
        </linearGradient>
        <linearGradient id={`${id}-lulav`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#4d7a2a" />
          <stop offset="50%" stopColor="#9dbb5a" />
          <stop offset="100%" stopColor="#4d7a2a" />
        </linearGradient>
        <radialGradient id={`${id}-pom`} cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#e2463f" />
          <stop offset="100%" stopColor="#7a1016" />
        </radialGradient>
        <radialGradient id={`${id}-grape`} cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#a86ad0" />
          <stop offset="100%" stopColor="#3e1757" />
        </radialGradient>
        <radialGradient id={`${id}-etrog`} cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#fff39a" />
          <stop offset="55%" stopColor="#f0cf2a" />
          <stop offset="100%" stopColor="#a8961c" />
        </radialGradient>
        <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="45%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity={species ? 0.2 : 0.35} />
        </linearGradient>
        <radialGradient id={`${id}-vignette`} cx="40%" cy="45%" r="80%">
          <stop offset="60%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
        <filter id={`${id}-soft`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
      </defs>
      <rect width="1600" height="900" fill={`url(#${id}-sky)`} />
      {species ? <FourSpecies id={id} withShabbat={withShabbat} /> : <Sukkah id={id} night={night} withShabbat={withShabbat} />}
      <rect width="1600" height="900" fill={`url(#${id}-shade)`} />
      <rect width="1600" height="900" fill={`url(#${id}-vignette)`} />
    </svg>
  );
}
