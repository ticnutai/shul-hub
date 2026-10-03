import { normalizeBackgroundTune, type BackgroundTune } from "./layers";
import { isSafeCssValue, isSafeGradient, type TvGradient } from "./themes";

/**
 * One background in the gallery, and reading the gallery from storage.
 *
 * Apart from backgrounds.ts because the board's settings (config.ts) read the
 * gallery, and backgrounds.ts reaches the ready backdrops, which read the
 * settings: a circle. This file needs neither.
 */
export interface SavedBackground {
  /** "b_…" for the shul's own; "x_…" for a ready-made one. */
  id: string;
  name: string;
  /** A colour (a flat gradient) or a gradient: the background itself, or what shows while there is no picture. */
  fill: string | null;
  /** A picture over it: a ready backdrop ("backdrop:<id>") or an uploaded one (https). */
  picture: string | null;
  /** A colour or a gradient over the picture, at `strength`; null: the theme's own colour. */
  overlay: string | null;
  /** How strongly the overlay (or the theme's colour) lies over the picture, 0-0.95. */
  strength: number;
  /** Its sliders. */
  tune: BackgroundTune;
}

export const MAX_BACKGROUNDS = 60;
const OWN_ID = /^b_[a-z0-9]{4,16}$/;

const safePicture = (p: unknown): p is string =>
  typeof p === "string" && (p.startsWith("https://") || p.startsWith("backdrop:")) && !/["'()\s<>]/.test(p);
const safeFill = (f: unknown): f is string => typeof f === "string" && isSafeGradient(f);
const safeOverlay = (o: unknown): o is string => typeof o === "string" && (isSafeGradient(o) || isSafeCssValue(o));

/**
 * The shul's backgrounds from storage. Before there was a gallery, saved
 * gradients were a list of their own (tv_config.gradients): with no gallery
 * yet stored, those become its first items, so nothing saved is lost.
 */
export function normalizeBackgrounds(raw: unknown, legacyGradients: TvGradient[]): SavedBackground[] {
  // "u_xxxx" saved gradients keep their letters: "b_xxxx".
  if (!Array.isArray(raw))
    return legacyGradients.map((g) => ({
      id: `b_${g.id.slice(2, 18)}`,
      name: g.name,
      fill: g.value,
      picture: null,
      overlay: null,
      strength: 0.55,
      tune: normalizeBackgroundTune(undefined),
    }));
  const out: SavedBackground[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const b = r as Record<string, unknown>;
    if (typeof b.id !== "string" || !OWN_ID.test(b.id) || seen.has(b.id)) continue;
    const fill = safeFill(b.fill) ? b.fill.trim() : null;
    const pic = safePicture(b.picture) ? b.picture : null;
    if (!fill && !pic) continue;
    seen.add(b.id);
    out.push({
      id: b.id,
      name: (typeof b.name === "string" ? b.name : "").trim().slice(0, 40) || "רקע",
      fill,
      picture: pic,
      overlay: pic && safeOverlay(b.overlay) ? b.overlay.trim() : null,
      strength: typeof b.strength === "number" && Number.isFinite(b.strength) ? Math.min(0.95, Math.max(0, b.strength)) : 0.55,
      tune: normalizeBackgroundTune(b.tune),
    });
    if (out.length >= MAX_BACKGROUNDS) break;
  }
  return out;
}

