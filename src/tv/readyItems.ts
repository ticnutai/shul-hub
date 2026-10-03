import type { TvConfig } from "./config";

/**
 * Ready-made items a shul can take off its own lists.
 *
 * Whatever can be added can be deleted - the shul's own items are deleted
 * outright; a ready one (a design, a theme, a background, a frame, a ready
 * box) is hidden from this board's lists instead, so that a slip of the hand
 * loses nothing, and every list offers to bring back what it hid.
 */
export type ReadyKind = "design" | "theme" | "bg" | "frame" | "box";

/** The key of a ready item in TvConfig.hiddenReady. A frame's id is already "frame:<id>". */
export const readyKey = (kind: ReadyKind, id: string) => (kind === "frame" && id.startsWith("frame:") ? id : `${kind}:${id}`);

export const isHiddenReady = (c: Pick<TvConfig, "hiddenReady">, kind: ReadyKind, id: string) =>
  c.hiddenReady.includes(readyKey(kind, id));

export function hideReady(c: TvConfig, kind: ReadyKind, id: string): TvConfig {
  const key = readyKey(kind, id);
  return c.hiddenReady.includes(key) ? c : { ...c, hiddenReady: [...c.hiddenReady, key] };
}

export function showReady(c: TvConfig, kind: ReadyKind, id: string): TvConfig {
  const key = readyKey(kind, id);
  return { ...c, hiddenReady: c.hiddenReady.filter((k) => k !== key) };
}
