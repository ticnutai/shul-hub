/**
 * The prayer book's text: the nusachot and categories, Hebrew numbers, cleaning and marking the source's lines, vowels and cantillation, and the type for showing them.
 * Split out of the prayer book's page (src/pages/Siddur.tsx).
 */
import { normalizeHebrewText } from "@/utils/textUtils";
import { FULL_MARKS_FONT, TWIN_DESIGN, fullMarksFamily, primaryFontFamily, stripMarksMissingFrom } from "@/lib/hebrewMarks";

/* ─── Nusach list ────────────────────────────────────────── */
export const NUSACHOT = [
  { id: "sefard",          label: "ספרד",           fullName: "נוסח ספרד"           },
  { id: "ashkenaz",        label: "אשכנז",          fullName: "נוסח אשכנז"          },
  { id: "edot_hamizrach",  label: "עדות המזרח",     fullName: "נוסח עדות המזרח"     },
  { id: "chabad",          label: "חב\"ד",           fullName: "נוסח חב\"ד"           },
];

/* ─── Category display order & metadata ─────────────────── */
export const CATEGORIES_ORDER = [
  "shacharit", "mincha", "arvit",
  "shabbat_kabbalat", "shabbat_arvit", "shabbat_shacharit",
  "shabbat_musaf",    "shabbat_mincha",
  "brachot", "other",
];
/* Tabs that are always shown regardless of nusach data */
export const STATIC_TABS = [
  { id: "tehillim", name: "תהילים"       },
  { id: "kria",     name: "קריאה בתורה" },
];
export const NUSACH_INDEP = new Set(["tehillim", "kria"]);

export function readingGutter(width: "narrow" | "normal" | "wide" | "full"): string {
  if (width === "narrow") return "clamp(18px, 5.5vw, 32px)";
  if (width === "wide") return "clamp(10px, 3.3vw, 18px)";
  if (width === "full") return "clamp(6px, 2.2vw, 12px)";
  return "clamp(14px, 4.2vw, 24px)";
}

/* ─── Hebrew numeral helper (1–150) ───────────────────────── */
export function heNum(n: number): string {
  const ones = ["","א","ב","ג","ד","ה","ו","ז","ח","ט"];
  const tens = ["","י","כ","ל","מ","נ","ס","ע","פ","צ"];
  const h   = n >= 100 ? "ק" : "";
  const rem = n % 100;
  if (rem === 15) return h + "ט\u05F4ו";
  if (rem === 16) return h + "ט\u05F4ז";
  return h + (tens[Math.floor(rem / 10)] || "") + (ones[rem % 10] || "");
}

/* ─── HTML line cleaner ──────────────────────────────────── */
/**
 * Some siddur source data uses self-closing pseudo-tags as bracket markers
 * around emphasized spans, e.g.  `<b/>פתיחת אליהו<b/>`  instead of the
 * proper `<b>פתיחת אליהו</b>`. Without normalization those tags slip past
 * `renderLineContent` (which only matches paired `<b>...</b>`) and end up
 * displayed as literal `<b/>` text in the UI.
 *
 * We pair occurrences of each self-closing tag — odd ones become opening
 * tags, even ones become closing tags. Any unmatched trailing opener is
 * dropped so we never emit invalid HTML.
 */
export function pairSelfClosingTags(html: string): string {
  for (const tag of ["b", "small"]) {
    const re = new RegExp(`<\\s*${tag}\\s*\\/\\s*>`, "gi");
    let count = 0;
    html = html.replace(re, () => (count++ % 2 === 0 ? `<${tag}>` : `</${tag}>`));
    if (count % 2 === 1) {
      // odd => last opener has no closer; strip it to avoid unclosed markup
      html = html.replace(new RegExp(`<${tag}>(?![\\s\\S]*<\\/${tag}>)`), "");
    }
  }
  return html;
}

/**
 * Stack-based normaliser for the only two inline tags we support (`b`, `small`).
 *
 * Guarantees well-formed, non-redundant markup:
 *  - `<big><b>X</b></big>` → (after big→b) `<b><b>X</b></b>` → `<b>X</b>`
 *  - `<small>X<small>Y</small></small>` → `<small>XY</small>`
 *  - drops closers with no matching opener and auto-closes unclosed openers,
 *    so no stray `</b>` / `</small>` can ever reach the UI as literal text
 *    (in RTL a stray `</b>` visually renders as `<b/>`).
 */
export type InlineTag = "b" | "small";

export function flattenNestedSameTags(html: string): string {
  const re = /<\/?(b|small)>/gi;
  const stack: InlineTag[] = [];
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out += html.slice(last, m.index);
    last = re.lastIndex;
    const tag = m[1].toLowerCase() as InlineTag;
    const isClose = m[0][1] === "/";
    if (isClose) {
      const idx = stack.lastIndexOf(tag);
      if (idx === -1) continue;                    // stray closer → drop
      if (idx !== stack.length - 1) continue;      // improperly nested → drop
      // Only emit the closer for the outermost occurrence of this tag.
      if (stack.indexOf(tag) === idx) out += `</${tag}>`;
      stack.pop();
    } else {
      if (!stack.includes(tag)) out += `<${tag}>`; // skip redundant nesting
      stack.push(tag);
    }
  }
  out += html.slice(last);
  // Auto-close anything left open (outermost occurrence only).
  const closed = new Set<InlineTag>();
  for (let i = stack.length - 1; i >= 0; i--) {
    const tag = stack[i];
    if (closed.has(tag)) continue;
    closed.add(tag);
    out += `</${tag}>`;
  }
  return out;
}

export function sanitizeHebrewMarkup(html: string): string {
  return flattenNestedSameTags(
    pairSelfClosingTags(
      normalizeHebrewText(html)
        .replace(/<\s*big\s*>/gi, "<b>")
        .replace(/<\s*\/\s*big\s*>/gi, "</b>")
        .replace(/<\s*big\s*\/\s*>/gi, "")
        .replace(/<\s*br\s*\/??\s*>/gi, "\n")
    )
      // Keep only supported inline tags to avoid raw tag names in the UI.
      .replace(/<\/?(?!b\b|small\b)[a-z0-9:-]+[^>]*>/gi, "")
  );
}

export function cleanLine(html: string): string {
  return sanitizeHebrewMarkup(html)
    .replace(/<[^>]*>/g, "")
    .replace(/&thinsp;/g, "\u2009")
    .replace(/&nbsp;/g, "\u00a0")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\{[פסנ]\}/g, "")
    .trim();
}

/* ─── Siddur line classification ───────────────────────────
   Three types:
   "heading"     — <b>short-title</b>  e.g. <b>קדושה</b>
   "instruction" — <small>...</small>  rubric / stage-direction
   "prayer"      — regular / bold-first-word prayer text
──────────────────────────────────────────────────────────── */
export const NIKUD_RE   = /[\u05B0-\u05C7\u05F0-\u05F4\uFB1D-\uFB4E]/g;
export const TAAMIM_RE  = /[\u0591-\u05AF]/g;
export const NIKUD_STRIP = /[\u05B0-\u05BD\u05BF\u05C1-\u05C2\u05C4-\u05C5\u05C7]/g;

/**
 * `fontFamily` (the reader's chosen font) also drops the few marks the font
 * that will draw the text lacks - a meteg in David Libre, say - which would
 * otherwise pull just those letters into a fallback font (see hebrewMarks.ts).
 */
export function stripText(text: string, showNikud: boolean, showTaamim: boolean, fontFamily?: string): string {
  // Normalize Hebrew presentation forms (e.g. שׁ) to standard letters + marks.
  // This keeps glyph metrics consistent across words in the same font.
  let t = normalizeHebrewText(text);
  if (!showTaamim) t = t.replace(TAAMIM_RE, "");
  if (!showNikud)  t = t.replace(NIKUD_STRIP, "");
  if (fontFamily && showNikud) t = stripMarksMissingFrom(nikudFontFamily(fontFamily, showNikud, showTaamim), t);
  // Drop combining marks left without a base letter (they render on a dotted
  // circle and push the line out of alignment).
  t = t.replace(/(^|[\s>])[\u0591-\u05C7]+/g, "$1");
  return t;
}

export function classifyLine(html: string): "heading" | "instruction" | "prayer" {
  // Run through the same sanitiser as rendering so wrappers like `<big>` and
  // self-closing `<b/>...<b/>` are recognised as headings just like the
  // canonical `<b>title</b>` form.
  const t = sanitizeHebrewMarkup(html).trim();
  if (t.startsWith("<small>")) return "instruction";
  const m = t.match(/^<b>([^<]+)<\/b>$/);
  if (m && m[1].replace(NIKUD_RE, "").replace(/\s/g, "").length <= 20) return "heading";
  return "prayer";
}

/* Parses <b> and inline <small> tags inside a prayer line into React nodes */
export function renderLineContent(html: string, emphasizeInline = false, openingWordCount = 0): React.ReactNode {
  let h = sanitizeHebrewMarkup(html)
    .replace(/&thinsp;/g, "\u2009")
    .replace(/&nbsp;/g, "\u00a0")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\{[פסנ]\}/g, "");
  // Prefer intentional emphasis from the source. When none exists, optionally
  // mark the requested number of opening words without changing the prayer.
  if (emphasizeInline && openingWordCount > 0 && !/<b>/i.test(h)) {
    const match = h.match(new RegExp(`^((?:\\S+\\s+){0,${openingWordCount - 1}}\\S+)`));
    if (match) h = `<b>${match[1]}</b>${h.slice(match[1].length)}`;
  }
  // Recursive descent over the (already well-formed) <b>/<small> markup so
  // mixed nesting like <b>x<small>y</small></b> renders correctly instead of
  // leaking literal tags into the text.
  const re = /<(\/?)(b|small)>/g;
  let key = 0;
  let pos = 0;

  const parse = (stopTag: InlineTag | null): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let m: RegExpExecArray | null;
    re.lastIndex = pos;
    while ((m = re.exec(h)) !== null) {
      if (m.index > pos) parts.push(h.slice(pos, m.index));
      pos = re.lastIndex;
      const tag = m[2].toLowerCase() as InlineTag;
      if (m[1]) {
        if (tag === stopTag) return parts;
        re.lastIndex = pos;
        continue;
      }
      const children = parse(tag);
      if (tag === "b") {
        parts.push(emphasizeInline
          ? <strong key={key++} style={{ fontWeight: 700 }}>{children}</strong>
          : <span key={key++}>{children}</span>);
      } else {
        parts.push(
          <span key={key++} style={{ fontSize: "0.77em", opacity: 0.65, fontStyle: "italic" }}>
            {children}
          </span>
        );
      }
      re.lastIndex = pos;
    }
    if (pos < h.length) {
      parts.push(h.slice(pos));
      pos = h.length;
    }
    return parts;
  };

  const parts = parse(null);
  return parts.length === 0 ? "" : parts.length === 1 && typeof parts[0] === "string" ? parts[0] : <>{parts}</>;
}

/* Maps lineHeight setting token → CSS value (generous for nikud) */
export function lineHeightCSS(lh: string, custom?: number): string {
  if (lh === "tight")    return "1.6";
  if (lh === "normal")   return "2.0";
  if (lh === "relaxed")  return "2.4";
  if (lh === "loose")    return "2.8";
  if (lh === "custom" && custom) return String(custom);
  return "2.0";
}

// Fonts allowed to draw vocalised prayer text (TextDisplaySettings offers
// only these for the Siddur and Tehillim); any other value moves to Noto.
const NIKUD_CAPABLE_FONTS = new Set([
  "Noto Serif Hebrew",
  "David Libre",
  "Frank Ruhl Libre",
  "Heebo",
]);

/** The single font family that will draw the prayer text (see withNikudTypography). */
export function nikudFontFamily(fontFamily: string, showNikud: boolean, showTaamim: boolean): string {
  const requestedFamily = primaryFontFamily(fontFamily);
  // Noto is bundled with the app and contains U+0591–U+05C7 in full. The
  // other verified fonts contain niqqud + mark/mkmk positioning, but not the
  // cantillation block. Use them for ordinary/vocalised prayer text and
  // switch the entire run to Noto whenever te'amim are visible. (The odd
  // mark they lack - meteg, rafe - is dropped by stripText.)
  // David and Frank Ruehl have a twin with every mark (same design, same height): with niqqud, always the twin.
  if (showNikud && TWIN_DESIGN.has(requestedFamily)) return fullMarksFamily(requestedFamily);
  if (showTaamim) return fullMarksFamily(requestedFamily);
  return !showNikud || NIKUD_CAPABLE_FONTS.has(requestedFamily) ? requestedFamily : FULL_MARKS_FONT;
}

export function withNikudTypography(fontFamily: string, lineHeight: string, showNikud: boolean, showTaamim: boolean): React.CSSProperties {
  // CRITICAL: do NOT mix multiple Hebrew fonts in the fallback chain.
  // Browsers do per-glyph fallback: if the chosen font lacks (or weakly
  // supports) a specific letter+nikud combination, the browser substitutes
  // ONLY that single character from the next Hebrew font — and different
  // Hebrew fonts have different em metrics (Noto Serif Hebrew is ~15-20%
  // taller than David Libre at the same font-size). The result: with nikud
  // ON, a few letters look noticeably larger than their neighbours.
  //
  // Fix: keep the user-selected font alone, then fall back ONLY to the
  // generic family. The generic doesn't carry Hebrew glyphs, so the browser
  // will render every Hebrew character from the chosen font — guaranteeing
  // uniform metrics.
  // Some display fonts expose Hebrew base letters but do not contain the
  // complete niqqud/te'amim GPOS anchors. Android then keeps their base glyph
  // and borrows marks (or an entire shaped cluster) from a fallback font.
  // That is exactly what makes isolated מ/ד/ה/ת clusters appear larger.
  // Keep user choice for fonts known to support marked Hebrew; otherwise use
  // the bundled Noto font for the whole run so Android never mixes glyphs.
  const resolvedFamily = nikudFontFamily(fontFamily, showNikud, showTaamim);
  const isSans = /sans|arial|tahoma|frank ruhl|noto sans/i.test(resolvedFamily);
  const generic = isSans ? 'sans-serif' : 'serif';
  // Keep the user's selected font for marked text as well. Quoting the family
  // name is important on Android for multi-word names (David Libre, Frank
  // Ruhl Libre, etc.); otherwise WebView may parse them as separate fallback
  // families and mix glyph metrics inside a single Hebrew word.
  const fullFamily = `'${resolvedFamily}', ${generic}`;
  return {
    fontFamily: fullFamily,
    lineHeight,
    // Do not force `ccmp` on Android WebView. With Hebrew combining marks it
    // can select alternate base glyphs for מ/ד/ה/ת, making only those letters
    // look larger when niqqud or cantillation is enabled. The font shaper's
    // defaults already position mark/mkmk correctly without changing the
    // visible base-letter metrics.
    fontFeatureSettings: 'normal',
    textRendering: 'auto',
    // Lock metrics so per-glyph fallback (if it ever happens) and any
    // contextual substitution can't change letter heights/baselines:
    fontSynthesis: 'none' as React.CSSProperties['fontSynthesis'],
    fontVariant: 'normal',
    fontKerning: 'none',
    // Prevent mobile auto text-size adjustments that scale individual lines.
    WebkitTextSizeAdjust: '100%',
    textSizeAdjust: '100%' as unknown as React.CSSProperties['textSizeAdjust'],
    // Keep all glyphs on the same baseline — defends against accidental
    // sub/superscript variants that some Hebrew fonts apply for marks.
    verticalAlign: 'baseline',
    fontVariantPosition: 'normal' as unknown as React.CSSProperties['fontVariantPosition'],
    // Avoid the parameter being flagged as unused while preserving the API.
  };
}

/** The prayer book's serif, for titles and notes around the text. */
export const SERIF = "'Noto Serif Hebrew', 'David Libre', serif";
