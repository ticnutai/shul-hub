/**
 * How the board editor is laid out on the page - side by side or one above
 * the other, the share and heights dragged, focus and a bare board - and
 * remembered in this browser between visits.
 */
export const LAYOUT_KEY = "shul-hub.tv-editor.layout";
export const SIDE_KEY = "shul-hub.tv-editor.side-share";
export const TOP_KEY = "shul-hub.tv-editor.top-height";
/** The board's share of the width, side by side - what the page gave it before. */
export const SIDE_SHARE_DEFAULT = 0.52;
export const TOP_HEIGHT_DEFAULT = 440;
export const SIDE_H_KEY = "shul-hub.tv-editor.side-height";
export const FOCUS_KEY = "shul-hub.tv-editor.focus";
export const BARE_KEY = "shul-hub.tv-editor.bare";
/** Side by side, the board stopped at 520 px (with the studio's 72 around it): the same, until it is dragged. */
export const SIDE_HEIGHT_DEFAULT = 592;
/** The studio's toolbar row and padding around the frame (TvDeviceStudio's fitHeight). */
export const STUDIO_CHROME = 72;

/** Side by side: never under 260 px, never past the window. */
export function clampSideHeight(v: number): number {
  const max = typeof window === "undefined" ? 1000 : Math.max(300, window.innerHeight - 24);
  return Math.min(max, Math.max(260, v));
}

/** Neither side so narrow it is useless: a board under 30%, controls under 25%. */
export function clampShare(v: number): number {
  return Math.min(0.75, Math.max(0.3, v));
}

/** A board at least readable, and room left for at least a few controls. */
export function clampHeight(v: number): number {
  const max = typeof window === "undefined" ? 900 : Math.max(260, window.innerHeight - 260);
  return Math.min(max, Math.max(220, v));
}

export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: it simply is not remembered */
  }
}
