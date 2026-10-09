/**
 * Hebrew combining marks (niqqud U+05B0–U+05C7, te'amim U+0591–U+05AF) per
 * selectable font.
 *
 * Browsers shape a letter and its marks as one cluster. When the chosen font
 * lacks one of the marks, the WHOLE cluster (base letter included) is drawn
 * from a fallback font, so that letter comes out in another face: different
 * shape, height and width from its neighbours. Adding a marks-only fallback
 * face (unicode-range) does not help: the cluster still moves as a unit.
 *
 * The table lists the marks each web font is missing, measured in Chromium by
 * comparing widths with a huge vs. tiny fallback face (a difference means the
 * cluster fell back). Every font below has the ordinary niqqud; none of the
 * Google Fonts builds has the cantillation block except Noto Serif Hebrew,
 * which is also bundled with the app (src/assets/fonts) and has U+0591–U+05C7
 * in full. Fonts not listed (system fonts such as Arial / Times New Roman,
 * which come from one system face either way) are left as they are.
 */
export const FULL_MARKS_FONT = "Noto Serif Hebrew";

const TAAMIM = "֑-֯";
const METEG = "ֽ"; // also silluq
const RAFE = "ֿ";
const UPPER_LOWER_DOT = "ׅׄ";

const MISSING_MARKS: Record<string, string> = {
  "David Libre": TAAMIM + METEG,
  "Frank Ruhl Libre": TAAMIM + UPPER_LOWER_DOT,
  "Heebo": TAAMIM + METEG + UPPER_LOWER_DOT,
  "Assistant": TAAMIM + METEG + UPPER_LOWER_DOT,
  "Miriam Libre": TAAMIM + METEG + RAFE + UPPER_LOWER_DOT,
  "Rubik": TAAMIM + METEG + RAFE + UPPER_LOWER_DOT,
  "Alef": TAAMIM + METEG + RAFE + UPPER_LOWER_DOT,
  "Varela Round": TAAMIM + METEG + RAFE + UPPER_LOWER_DOT,
  "Secular One": TAAMIM + METEG + RAFE + UPPER_LOWER_DOT,
  "Suez One": TAAMIM + METEG + RAFE + UPPER_LOWER_DOT,
};

/**
 * The face that stands in for a chosen font where marks it lacks are needed
 * (src/index.css, "Taamim <family>"): the Culmus "Taamey" twin of David and
 * Frank Ruehl, Noto Serif Hebrew for the rest - every one scaled so its
 * letters are exactly as tall as the chosen font's.
 */
export function fullMarksFamily(family: string): string {
  return family in MISSING_MARKS ? `Taamim ${family}` : FULL_MARKS_FONT;
}

/** Fonts whose stand-in is their own design (the same letters, with every mark): used for all marked text. */
export const TWIN_DESIGN = new Set(["David Libre", "Frank Ruhl Libre"]);

const missingRe = new Map<string, RegExp>();
const missingMarksRe = (family: string): RegExp | null => {
  const chars = MISSING_MARKS[family];
  if (!chars) return null;
  let re = missingRe.get(family);
  if (!re) missingRe.set(family, (re = new RegExp(`[${chars}]`, "g")));
  return re;
};

/** First family of a CSS font-family list, unquoted. */
export function primaryFontFamily(fontFamily: string): string {
  return fontFamily.replace(/["']/g, "").split(",")[0].trim();
}

/** Does any of the texts contain a mark that the font cannot draw itself? */
export function needsFullMarksFont(fontFamily: string | undefined, texts: string | readonly string[]): boolean {
  if (!fontFamily) return false;
  const re = missingMarksRe(primaryFontFamily(fontFamily));
  if (!re) return false;
  const list = typeof texts === "string" ? [texts] : texts;
  return list.some((t) => { re.lastIndex = 0; return re.test(t); });
}

/**
 * The font-family to render marked Hebrew text with: the chosen font, unless
 * the text carries marks it lacks (te'amim, meteg...) - then the whole text
 * moves to Noto Serif Hebrew so no single letter is drawn from another font.
 */
export function markSafeFontFamily<T extends string | undefined>(fontFamily: T, texts: string | readonly string[]): T | string {
  if (!needsFullMarksFont(fontFamily, texts)) return fontFamily;
  return `'${fullMarksFamily(primaryFontFamily(fontFamily!))}', '${FULL_MARKS_FONT}', serif`;
}

/**
 * Drops the marks the font lacks (used where the te'amim are already off and
 * only a stray meteg / rafe would otherwise pull single letters into a
 * fallback font).
 */
export function stripMarksMissingFrom(fontFamily: string, text: string): string {
  const re = missingMarksRe(primaryFontFamily(fontFamily));
  return re ? text.replace(re, "") : text;
}
