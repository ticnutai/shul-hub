import type { TvConfig } from "./config";
import { TV_BACKDROPS, backdropRef, backdropUrl, findBackdrop } from "./backdrops";
import { DEFAULT_BACKGROUND_TUNE } from "./layers";
import { TV_GRADIENTS, type TvGradient } from "./themes";
import { isPictureFill } from "./layerCss";
import { isHiddenReady } from "./readyItems";

/**
 * Backgrounds, in one place.
 *
 * A colour, a gradient and a picture were three different screens - three
 * kinds of thing, when to whoever is choosing they are all one thing: what is
 * behind the board. So they are one kind of item here, kept in one gallery:
 *
 *   fill      a colour (a flat gradient) or a gradient - the background itself,
 *             or what shows while there is no picture
 *   picture   a picture over it (a ready backdrop or an uploaded one)
 *   overlay   a colour or a gradient laid over the picture, at `strength`;
 *             null: the theme's own colour, as the board always darkened it
 *   tune      its sliders: brightness, saturation, hue, blur, a tint
 *
 * The gallery is the ready-made examples and the shul's own (tv_config
 * .backgrounds) side by side; applying one writes it onto the board's own
 * fields, so a board reads exactly as before and deleting an item from the
 * gallery never changes a board that wears it.
 */
export type { SavedBackground } from "./backgroundItem";
import type { SavedBackground } from "./backgroundItem";
export { MAX_BACKGROUNDS, normalizeBackgrounds } from "./backgroundItem";


export type BackgroundKind = "colour" | "gradient" | "picture";

const FLAT = /^linear-gradient\(180deg, (#[0-9a-f]{6}), \1\)$/i;

export const flatFill = (colour: string) => `linear-gradient(180deg, ${colour}, ${colour})`;
/** The colour of a plain-colour fill, or null when it is a real gradient. */
export const flatColour = (fill: string | null | undefined): string | null => (fill ? FLAT.exec(fill)?.[1] ?? null : null);

export function newBackgroundId(): string {
  return `b_${Math.random().toString(36).slice(2, 10)}`;
}

export function kindOf(b: Pick<SavedBackground, "fill" | "picture">): BackgroundKind {
  if (b.picture) return "picture";
  return flatColour(b.fill) ? "colour" : "gradient";
}

const plain = (id: string, name: string, colour: string): SavedBackground => ({
  id, name, fill: flatFill(colour), picture: null, overlay: null, strength: 0.55, tune: DEFAULT_BACKGROUND_TUNE,
});
const fromGradient = (g: TvGradient, prefix = "x_"): SavedBackground => ({
  id: `${prefix}${g.id}`, name: g.name, fill: g.value, picture: null, overlay: null, strength: 0.55, tune: DEFAULT_BACKGROUND_TUNE,
});
const picture = (id: string, name: string, backdrop: string, overlay: string | null = null, strength = 0.55): SavedBackground => ({
  id, name, fill: null, picture: backdropRef(backdrop), overlay, strength, tune: DEFAULT_BACKGROUND_TUNE,
});

/**
 * The ready-made examples: colours, gradients, pictures, and pictures with a
 * colour over them. Built on first use, not at load: this file is reached from
 * config.ts while the lists it reads are still loading.
 */
let builtins: SavedBackground[] | null = null;
export const builtinBackgrounds = (): SavedBackground[] => (builtins ??= [
  plain("x_c_navy", "כחול לילה", "#0b1628"),
  plain("x_c_bordeaux", "בורדו", "#2a0a12"),
  plain("x_c_forest", "ירוק עמוק", "#0f2a1d"),
  plain("x_c_charcoal", "פחם", "#1d1f24"),
  plain("x_c_stone", "אבן חמה", "#e8dcc4"),
  plain("x_c_parchment", "קלף", "#f7f1e3"),
  ...TV_GRADIENTS.map((g) => fromGradient(g)),
  ...TV_BACKDROPS.map((b) => picture(`x_p_${b.id}`, b.name, b.id)),
  picture("x_m_sky_night", "שמיים בערב", "sky", "linear-gradient(180deg, #0b1628, #1b3054)", 0.55),
  picture("x_m_clouds_gold", "עננים בזהב", "clouds", "linear-gradient(160deg, #3d2a08, #d8ab35)", 0.45),
  picture("x_m_dawn_wine", "שחר בבורדו", "dawn", "linear-gradient(160deg, #14080b, #3d101a)", 0.5),
].filter((b) => !b.picture || findBackdrop(b.picture)));

/** The background the board wears now. */
export function backgroundOf(c: TvConfig): Omit<SavedBackground, "id" | "name"> {
  return {
    fill: c.backgroundGradient,
    picture: c.backgroundImage,
    overlay: c.backgroundImage ? c.backgroundOverlay : null,
    strength: c.backgroundDim,
    tune: c.backgroundTune,
  };
}

/** The board wearing `b`: its fields written onto the board's own. */
export function applyBackground(c: TvConfig, b: Omit<SavedBackground, "id" | "name">): TvConfig {
  return {
    ...c,
    backgroundGradient: b.fill,
    backgroundImage: b.picture,
    backgroundOverlay: b.picture ? b.overlay : null,
    backgroundDim: b.strength,
    backgroundTune: b.tune,
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Is the board wearing this item? A picture item matches on its picture and overlay; the fill under it does not show. */
export function wears(c: TvConfig, b: SavedBackground): boolean {
  const now = backgroundOf(c);
  if (b.picture) return now.picture === b.picture && now.overlay === b.overlay;
  return !now.picture && now.fill === b.fill;
}

/** Is the board wearing this item exactly as it was saved, sliders and all? */
export function wearsExactly(c: TvConfig, b: SavedBackground): boolean {
  const { id: _id, name: _name, ...look } = b;
  const now = backgroundOf(c);
  // Without a picture the strength does nothing, so it does not count.
  return same({ ...now, strength: b.picture ? now.strength : look.strength }, look);
}

/** The gallery: the shul's own first (newest first), then the ready-made examples it has not hidden. */
/**
 * The board's own background written the one way, wherever it is chosen:
 * null takes everything off (back to the base colours), a picture goes under
 * whatever is over it, and a colour or a gradient replaces the picture and
 * the layer that was over it. The design tab and the board's own panel both
 * write through here, so the same click does the same thing in both.
 */
export function writeBoardBackground(c: TvConfig, value: string | null): TvConfig {
  if (value === null) return { ...c, backgroundGradient: null, backgroundImage: null, backgroundOverlay: null };
  if (isPictureFill(value)) return { ...c, backgroundImage: value };
  return { ...c, backgroundGradient: value, backgroundImage: null, backgroundOverlay: null };
}

export function galleryOf(c: Pick<TvConfig, "backgrounds" | "hiddenReady">): SavedBackground[] {
  return [...c.backgrounds, ...builtinBackgrounds().filter((b) => !isHiddenReady(c, "bg", b.id))];
}

/** The ready-made backgrounds this board hid (to bring back). */
export function hiddenBackgrounds(c: Pick<TvConfig, "hiddenReady">): SavedBackground[] {
  return builtinBackgrounds().filter((b) => isHiddenReady(c, "bg", b.id));
}

/** What a tile shows: the picture's URL (or null) and the fill/overlay to paint. */
export function tileOf(b: Pick<SavedBackground, "fill" | "picture" | "overlay" | "strength">) {
  return { picture: backdropUrl(b.picture), thumb: findBackdrop(b.picture)?.thumb ?? backdropUrl(b.picture), fill: b.fill, overlay: b.overlay, strength: b.strength };
}
