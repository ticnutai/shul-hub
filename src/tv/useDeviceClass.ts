import { useEffect, useState } from "react";

import { deviceClassFor, type DeviceClass } from "./devices";

/**
 * Which kind of screen the board is actually on, kept current.
 *
 * A television says so outright; everything else is decided by how wide the
 * window is, and that can change - a laptop window dragged narrow, a phone
 * turned on its side. The board follows, because the whole point of a
 * per-screen setting is that it matches the screen in front of you.
 */
export function useDeviceClass(isTv: boolean): DeviceClass {
  const [width, setWidth] = useState(() =>
    typeof window === "undefined" ? 1920 : window.innerWidth,
  );

  useEffect(() => {
    if (isTv) return; // a TV window does not change size
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isTv]);

  return deviceClassFor(width, isTv);
}
