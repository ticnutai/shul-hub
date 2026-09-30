import type { TvConfig } from "@/tv/config";

/**
 * What choosing a drawn frame style or a background of its own does to a
 * painted board: it leaves it, since the painting is its own wall and its own
 * frames.
 *
 * It goes to "לוח מלא": a painted board shows everything at once, and so
 * does that one. The rotating board instead would take half of what was on
 * the wall off it at the same moment the look changed.
 */
export function leavingPainted(c: TvConfig): Partial<TvConfig> {
  return c.screenLayout === "illustrated" ? { screenLayout: "dashboard" } : {};
}
