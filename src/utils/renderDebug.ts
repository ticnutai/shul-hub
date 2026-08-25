/**
 * Render & layout-shift debugging helpers.
 *
 * Activated by setting:
 *   localStorage.setItem("debug_renders", "1")
 * or appending `?debugRenders=1` to the URL.
 *
 * What it does:
 *   1. `installLayoutShiftTracker()` — listens to PerformanceObserver("layout-shift")
 *      and prints the *actual DOM nodes* that caused each shift, with their
 *      bounding rects and a CSS-path so you can spot which component jumped.
 *   2. `useRenderTracker(name, props?)` — React hook that logs every render of
 *      a component, the # of renders so far, and which prop values changed
 *      since the previous render.
 */
import { useEffect, useRef } from "react";

const FLAG_KEY = "debug_renders";

export function isRenderDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("debugRenders") === "1") {
      localStorage.setItem(FLAG_KEY, "1");
      return true;
    }
    return localStorage.getItem(FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

/* ─── Layout-shift attribution ──────────────────────────── */

interface LayoutShiftAttribution {
  node?: Node;
  previousRect: DOMRectReadOnly;
  currentRect: DOMRectReadOnly;
}
interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
  sources?: LayoutShiftAttribution[];
}

function describe(node: Node | undefined): string {
  if (!node || !(node instanceof Element)) return "(unknown)";
  const id = node.id ? `#${node.id}` : "";
  const cls = node.className && typeof node.className === "string"
    ? "." + node.className.trim().split(/\s+/).slice(0, 2).join(".")
    : "";
  const text = (node.textContent || "").trim().slice(0, 30);
  return `${node.tagName.toLowerCase()}${id}${cls}${text ? ` « ${text} »` : ""}`;
}

let lsInstalled = false;
export function installLayoutShiftTracker() {
  if (lsInstalled || typeof PerformanceObserver === "undefined") return;
  if (!isRenderDebugEnabled()) return;
  lsInstalled = true;

  let total = 0;
  try {
    const obs = new PerformanceObserver((list) => {
      for (const e of list.getEntries() as LayoutShiftEntry[]) {
        if (e.hadRecentInput) continue;
        total += e.value;
        const sources = (e.sources || []).map((s) => ({
          node: describe(s.node),
          from: `${Math.round(s.previousRect.x)},${Math.round(s.previousRect.y)} ${Math.round(s.previousRect.width)}x${Math.round(s.previousRect.height)}`,
          to: `${Math.round(s.currentRect.x)},${Math.round(s.currentRect.y)} ${Math.round(s.currentRect.width)}x${Math.round(s.currentRect.height)}`,
          el: s.node,
        }));
        // eslint-disable-next-line no-console
        console.groupCollapsed(
          `%c[CLS] +${e.value.toFixed(4)} (total ${total.toFixed(4)})`,
          "color:#e36; font-weight:bold",
        );
        console.table(sources.map(({ el: _ignored, ...rest }) => rest));
        sources.forEach((s) => s.el && console.log("→", s.el));
        console.groupEnd();
      }
    });
    obs.observe({ type: "layout-shift", buffered: true });
  } catch {
    // ignore unsupported
  }
}

/* ─── Render tracker hook ───────────────────────────────── */

const renderCounters = new Map<string, number>();

export function useRenderTracker(name: string, props?: Record<string, unknown>) {
  const prev = useRef<Record<string, unknown> | undefined>(undefined);
  useEffect(() => {
    if (!isRenderDebugEnabled()) return;
    const n = (renderCounters.get(name) || 0) + 1;
    renderCounters.set(name, n);
    const changed: Record<string, { prev: unknown; next: unknown }> = {};
    if (props && prev.current) {
      for (const k of Object.keys(props)) {
        if (!Object.is(prev.current[k], props[k])) {
          changed[k] = { prev: prev.current[k], next: props[k] };
        }
      }
    }
    const changedKeys = Object.keys(changed);
    // eslint-disable-next-line no-console
    console.debug(
      `%c[render] ${name} #${n}${changedKeys.length ? ` changed: ${changedKeys.join(", ")}` : " (no prop changes)"}`,
      "color:#369",
      changedKeys.length ? changed : "",
    );
    prev.current = props ? { ...props } : undefined;
  });
}

/* ─── Convenience: dump all counters ────────────────────── */

export function dumpRenderCounts() {
  // eslint-disable-next-line no-console
  console.table(
    Array.from(renderCounters.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count })),
  );
}

declare global {
  interface Window {
    __dumpRenders?: () => void;
  }
}

if (typeof window !== "undefined") {
  window.__dumpRenders = dumpRenderCounts;
}
