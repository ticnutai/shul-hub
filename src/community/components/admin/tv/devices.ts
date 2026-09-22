import { useEffect, useState } from "react";
import { Laptop, Monitor, Smartphone, Tablet, Tv, type LucideIcon } from "lucide-react";

/** Devices the board can be previewed on (see DevicePreview.tsx). */

export type DeviceId = "tv" | "desktop" | "laptop" | "tablet" | "mobile";
export type DeviceMode = DeviceId | "all";

interface DeviceSpec {
  label: string;
  icon: LucideIcon;
  /** CSS viewport in the device's natural orientation, full screen. */
  width: number;
  height: number;
  /** Height the browser's own bars take when not in full screen (portrait / landscape). */
  bar?: { portrait: number; landscape: number };
  rotatable: boolean;
  /** Short explanation shown under the preview. */
  note: string;
}

export const DEVICES: Record<DeviceId, DeviceSpec> = {
  tv: {
    label: "Android TV",
    icon: Tv,
    width: 960,
    height: 540,
    rotatable: false,
    note: "הקופסה בבית הכנסת: 1920×1080, מצויר ב-960×540 בצפיפות כפולה",
  },
  desktop: {
    label: "מחשב",
    icon: Monitor,
    width: 1920,
    height: 1080,
    bar: { portrait: 133, landscape: 133 },
    rotatable: false,
    note: "מסך מחשב Full HD",
  },
  laptop: {
    label: "לפטופ",
    icon: Laptop,
    width: 1440,
    height: 900,
    bar: { portrait: 111, landscape: 111 },
    rotatable: false,
    note: "לפטופ 16:10 (למשל 14–15 אינץ׳)",
  },
  tablet: {
    label: "טאבלט",
    icon: Tablet,
    width: 820,
    height: 1180,
    bar: { portrait: 74, landscape: 74 },
    rotatable: true,
    note: "טאבלט 11 אינץ׳",
  },
  mobile: {
    label: "מובייל",
    icon: Smartphone,
    width: 390,
    height: 844,
    bar: { portrait: 150, landscape: 60 },
    rotatable: true,
    note: "טלפון 6.1 אינץ׳",
  },
};

export const DEVICE_ORDER: DeviceId[] = ["tv", "desktop", "laptop", "tablet", "mobile"];

export interface DeviceView {
  device: DeviceId;
  landscape: boolean;
  /** Full screen (kiosk / F11) rather than inside a browser window. */
  fullscreen: boolean;
}

/** The board's viewport for a view, in CSS pixels. */
export function viewportOf(view: DeviceView) {
  const spec = DEVICES[view.device];
  const turned = spec.rotatable && view.landscape;
  const width = turned ? spec.height : spec.width;
  const height = turned ? spec.width : spec.height;
  const bar = !view.fullscreen && spec.bar ? (turned ? spec.bar.landscape : spec.bar.portrait) : 0;
  return { width, height: height - bar, screenHeight: height, bar, turned };
}

/* ------------------------------------------------------- persisted view -- */

const STORAGE_KEY = "shul-tv-preview-device-v1";

interface Stored {
  mode: DeviceMode;
  views: Record<DeviceId, DeviceView>;
}

function defaults(): Stored {
  return {
    mode: "all",
    views: {
      tv: { device: "tv", landscape: true, fullscreen: true },
      desktop: { device: "desktop", landscape: true, fullscreen: true },
      laptop: { device: "laptop", landscape: true, fullscreen: true },
      tablet: { device: "tablet", landscape: false, fullscreen: true },
      mobile: { device: "mobile", landscape: false, fullscreen: false },
    },
  };
}

/**
 * The device being looked at - and, because it is the only switcher, the
 * one being edited.
 *
 * How each device is shown (turned, full screen) is remembered between
 * visits, because that is a preference. WHICH device is not: every visit
 * starts on "all screens".
 *
 * That is deliberate and it is the whole safety of having one switcher.
 * If the choice persisted, an admin who last looked at the phone would
 * come back a week later, change the title, and change it on the phone
 * alone without ever being told - which is the complaint that sinks
 * editors built this way. Starting on "all" means the careless edit is
 * the harmless one.
 */
export function useDeviceChoice() {
  const [stored, setStored] = useState<Stored>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Stored | null;
      if (raw?.views) return { mode: "all", views: { ...defaults().views, ...raw.views } };
    } catch {
      /* private mode or bad JSON: defaults */
    }
    return defaults();
  });
  useEffect(() => {
    try {
      // The mode is left out on purpose; see above.
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ views: stored.views }));
    } catch {
      /* not persisted; fine */
    }
  }, [stored.views]);
  const mode = stored.mode;
  const view = mode === "all" ? stored.views.tv : stored.views[mode];
  return {
    mode,
    view,
    views: stored.views,
    setMode: (m: DeviceMode) => setStored((s) => ({ ...s, mode: m })),
    setView: (v: DeviceView) => setStored((s) => ({ ...s, views: { ...s.views, [v.device]: v } })),
  };
}
