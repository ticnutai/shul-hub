import { useEffect, useState } from "react";

/** How long a status message stays up: long enough to be read, then out of the way. */
export const STATUS_MESSAGE_MS = 60_000;

/**
 * True for the first minute after `key` takes a value (and from mount), then
 * false until it changes again. For status messages - "אין חיבור", "מסנכרן",
 * "מציג מידע מלפני..." - that tell somebody something once and then should
 * not sit on the screen: on a wall in shul, a line saying the board is
 * offline stays there for hours and reads as "broken", though the board is
 * showing the right times all along.
 */
export function useBriefly(key: unknown, ms = STATUS_MESSAGE_MS): boolean {
  const [shownFor, setShownFor] = useState<unknown>(key);
  const [visible, setVisible] = useState(true);
  if (!Object.is(shownFor, key)) {
    setShownFor(key);
    setVisible(true);
  }
  useEffect(() => {
    const t = window.setTimeout(() => setVisible(false), ms);
    return () => window.clearTimeout(t);
  }, [key, ms]);
  return visible;
}
