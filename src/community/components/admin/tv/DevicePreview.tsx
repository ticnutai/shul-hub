import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Columns2, LayoutGrid, Maximize2, RotateCw } from "lucide-react";
import { DEVICE_ORDER, DEVICES, viewportOf, type DeviceId, type DeviceMode, type DeviceView } from "./devices";
import { Button } from "@/components/ui/button";

/**
 * Shows the board inside a picture of the device it would run on.
 *
 * Faithful, not a mock-up: the board is rendered at the device's real CSS
 * viewport (e.g. 390x844 for a phone, 960x540 for the TV box, which draws at
 * DPR 2) and the whole device is then scaled down to fit the panel. Every
 * size in tv.css comes from the frame, so what the admin sees is what that
 * screen shows - including the portrait layout on a phone or tablet.
 */

/* ------------------------------------------------------------ the frame -- */

interface Chrome {
  /** Bezel around the screen: top, side, bottom. */
  bezel: [number, number, number];
  radius: number;
  /** Extra height below the body (stand, keyboard deck). */
  below: number;
  /** Extra width the deck/stand sticks out on each side. */
  overhang: number;
}

function chromeOf(device: DeviceId, turned: boolean): Chrome {
  switch (device) {
    case "tv":
      return { bezel: [10, 10, 10], radius: 8, below: 34, overhang: 0 };
    case "desktop":
      return { bezel: [24, 24, 24], radius: 16, below: 150, overhang: 0 };
    case "laptop":
      return { bezel: [26, 20, 20], radius: 22, below: 30, overhang: 90 };
    case "tablet":
      return { bezel: [28, 28, 28], radius: 46, below: 0, overhang: 0 };
    case "mobile":
      return turned ? { bezel: [12, 14, 12], radius: 56, below: 0, overhang: 0 } : { bezel: [14, 12, 14], radius: 56, below: 0, overhang: 0 };
  }
}

/**
 * One device with the board inside, scaled to fit `maxHeight` and the
 * available width (or shown at 100% when `actualSize`).
 */
export function DeviceFrame({
  view,
  maxHeight,
  actualSize = false,
  children,
}: {
  view: DeviceView;
  maxHeight: number;
  actualSize?: boolean;
  children: ReactNode;
}) {
  const vp = viewportOf(view);
  const chrome = chromeOf(view.device, vp.turned);
  const [bt, bs, bb] = chrome.bezel;
  const bodyW = vp.width + bs * 2;
  const bodyH = vp.screenHeight + bt + bb;
  const totalW = bodyW + chrome.overhang * 2;
  const totalH = bodyH + chrome.below;

  const outerRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(0);
  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const measure = () => setAvailable(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = available > 0 ? Math.min(available / totalW, maxHeight / totalH) : 0;
  const scale = actualSize ? 1 : Math.min(1, fit);

  return (
    <div ref={outerRef} className={actualSize ? "w-full overflow-auto" : "w-full"} style={actualSize ? { maxHeight: "80vh" } : undefined}>
      {scale > 0 && (
        <div className="mx-auto" style={{ width: totalW * scale, height: totalH * scale }} dir="ltr">
          <div
            style={
              {
                width: totalW,
                height: totalH,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                position: "relative",
                // Lets the editor keep its outlines a constant on-screen width.
                "--ps": scale,
              } as CSSProperties
            }
          >
            {/* body */}
            <div
              style={{
                position: "absolute",
                left: chrome.overhang,
                top: 0,
                width: bodyW,
                height: bodyH,
                borderRadius: view.device === "laptop" ? `${chrome.radius}px ${chrome.radius}px 6px 6px` : chrome.radius,
                background: view.device === "desktop" ? "linear-gradient(180deg,#2b2f36,#1b1e23)" : "#0c0d10",
                boxShadow: "0 18px 40px rgba(0,0,0,.28), inset 0 0 0 2px rgba(255,255,255,.06)",
              }}
            >
              {/* screen */}
              <div
                style={{
                  position: "absolute",
                  left: bs,
                  top: bt,
                  width: vp.width,
                  height: vp.screenHeight,
                  overflow: "hidden",
                  borderRadius: view.device === "mobile" ? 44 : view.device === "tablet" ? 20 : 2,
                  background: "#000",
                }}
              >
                {vp.bar > 0 && <BrowserBar device={view.device} height={vp.bar} turned={vp.turned} />}
                {/* The phone keeps its address bar at the bottom, below a 47 px status bar. */}
                <div style={{ position: "absolute", left: 0, right: 0, top: view.device === "mobile" && !vp.turned && vp.bar ? 47 : vp.bar, height: vp.height }}>
                  {children}
                </div>
                {view.device === "mobile" && view.fullscreen && <Island turned={vp.turned} />}
              </div>
            </div>
            <Below device={view.device} bodyW={bodyW} bodyH={bodyH} totalW={totalW} chrome={chrome} />
          </div>
        </div>
      )}
    </div>
  );
}

function Island({ turned }: { turned: boolean }) {
  return (
    <div
      aria-hidden
      style={
        turned
          ? { position: "absolute", left: 10, top: "50%", width: 34, height: 120, marginTop: -60, borderRadius: 20, background: "#000", zIndex: 5 }
          : { position: "absolute", top: 11, left: "50%", width: 120, height: 34, marginLeft: -60, borderRadius: 20, background: "#000", zIndex: 5 }
      }
    />
  );
}

const URL_TEXT = "shul-hub.lovable.app/admin/tv-board";

/** The browser's own UI when the board is not full screen. */
function BrowserBar({ device, height, turned }: { device: DeviceId; height: number; turned: boolean }) {
  if (device === "mobile" && !turned) {
    // Status bar on top, Safari/Chrome address bar at the bottom.
    return (
      <>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 47, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", font: "600 15px system-ui", color: "#111" }}>
          <span>9:41</span>
          <span>▮▮▮ ◔</span>
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: height - 47, background: "#f3f4f6", borderTop: "1px solid #ddd", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 12 }}>
          <Pill width="86%" height={42} font={14} />
        </div>
      </>
    );
  }
  const desktopLike = device === "desktop" || device === "laptop";
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height, background: desktopLike ? "#dee1e6" : "#f3f4f6", borderBottom: "1px solid #c8ccd2" }}>
      {desktopLike && (
        <div style={{ height: height * 0.42, display: "flex", alignItems: "flex-end", gap: 10, padding: "0 16px" }}>
          <div style={{ display: "flex", gap: 8, alignSelf: "center" }}>
            {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
              <span key={c} style={{ width: 13, height: 13, borderRadius: 99, background: c, display: "block" }} />
            ))}
          </div>
          <div style={{ height: "80%", width: 240, background: "#fff", borderRadius: "10px 10px 0 0", font: "500 13px system-ui", color: "#333", display: "flex", alignItems: "center", padding: "0 14px", direction: "rtl" }}>
            לוח תצוגה — בית הכנסת
          </div>
        </div>
      )}
      <div style={{ height: desktopLike ? height * 0.58 : height, background: "#fff", display: "flex", alignItems: "center", padding: "0 16px", gap: 14 }}>
        {desktopLike && <span style={{ font: "20px system-ui", color: "#666", whiteSpace: "nowrap" }}>←&nbsp;→&nbsp;⟳</span>}
        <Pill width="100%" height={Math.min(40, (desktopLike ? height * 0.58 : height) - 18)} font={desktopLike ? 15 : 14} />
      </div>
    </div>
  );
}

function Pill({ width, height, font }: { width: string; height: number; font: number }) {
  return (
    <div style={{ width, height, borderRadius: 999, background: "#eceef1", display: "flex", alignItems: "center", justifyContent: "center", font: `${font}px system-ui`, color: "#444" }}>
      🔒 {URL_TEXT}
    </div>
  );
}

/** Stand, keyboard deck, feet. */
function Below({ device, bodyW, bodyH, totalW, chrome }: { device: DeviceId; bodyW: number; bodyH: number; totalW: number; chrome: Chrome }) {
  const center = chrome.overhang + bodyW / 2;
  if (device === "tv")
    return (
      <>
        <div style={{ position: "absolute", top: bodyH, left: center - 7, width: 14, height: 22, background: "#2a2c31" }} />
        <div style={{ position: "absolute", top: bodyH + 22, left: center - 110, width: 220, height: 10, borderRadius: 6, background: "#1c1d21" }} />
      </>
    );
  if (device === "desktop")
    return (
      <>
        <div style={{ position: "absolute", top: bodyH, left: center - 70, width: 140, height: 124, background: "linear-gradient(90deg,#9aa0a8,#d4d7dc 45%,#9aa0a8)", clipPath: "polygon(12% 0,88% 0,100% 100%,0 100%)" }} />
        <div style={{ position: "absolute", top: bodyH + 122, left: center - 280, width: 560, height: 26, borderRadius: "10px 10px 14px 14px", background: "linear-gradient(180deg,#d9dce0,#a9aeb5)" }} />
      </>
    );
  if (device === "laptop")
    return (
      <div style={{ position: "absolute", top: bodyH, left: 0, width: totalW, height: chrome.below, borderRadius: "0 0 26px 26px", background: "linear-gradient(180deg,#d7dadf,#9fa4ab)" }}>
        <div style={{ margin: "0 auto", width: 220, height: 10, borderRadius: "0 0 12px 12px", background: "#b9bdc3" }} />
      </div>
    );
  return null;
}

/* ----------------------------------------------------------- toolbar -- */

export function DeviceToolbar({
  mode,
  view,
  actualSize,
  compare = false,
  onMode,
  onView,
  onActualSize,
  onCompare,
}: {
  mode: DeviceMode;
  view: DeviceView;
  actualSize: boolean;
  /** Only in "all": show every screen's own board next to the others. */
  compare?: boolean;
  onMode: (m: DeviceMode) => void;
  onView: (v: DeviceView) => void;
  onActualSize: (v: boolean) => void;
  onCompare?: (v: boolean) => void;
}) {
  const spec = mode === "all" ? null : DEVICES[mode];
  const vp = mode === "all" ? null : viewportOf(view);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1" role="radiogroup" aria-label="מכשיר לתצוגה">
        {[...DEVICE_ORDER, "all" as const].map((id) => {
          const Icon = id === "all" ? LayoutGrid : DEVICES[id].icon;
          const active = mode === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onMode(id)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                active ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {id === "all" ? "כל המסכים" : DEVICES[id].label}
            </button>
          );
        })}
      </div>
      {mode === "all" && onCompare && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            {compare
              ? "כל תצוגה עם הלוח שלה, זו לצד זו - כך רואים איפה הן נבדלות."
              : "השינויים חלים על כל התצוגות. מוצג הלוח כפי שהטלוויזיה מראה אותו."}
          </span>
          <Button
            type="button"
            variant={compare ? "default" : "outline"}
            size="sm"
            className="ms-auto h-7 px-2 text-xs"
            aria-pressed={compare}
            onClick={() => onCompare(!compare)}
          >
            <Columns2 className="size-3.5" /> השוואה בין התצוגות
          </Button>
        </div>
      )}
      {spec && vp && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums" dir="ltr">
            {vp.width}×{vp.height}
          </span>
          <span>· {spec.note}</span>
          <span className="ms-auto flex flex-wrap gap-1">
            {spec.rotatable && (
              <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => onView({ ...view, landscape: !view.landscape })}>
                <RotateCw className="size-3.5" /> {view.landscape ? "לאורך" : "לרוחב"}
              </Button>
            )}
            {spec.bar && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                aria-pressed={view.fullscreen}
                onClick={() => onView({ ...view, fullscreen: !view.fullscreen })}
              >
                <Maximize2 className="size-3.5" /> {view.fullscreen ? "מסך מלא" : "בתוך דפדפן"}
              </Button>
            )}
            <Button type="button" variant={actualSize ? "default" : "outline"} size="sm" className="h-7 px-2 text-xs" onClick={() => onActualSize(!actualSize)}>
              {actualSize ? "גודל אמיתי 100%" : "מותאם לחלון"}
            </Button>
          </span>
        </div>
      )}
    </div>
  );
}
