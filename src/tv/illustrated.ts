import type { IllustrationId } from "./config";
import { isSafeCssValue, isSafeUrl } from "./themes";
import type { ResolvedMinyan } from "@community/lib/minyan-time";
import type { BoardSlide } from "./useBoardData";

type PrayerSlide = Extract<BoardSlide, { kind: "prayer" }>;

/**
 * The painted boards of the "illustrated" layout: one picture each, with the
 * places where the day's times are written into it.
 *
 * The pictures and their frames come from the tablets editor's template
 * gallery (digital-prayer-canvas, TemplateBoard.tsx), so a board chosen there
 * looks the same here - but here every word in the frames is live: the clock,
 * the Hebrew date, today's minyanim with their exceptions, the zmanim, the
 * parasha and candle lighting.
 *
 * Boxes are [x1, y1, x2, y2] in percent of the picture (1920×1088). The
 * colours belong to the picture, not to the theme: gold ink on parchment is
 * part of the painting, and a theme meant for a flat board would fight it.
 * No image imports here, so tests and the config can read this file.
 *
 * Besides the four built in, the admin can import painted boards from a
 * design-tokens file (the `illustrations` key, see DESIGN_TOKENS_SPEC.md
 * §8.2). Those are stored as `customIllustrations`: the same frames and inks,
 * with the picture uploaded to storage and kept as its URL.
 */

export type Box = [number, number, number, number];

export interface Illustration {
  /** A built-in id, or "i_…" for an imported one. */
  id: string;
  name: string;
  hint: string;
  /** Text on the parchment. */
  ink: string;
  /** Titles and times. */
  accent: string;
  /** The clock's figures, on whatever the clock sits on. */
  clockInk: string;
  boxes: {
    clock: Box;
    plaqueR: Box;
    plaqueL: Box;
    panelR: Box;
    panelL: Box;
    barR?: Box;
    barL?: Box;
  };
  /** Carved wood: the name across the top and a Shabbat panel in the middle. */
  centrePanel?: boolean;
}

/** An imported painted board: its picture lives in storage, not in the config. */
export interface CustomIllustration extends Illustration {
  image: string;
}

export const ILLUSTRATION_DEFS: Illustration[] = [
  {
    id: "curtain",
    name: "וילון כחול וזהב",
    hint: "פרוכת קטיפה, מסגרות זהב ושעון במדליון",
    ink: "#1f2d5c",
    accent: "#8a5a12",
    clockInk: "#ffffff",
    boxes: {
      clock: [44, 5, 56, 26],
      plaqueR: [62, 10, 88, 25],
      plaqueL: [12, 10, 38, 25],
      panelR: [54, 34, 97, 84],
      panelL: [4, 34, 46, 84],
      barR: [57, 90, 93, 95],
      barL: [7, 90, 43, 95],
    },
  },
  {
    id: "stone",
    name: "לוחות הברית מאבן",
    hint: "שני לוחות מקושתים על קיר אבן",
    ink: "#3a2a12",
    accent: "#8a5d12",
    clockInk: "#3a2a12",
    boxes: {
      clock: [45, 3, 55, 20],
      plaqueR: [61, 4, 92, 15],
      plaqueL: [8, 4, 40, 15],
      panelR: [53, 30, 84, 88],
      panelL: [16, 30, 47, 88],
    },
  },
  {
    id: "wood",
    name: "מסגרת עץ מעוטרת",
    hint: "עץ מגולף, שמיים ופינת שבת באמצע",
    ink: "#2b1d0c",
    accent: "#7a3e10",
    clockInk: "#2b1d0c",
    boxes: {
      clock: [8, 10, 24, 21],
      plaqueR: [70, 10, 92, 21],
      plaqueL: [30, 10, 70, 21],
      panelR: [72, 27, 93, 88],
      panelL: [7, 27, 28, 88],
      barR: [48, 30, 68, 70],
    },
    centrePanel: true,
  },
  {
    id: "modern",
    name: "מודרני נקי",
    hint: "כהה ונקי עם פסי זהב",
    ink: "#f3f5f8",
    accent: "#e6c27a",
    clockInk: "#f3f1ea",
    boxes: {
      clock: [43, 4, 57, 27],
      plaqueR: [61, 17, 90, 25],
      plaqueL: [10, 17, 39, 25],
      panelR: [53, 32, 90, 80],
      panelL: [10, 32, 47, 80],
      barL: [10, 86, 90, 91],
    },
  },
];

export function illustrationDef(id: string, custom: readonly CustomIllustration[] = []): Illustration | CustomIllustration {
  return ILLUSTRATION_DEFS.find((d) => d.id === id) ?? custom.find((d) => d.id === id) ?? ILLUSTRATION_DEFS[0];
}

export function isBuiltinIllustration(id: string): id is IllustrationId {
  return ILLUSTRATION_DEFS.some((d) => d.id === id);
}

/* ------------------------------------------------ imported painted boards -- */

export const MAX_CUSTOM_ILLUSTRATIONS = 12;
export const CUSTOM_ILLUSTRATION_ID_RE = /^i_[a-z0-9]{6,12}$/;
const BOX_KEYS = ["clock", "plaqueR", "plaqueL", "panelR", "panelL", "barR", "barL"] as const;
const REQUIRED_BOXES = ["clock", "plaqueR", "plaqueL", "panelR", "panelL"] as const;

export function newIllustrationId(): string {
  return `i_${Math.random().toString(36).slice(2, 10)}`;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** A frame inside the picture, with some size to it. Anything else is not a frame. */
function readBox(v: unknown): Box | null {
  if (!Array.isArray(v) || v.length !== 4) return null;
  const n = v.map((x) => (typeof x === "number" && Number.isFinite(x) ? Math.round(x * 10) / 10 : NaN));
  const [x1, y1, x2, y2] = n;
  if (n.some((x) => Number.isNaN(x) || x < 0 || x > 100) || x2 - x1 < 2 || y2 - y1 < 2) return null;
  return [x1, y1, x2, y2];
}

/**
 * The frames, inks and name of a painted board from untrusted data - a
 * stored config or an imported file. null when anything that places text
 * on the picture is missing or unsafe: a board with a frame in the wrong
 * place writes the times over the painting, so it is refused whole.
 */
function readShape(raw: Record<string, unknown>): Omit<Illustration, "id"> | null {
  const b = isObj(raw.boxes) ? raw.boxes : null;
  if (!b) return null;
  const boxes = {} as Illustration["boxes"];
  for (const k of BOX_KEYS) {
    if (b[k] === undefined) continue;
    const box = readBox(b[k]);
    if (!box) return null;
    boxes[k] = box;
  }
  if (REQUIRED_BOXES.some((k) => !boxes[k])) return null;
  const colour = (v: unknown) => (typeof v === "string" && isSafeCssValue(v) ? v.trim() : null);
  const ink = colour(raw.ink);
  const accent = colour(raw.accent);
  const clockInk = colour(raw.clockInk);
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 40) : "";
  if (!ink || !accent || !clockInk || !name) return null;
  return {
    name,
    hint: typeof raw.hint === "string" ? raw.hint.trim().slice(0, 80) : "",
    ink,
    accent,
    clockInk,
    boxes,
    centrePanel: raw.centrePanel === true,
  };
}

/** Stored imported boards: only uploaded (https) pictures, sane frames, unique ids. */
export function normalizeCustomIllustrations(raw: unknown): CustomIllustration[] {
  const out: CustomIllustration[] = [];
  const seen = new Set<string>();
  for (const v of Array.isArray(raw) ? raw : []) {
    if (!isObj(v) || typeof v.id !== "string" || !CUSTOM_ILLUSTRATION_ID_RE.test(v.id) || seen.has(v.id)) continue;
    if (typeof v.image !== "string" || !/^https:\/\//i.test(v.image) || !isSafeUrl(v.image)) continue;
    const shape = readShape(v);
    if (!shape) continue;
    seen.add(v.id);
    out.push({ ...shape, id: v.id, image: v.image.trim() });
    if (out.length >= MAX_CUSTOM_ILLUSTRATIONS) break;
  }
  return out;
}

/**
 * A painted board as it travels in a file. The picture is inside the file
 * (a data: URL), never a link: a link would make every TV fetch from
 * whoever wrote the file, and could change after the admin looked at it.
 */
export interface PortableIllustration extends Omit<Illustration, "id"> {
  image: string;
}

/** Pictures a file may carry: what the TV draws natively. No SVG - it can hold script and links. */
const DATA_IMAGE_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
/** About 7.5 MB of picture: well above a painted board, well below a problem. */
export const MAX_IMAGE_DATA_CHARS = 10_000_000;

export function readPortableIllustration(raw: unknown): PortableIllustration | null {
  if (!isObj(raw) || typeof raw.image !== "string") return null;
  const image = raw.image.trim();
  if (image.length > MAX_IMAGE_DATA_CHARS || !DATA_IMAGE_RE.test(image)) return null;
  const shape = readShape(raw);
  return shape ? { ...shape, image } : null;
}

export function toPortableIllustration(d: Illustration, image: string): PortableIllustration {
  const { id: _id, ...shape } = d;
  return { ...shape, image };
}

/**
 * A file's board that is one of the four built in - same name, frames and
 * inks - is not uploaded a second time: the built-in is used instead.
 */
export function builtinTwin(p: Omit<Illustration, "id">): IllustrationId | null {
  const same = (a: Illustration["boxes"], b: Illustration["boxes"]) =>
    BOX_KEYS.every((k) => JSON.stringify(a[k] ?? null) === JSON.stringify(b[k] ?? null));
  const twin = ILLUSTRATION_DEFS.find(
    (d) =>
      d.name === p.name &&
      d.ink.toLowerCase() === p.ink.toLowerCase() &&
      d.accent.toLowerCase() === p.accent.toLowerCase() &&
      d.clockInk.toLowerCase() === p.clockInk.toLowerCase() &&
      same(d.boxes, p.boxes),
  );
  return twin ? (twin.id as IllustrationId) : null;
}

/** How many rows a painted frame holds and still reads from the back of the hall. */
export const ILLUSTRATED_ROWS = 7;

/**
 * Which of today's rows a painted frame shows, as [start, end).
 *
 * A frame drawn for five lines cannot take fourteen minyanim, and shrinking
 * the type until they fit makes all of them unreadable. So when there are
 * more rows than room, the frame shows the ones that matter now: from the one
 * just gone (a latecomer looks for it) through the next ones. Before the
 * first minyan that is the start of the day; after the last, the end of it.
 */
export function rowWindow(count: number, nextIndex: number, max = ILLUSTRATED_ROWS): [number, number] {
  if (count <= max) return [0, count];
  const anchor = nextIndex < 0 ? count : nextIndex;
  const start = Math.min(Math.max(0, anchor - 1), count - max);
  return [start, start + max];
}

/** A picture from a file, as something the uploader takes (validated by readPortableIllustration first). */
export function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, body] = dataUrl.split(",", 2);
  const type = /^data:(image\/(?:jpeg|png|webp));base64$/.exec(head)?.[1];
  if (!type || !body) throw new Error("התמונה בקובץ אינה בפורמט נתמך");
  const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  const ext = type === "image/jpeg" ? "jpg" : type.slice(6);
  return new File([bytes], `${name.replace(/[^\p{L}\p{N}]+/gu, "-") || "board"}.${ext}`, { type });
}

/** A stored picture back into a file: fetched, and written inside it as a data: URL. */
export async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`הורדת התמונה נכשלה (${res.status})`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("קריאת התמונה נכשלה"));
    reader.readAsDataURL(blob);
  });
}

/**
 * One frame holds all of today's minyanim: every prayer schedule on the board
 * (today's category and any that stand alone, like סליחות), in time order.
 * Taking only the first schedule dropped סליחות on a Friday.
 */
export function todaysRows(slides: BoardSlide[]): ResolvedMinyan[] {
  const seen = new Set<string>();
  return slides
    .filter((s): s is PrayerSlide => s.kind === "prayer")
    .flatMap((s) => s.rows)
    .filter((r) => (seen.has(r.minyan.id) ? false : (seen.add(r.minyan.id), true)))
    .sort((a, b) => a.minutes - b.minutes);
}

