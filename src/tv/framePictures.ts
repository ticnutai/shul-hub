import goldOrnate from "./assets/frames/gold-ornate.jpg";
import carvedWood from "./assets/frames/carved-wood.jpg";

/**
 * The ready-made pictures of frames: the frames of the painted boards, cut
 * out of them (scripts/tv-frame-pictures.py) so they can go on any panel of
 * any layout, over any background.
 *
 * Stored in FrameStyle.image as "frame:<id>" - like the backgrounds'
 * "backdrop:<id>" - so a board keeps its frames when the build renames the
 * file. `slice` is how much of each edge of the picture is the frame, and
 * `width` how thick it is drawn by default; both can then be moved.
 */
export const FRAME_PICTURE_PREFIX = "frame:";

export interface FramePicture {
  id: string;
  name: string;
  url: string;
  slice: number;
  width: number;
}

/**
 * Frames drawn here rather than photographed: lines and corners in a 120-unit
 * square, sharp at any size, transparent inside so the box keeps its own
 * background. As a data URI, like the pictures above become a URL.
 */
const svg = (body: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" fill="none">${body}</svg>`,
  )}`;

const DOUBLE = (outer: string, inner: string) =>
  svg(
    `<rect x="3" y="3" width="114" height="114" stroke="${outer}" stroke-width="4"/>` +
      `<rect x="11" y="11" width="98" height="98" stroke="${inner}" stroke-width="1.6"/>`,
  );

const CORNERS = svg(
  `<rect x="6" y="6" width="108" height="108" stroke="#c9a227" stroke-width="1.6"/>` +
    [
      [0, 0, 1, 1],
      [120, 0, -1, 1],
      [0, 120, 1, -1],
      [120, 120, -1, -1],
    ]
      .map(
        ([x, y, sx, sy]) =>
          `<g transform="translate(${x} ${y}) scale(${sx} ${sy})" stroke="#e7c766" stroke-width="2.2" stroke-linecap="round">` +
          `<path d="M3 30V3h27"/><path d="M12 22c0-6 4-10 10-10"/><circle cx="12" cy="12" r="3.2" fill="#e7c766"/></g>`,
      )
      .join(""),
);

const STEPPED = svg(
  `<path d="M14 3h92v6h6v6h5v90h-5v6h-6v6H14v-6H8v-6H3V15h5V9h6z" stroke="#d8ab35" stroke-width="2.4"/>` +
    `<path d="M20 11h80v5h5v5h4v78h-4v5h-5v5H20v-5h-5v-5h-4V21h4v-5h5z" stroke="#f2d98a" stroke-width="1"/>`,
);

const ROPE = svg(
  `<rect x="5" y="5" width="110" height="110" rx="6" stroke="#b8891a" stroke-width="6"/>` +
    `<rect x="5" y="5" width="110" height="110" rx="6" stroke="#f2d98a" stroke-width="2.4" stroke-dasharray="5 4"/>`,
);

// The carved frame of the old "מסגרת זהב": a heavy line, a thin one inside it, scrollwork in the corners.
const CARVED = svg(
  `<g stroke="#c9a227" stroke-width="4"><rect x="2" y="2" width="116" height="116" rx="6"/>` +
    `<rect x="11" y="11" width="98" height="98" rx="4" stroke-width="2" stroke="#f6e3a8"/></g>` +
    `<g fill="#c9a227"><path d="M2 2h34v4H6v30H2z"/><path d="M118 2h-34v4h30v30h4z"/><path d="M2 118h34v-4H6V84H2z"/><path d="M118 118h-34v-4h30V84h4z"/></g>` +
    `<g stroke="#f6e3a8" stroke-width="2.5" stroke-linecap="round">` +
    `<path d="M14 30c0-9 7-16 16-16 5 0 8 3 8 7s-3 6-6 6-5-2-5-4"/><path d="M106 30c0-9-7-16-16-16-5 0-8 3-8 7s3 6 6 6 5-2 5-4"/>` +
    `<path d="M14 90c0 9 7 16 16 16 5 0 8-3 8-7s-3-6-6-6-5 2-5 4"/><path d="M106 90c0 9-7 16-16 16-5 0-8-3-8-7s3-6 6-6 5 2 5 4"/></g>`,
);

/** Something drawn once in each corner of a thin gold line, turned to face its corner. */
const inCorners = (body: string) =>
  [
    [0, 0, 1, 1],
    [120, 0, -1, 1],
    [0, 120, 1, -1],
    [120, 120, -1, -1],
  ]
    .map(([x, y, sx, sy]) => `<g transform="translate(${x} ${y}) scale(${sx} ${sy})">${body}</g>`)
    .join("");

// The rosettes of the old "לוחות הברית".
const ROSETTES = svg(
  `<rect x="8" y="8" width="104" height="104" rx="4" stroke="#c9a227" stroke-width="1.8"/>` +
    inCorners(
      `<g transform="translate(16 16)"><circle r="8" fill="#f6e3a8" stroke="#c9a227" stroke-width="2"/>` +
        `<path d="M0-12c0 5-3 8-7 8M0-12c0 5 3 8 7 8M0 12c0-5-3-8-7-8M0 12c0-5 3-8 7-8" stroke="#c9a227" stroke-width="2"/>` +
        `<circle r="2.6" fill="#a9821f"/></g>`,
    ),
);

// The shells in the corners of the old "היכל".
const FANS = svg(
  `<rect x="3" y="3" width="114" height="114" rx="5" stroke="#c9a227" stroke-width="4"/>` +
    `<rect x="9" y="9" width="102" height="102" rx="3" stroke="#f6e3a8" stroke-width="1.4"/>` +
    inCorners(
      `<path d="M3 3h26C29 17 17 29 3 29Z" fill="#f6e3a8" stroke="#a9821f" stroke-width="1.4"/>` +
        `<path d="M3 3 29 3M3 3 27 12M3 3 21 21M3 3 12 27M3 3 3 29" stroke="#a9821f" stroke-width="1.2"/>`,
    ),
);

// The braided gold of the old "היכל שיש" arches.
const BRAID = svg(
  `<defs><pattern id="b" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
    `<rect width="8" height="8" fill="#d9b45a"/><rect width="2" height="8" fill="#8a6a1a"/><rect x="2" width="3" height="8" fill="#f6e3a8"/></pattern></defs>` +
    `<path fill-rule="evenodd" fill="url(#b)" d="M2 2h116v116H2zM12 12v96h96V12z"/>` +
    `<rect x="2" y="2" width="116" height="116" stroke="#8a6a1a" stroke-width="1.2"/><rect x="12" y="12" width="96" height="96" stroke="#8a6a1a" stroke-width="1.2"/>`,
);

export const FRAME_PICTURES: FramePicture[] = [
  { id: "gold-ornate", name: "זהב מעוטר", url: goldOrnate, slice: 32, width: 3 },
  { id: "carved-wood", name: "עץ מגולף", url: carvedWood, slice: 24, width: 3 },
  { id: "double-gold", name: "קו כפול זהב", url: DOUBLE("#c9a227", "#f2d98a"), slice: 14, width: 1.4 },
  { id: "double-silver", name: "קו כפול כסף", url: DOUBLE("#aeb6c2", "#eef1f5"), slice: 14, width: 1.4 },
  { id: "ornate-corners", name: "פינות מעוטרות", url: CORNERS, slice: 30, width: 3 },
  { id: "stepped", name: "פינות מדורגות", url: STEPPED, slice: 20, width: 2 },
  { id: "rope", name: "חבל זהב", url: ROPE, slice: 12, width: 1.4 },
  { id: "carved-gold", name: "מסגרת מגולפת", url: CARVED, slice: 30, width: 1.8 },
  { id: "rosette-corners", name: "שושנות בפינות", url: ROSETTES, slice: 30, width: 2.4 },
  { id: "fan-corners", name: "צדפות בפינות", url: FANS, slice: 30, width: 2.4 },
  { id: "braid", name: "קליעת זהב", url: BRAID, slice: 13, width: 1 },
  // The frames of the ready designs, with a clear middle: one for any box.
  { id: "emerald-gold", name: "זהב מסולסל", url: "/new-shul-assets/emerald-modular-frame.webp", slice: 20, width: 2.5 },
  { id: "sapphire-silver", name: "כסף ואבני ספיר", url: "/new-shul-assets/sapphire-modular-panel-frame.webp", slice: 20, width: 2.5 },
  { id: "sapphire-royal", name: "כסף מלכותי", url: "/new-shul-assets/sapphire-modular-outer-frame.webp", slice: 20, width: 2.5 },
];

export const framePictureRef = (id: string) => FRAME_PICTURE_PREFIX + id;

/** What the board loads: a ready-made frame's file, or an uploaded picture as it is. */
export function framePictureUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith(FRAME_PICTURE_PREFIX)) return value;
  const id = value.slice(FRAME_PICTURE_PREFIX.length);
  return FRAME_PICTURES.find((f) => f.id === id)?.url ?? null;
}
