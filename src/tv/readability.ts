/**
 * Can the board be read? Text against what is actually behind it, measured on
 * the board as drawn (computed colours), so a background, a box colour, a
 * see-through box and a text colour chosen in four different places are
 * judged together - which is where an unreadable board comes from.
 *
 * Measured the way WCAG measures contrast. A board is read from across a
 * hall, so the floor is 3:1 even for its large type; below it the editor
 * says where. A box over a picture is not judged: what is behind its text
 * changes from point to point.
 */

export type Rgba = [number, number, number, number];

/** A computed colour: rgb()/rgba(), or color(srgb …) as color-mix() computes to. */
export function parseColour(value: string): Rgba | null {
  const v = value.trim();
  let m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(v);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return [Number(m[1]), Number(m[2]), Number(m[3]), a];
  }
  m = /^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/i.exec(v);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return [parseFloat(m[1]) * 255, parseFloat(m[2]) * 255, parseFloat(m[3]) * 255, a];
  }
  if (/^#[0-9a-f]{6}$/i.test(v)) return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16), 1];
  if (v === "transparent") return [0, 0, 0, 0];
  return null;
}

/** `top` laid over `under`. */
export function over(top: Rgba, under: Rgba): Rgba {
  const a = top[3];
  return [top[0] * a + under[0] * (1 - a), top[1] * a + under[1] * (1 - a), top[2] * a + under[2] * (1 - a), 1];
}

function luminance([r, g, b]: Rgba): number {
  const ch = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const MIN_CONTRAST = 3;

export interface ReadabilityIssue {
  /** The box (frameLooks id), when the text is in one. */
  frame: string | null;
  /** What it is, as the gabbai would say it. */
  where: string;
  ratio: number;
}

/**
 * The places on a drawn board where text is too faint for what is behind it.
 * `names` turns a box's data-frame into its name.
 */
export function readabilityIssues(root: HTMLElement, names: (frame: string) => string): ReadabilityIssue[] {
  const style = (el: Element) => getComputedStyle(el);
  const base = parseColour(style(root).getPropertyValue("--tv-bg-a")) ?? [11, 22, 40, 1];
  const boardHasPicture = root.classList.contains("has-bg-image");

  /** What is behind an element's text: its own background over its parents', down to the board. null - a picture. */
  const behind = (el: Element): Rgba | null => {
    const layers: Rgba[] = [];
    let opaque = false;
    for (let node: Element | null = el; node && node !== root.parentElement; node = node.parentElement) {
      const s = style(node);
      // A box's own gradient or picture: what is behind the text changes from point to point.
      if (s.backgroundImage && s.backgroundImage !== "none") return null;
      const c = parseColour(s.backgroundColor);
      if (c && c[3] > 0) layers.push(c);
      if (c && c[3] >= 1) {
        opaque = true;
        break;
      }
    }
    // Down to the board itself: its picture is not judged; its colours are, by their base.
    if (!opaque && boardHasPicture) return null;
    return layers.reverse().reduce<Rgba>((under, top) => over(top, under), base);
  };

  const issues: ReadabilityIssue[] = [];
  const seen = new Set<string>();
  const check = (text: Element | null, frame: string | null, where: string) => {
    if (!text || !(text as HTMLElement).offsetParent) return;
    const bg = behind(text);
    const fg = parseColour(style(text).color);
    if (!bg || !fg) return;
    const ratio = contrast(over(fg, bg), bg);
    if (ratio < MIN_CONTRAST && !seen.has(where)) {
      seen.add(where);
      issues.push({ frame, where, ratio: Math.round(ratio * 10) / 10 });
    }
  };

  for (const box of root.querySelectorAll<HTMLElement>("[data-frame]")) {
    if (box.closest(".tv-board-frame")) continue;
    const frame = box.dataset.frame ?? null;
    const name = frame ? names(frame) : "תיבה";
    check(box.querySelector(".tv-panel-title"), frame, `${name}: הכותרת`);
    check(box.querySelector("dt, .tv-dash-name, .tv-minyan-name, .tv-card-title, .tv-shiur-title"), frame, `${name}: הטקסט`);
    check(box.querySelector("dd, .tv-dash-time, .tv-minyan-time, .tv-shiur-time"), frame, `${name}: השעות`);
  }
  check(root.querySelector(".tv-title, .tv-head-title"), null, "שם בית הכנסת");
  return issues;
}
