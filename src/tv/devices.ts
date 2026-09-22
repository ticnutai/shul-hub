/**
 * One board, three kinds of screen.
 *
 * Everything the live editor does - the wording, what is on the board, the
 * colours, the layout - used to be one setting shared by every screen. That
 * is right for most of it and wrong for some: the wall in the shul is a
 * 1920x1080 television seen from ten metres away, and the same board on a
 * phone in someone's pocket is a different problem. A title that reads well
 * across a hall is too long for a phone; a panel that belongs on the wall
 * may be noise on a laptop.
 *
 * So a board is a shared base plus, for each kind of screen, an overlay of
 * the things that screen does differently. An empty overlay - which is what
 * every board has until somebody changes something - means "the same as
 * everywhere else", so nothing has to be set three times, and an edit that
 * should apply everywhere still is one edit.
 *
 * Three classes, not five. The preview offers a tablet and a laptop as
 * well, because seeing the board at those sizes is useful, but asking a
 * gabbai to keep five sets of wording current is not: a laptop is a
 * computer and a tablet is held like a phone.
 */

export type DeviceClass = "tv" | "desktop" | "mobile";

export const DEVICE_CLASSES: DeviceClass[] = ["tv", "desktop", "mobile"];

export const DEVICE_CLASS_LABELS: Record<DeviceClass, string> = {
  tv: "אנדרואיד TV",
  desktop: "מחשב",
  mobile: "מובייל",
};

/** Below this the board is laid out for a phone. A tablet counts as one. */
const MOBILE_MAX_WIDTH = 900;

/**
 * Which of the three a viewport is.
 *
 * The television is not guessed at from its size - a TV box reports 960
 * CSS pixels, which is laptop territory - so the app says so outright and
 * everything else is decided by width.
 */
export function deviceClassFor(width: number, isTv: boolean): DeviceClass {
  if (isTv) return "tv";
  return width <= MOBILE_MAX_WIDTH ? "mobile" : "desktop";
}

/** The five devices the preview offers, folded onto the three that differ. */
export function classOfPreviewDevice(id: string): DeviceClass {
  if (id === "tv") return "tv";
  if (id === "mobile" || id === "tablet") return "mobile";
  return "desktop";
}
