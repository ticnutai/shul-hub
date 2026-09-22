/**
 * The ready-made board backgrounds.
 *
 * Sky, light, stone, parchment, velvet and still water: surfaces a board can
 * stand on without arguing with it. Drawn, not photographed - see
 * scripts/tv-backdrops.mjs, which bakes them from gradients and noise, so
 * nothing here is downloaded or licensed and each one costs a few kilobytes.
 *
 * What they are deliberately not is pictures of anything. No figures, no
 * faces, no place. A board carries prayer times that have to be read across
 * a hall, so a background that draws the eye has already failed; and what
 * hangs on the wall of a shul is a decision for the people who daven there,
 * not for a piece of software. A gabbai who wants a particular picture can
 * upload one.
 *
 * `light` says whether dark text belongs on it, which is how the editor
 * warns that a pale backdrop under a dark theme will not be readable.
 *
 * Stored as "backdrop:<id>" rather than as a path, so that the board keeps
 * its background when the build changes and the file is renamed.
 */
import { BACKDROP_PREFIX, isBackdropRef } from "./config";

import dawn from "./assets/backdrops/dawn.jpg";
import dawnThumb from "./assets/backdrops/dawn-thumb.jpg";
import dusk from "./assets/backdrops/dusk.jpg";
import duskThumb from "./assets/backdrops/dusk-thumb.jpg";
import night from "./assets/backdrops/night.jpg";
import nightThumb from "./assets/backdrops/night-thumb.jpg";
import morning from "./assets/backdrops/morning.jpg";
import morningThumb from "./assets/backdrops/morning-thumb.jpg";
import stone from "./assets/backdrops/stone.jpg";
import stoneThumb from "./assets/backdrops/stone-thumb.jpg";
import parchment from "./assets/backdrops/parchment.jpg";
import parchmentThumb from "./assets/backdrops/parchment-thumb.jpg";
import velvet from "./assets/backdrops/velvet.jpg";
import velvetThumb from "./assets/backdrops/velvet-thumb.jpg";
import waters from "./assets/backdrops/waters.jpg";
import watersThumb from "./assets/backdrops/waters-thumb.jpg";

export interface Backdrop {
  id: string;
  name: string;
  /** One line under the name in the picker. */
  note: string;
  /** True when it is pale, and so wants a light theme over it. */
  light: boolean;
  url: string;
  thumb: string;
}

export const TV_BACKDROPS: Backdrop[] = [
  { id: "dawn", name: "עלות השחר", note: "כחול עמוק שנפתח לאור ראשון", light: false, url: dawn, thumb: dawnThumb },
  { id: "dusk", name: "בין הערביים", note: "אור חם ששוקע לכחול לילה", light: false, url: dusk, thumb: duskThumb },
  { id: "night", name: "ליל כוכבים", note: "לילה עמוק עם כוכבים דקים", light: false, url: night, thumb: nightThumb },
  { id: "morning", name: "אור הבוקר", note: "אור רך שיורד מלמעלה", light: true, url: morning, thumb: morningThumb },
  { id: "stone", name: "אבן ירושלים", note: "אבן חמה ובהירה", light: true, url: stone, thumb: stoneThumb },
  { id: "parchment", name: "קלף", note: "קלף ישן, חם ונקי", light: true, url: parchment, thumb: parchmentThumb },
  { id: "velvet", name: "פרוכת", note: "קטיפה עמוקה עם ברק רך", light: false, url: velvet, thumb: velvetThumb },
  { id: "waters", name: "מי מנוחות", note: "כחול שקט, אור על פני המים", light: false, url: waters, thumb: watersThumb },
];

const PREFIX = BACKDROP_PREFIX;

export { isBackdropRef };

export function backdropRef(id: string): string {
  return PREFIX + id;
}

export function findBackdrop(value: string | null | undefined): Backdrop | null {
  if (!isBackdropRef(value)) return null;
  const id = (value as string).slice(PREFIX.length);
  return TV_BACKDROPS.find((b) => b.id === id) ?? null;
}

/**
 * What the board should actually load.
 *
 * A "backdrop:" reference becomes the file this build shipped; anything
 * else is an uploaded picture and is handed back untouched. A reference to
 * a backdrop that no longer exists becomes nothing, which shows the theme's
 * own background rather than a broken image.
 */
export function backdropUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!isBackdropRef(value)) return value;
  return findBackdrop(value)?.url ?? null;
}
