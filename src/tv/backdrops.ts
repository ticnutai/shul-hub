/**
 * The ready-made board backgrounds.
 *
 * Sky, light, stone, parchment, velvet, still water, and the walls the
 * painted boards stood on (blue velvet, cut stone, wood, a dark hall): surfaces a board can
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

import skyDay from "./assets/backdrops/sky.jpg";
import skyDayThumb from "./assets/backdrops/sky-thumb.jpg";
import clouds from "./assets/backdrops/clouds.jpg";
import cloudsThumb from "./assets/backdrops/clouds-thumb.jpg";
import haze from "./assets/backdrops/haze.jpg";
import hazeThumb from "./assets/backdrops/haze-thumb.jpg";
import cirrus from "./assets/backdrops/cirrus.jpg";
import cirrusThumb from "./assets/backdrops/cirrus-thumb.jpg";
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
import royal from "./assets/backdrops/royal.jpg";
import royalThumb from "./assets/backdrops/royal-thumb.jpg";
import wall from "./assets/backdrops/wall.jpg";
import wallThumb from "./assets/backdrops/wall-thumb.jpg";
import wood from "./assets/backdrops/wood.jpg";
import woodThumb from "./assets/backdrops/wood-thumb.jpg";
import hall from "./assets/backdrops/hall.jpg";
import hallThumb from "./assets/backdrops/hall-thumb.jpg";
// The materials of the old designed frames (scripts/tv-textures.mjs).
import marble from "./assets/tex-marble.jpg";
import marbleThumb from "./assets/tex-marble-thumb.jpg";
import marbleDark from "./assets/tex-marble-dark.jpg";
import marbleDarkThumb from "./assets/tex-marble-dark-thumb.jpg";
import gold from "./assets/tex-gold.jpg";
import goldThumb from "./assets/tex-gold-thumb.jpg";
import walnut from "./assets/tex-walnut.jpg";
import walnutThumb from "./assets/tex-walnut-thumb.jpg";
import stoneRough from "./assets/tex-stone.jpg";
import stoneRoughThumb from "./assets/tex-stone-thumb.jpg";
import parchmentAged from "./assets/tex-parchment.jpg";
import parchmentAgedThumb from "./assets/tex-parchment-thumb.jpg";
import velvetNap from "./assets/tex-velvet.jpg";
import velvetNapThumb from "./assets/tex-velvet-thumb.jpg";

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
  // Daylight skies first: the ones most boards will want.
  { id: "sky", name: "שמי תכלת", note: "תכלת עם עננים לבנים", light: true, url: skyDay, thumb: skyDayThumb },
  { id: "clouds", name: "ענני בוקר", note: "עננים רכים ומפוזרים", light: true, url: clouds, thumb: cloudsThumb },
  { id: "haze", name: "שמיים רכים", note: "תכלת שקטה, כמעט בלי צורות", light: true, url: haze, thumb: hazeThumb },
  { id: "cirrus", name: "עננים גבוהים", note: "פסי ענן דקים ורגועים", light: true, url: cirrus, thumb: cirrusThumb },
  { id: "dawn", name: "עלות השחר", note: "כחול עמוק שנפתח לאור ראשון", light: false, url: dawn, thumb: dawnThumb },
  { id: "dusk", name: "בין הערביים", note: "אור חם ששוקע לכחול לילה", light: false, url: dusk, thumb: duskThumb },
  { id: "night", name: "ליל כוכבים", note: "לילה עמוק עם כוכבים דקים", light: false, url: night, thumb: nightThumb },
  { id: "morning", name: "אור הבוקר", note: "אור רך שיורד מלמעלה", light: true, url: morning, thumb: morningThumb },
  { id: "stone", name: "אבן ירושלים", note: "אבן חמה ובהירה", light: true, url: stone, thumb: stoneThumb },
  { id: "parchment", name: "קלף", note: "קלף ישן, חם ונקי", light: true, url: parchment, thumb: parchmentThumb },
  { id: "velvet", name: "פרוכת", note: "קטיפה עמוקה עם ברק רך", light: false, url: velvet, thumb: velvetThumb },
  { id: "waters", name: "מי מנוחות", note: "כחול שקט, אור על פני המים", light: false, url: waters, thumb: watersThumb },
  // The walls the painted boards stood on, as backgrounds for any frames.
  { id: "royal", name: "קטיפה כחולה", note: "וילון קטיפה כחול עם קפלים", light: false, url: royal, thumb: royalThumb },
  { id: "wall", name: "קיר אבנים", note: "אבן ירושלמית חתוכה, שורה על שורה", light: true, url: wall, thumb: wallThumb },
  { id: "wood", name: "עץ אגוז", note: "עץ כהה וחם", light: false, url: wood, thumb: woodThumb },
  { id: "hall", name: "אולם כהה", note: "כהה, קשתות בצדדים ואור חם למטה", light: false, url: hall, thumb: hallThumb },
  // Materials, for a box as much as for the board.
  { id: "marble", name: "שיש לבן", note: "שיש קרם עם עורקים אפורים", light: true, url: marble, thumb: marbleThumb },
  { id: "marble-dark", name: "שיש כחול", note: "שיש כחול כהה, לטקסט בהיר", light: false, url: marbleDark, thumb: marbleDarkThumb },
  { id: "gold-leaf", name: "זהב מוברש", note: "מתכת זהב, לכותרות ולמסגרות", light: true, url: gold, thumb: goldThumb },
  { id: "walnut", name: "עץ מלוטש", note: "עץ אגוז כהה עם סיבים", light: false, url: walnut, thumb: walnutThumb },
  { id: "stone-rough", name: "אבן מחוספסת", note: "אבן ירושלים מחוספסת", light: true, url: stoneRough, thumb: stoneRoughThumb },
  { id: "parchment-aged", name: "קלף ישן", note: "קלף עתיק וחם", light: true, url: parchmentAged, thumb: parchmentAgedThumb },
  { id: "velvet-nap", name: "קטיפה אדומה", note: "קטיפה עמוקה עם ברק רך", light: false, url: velvetNap, thumb: velvetNapThumb },
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
