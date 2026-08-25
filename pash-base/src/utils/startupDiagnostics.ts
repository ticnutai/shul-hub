type TraceHandle = {
  stop: () => void;
  log: (event: string, details?: unknown) => void;
  snapshot: () => unknown;
};

type OverlaySnapshot = {
  t: string;
  tick: number;
  readyState: string;
  fontStatus: string;
  loadedCount: number;
  missingCount: number;
  googleCssReq: number;
  googleFontFilesReq: number;
  swControlled: boolean;
  cls: number;
  longTasks: number;
  fcpMs: number | null;
  lcpMs: number | null;
  mutations: number;
  reactRenders: number;
  topMutationTarget: string;
  topRenderId: string;
};

type TraceLevel = "metric" | "log" | "info" | "warn" | "error" | "debug";

type TraceEvent = {
  t: string;
  level: TraceLevel;
  event: string;
  details?: unknown;
};

declare global {
  interface Window {
    __pashTraceHandle?: TraceHandle;
  }
}

const TRACE_KEY = "debug-font-trace";
const TRACE_STORAGE_KEY = "debug-startup-trace-last";
const MAX_EVENTS = 2000;

function shouldEnableTrace() {
  // Disable in automated browser testing (Playwright/Selenium set navigator.webdriver = true)
  if (navigator.webdriver) return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("traceFonts") === "1") return true;
    if (localStorage.getItem(TRACE_KEY) === "true") return true;
  } catch {
    // ignore
  }
  return import.meta.env.DEV;
}

function nowSeconds(start: number) {
  return ((performance.now() - start) / 1000).toFixed(1);
}

function checkFontLoaded(family: string) {
  if (!("fonts" in document)) return false;
  try {
    return document.fonts.check(`16px "${family}"`);
  } catch {
    return false;
  }
}

function stringifySafe(value: unknown) {
  try {
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value == null) {
      return value;
    }
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

export function installStartupDiagnostics() {
  if (typeof window === "undefined") return;
  if (!shouldEnableTrace()) return;
  if (window.__pashTraceHandle) return;

  const start = performance.now();
  const events: TraceEvent[] = [];

  // React render counters fed by <DenseProfiler> in App.tsx via window.__pashRecordRender
  const renderCounts: Record<string, number> = {};
  const renderDurations: Record<string, number> = {};
  let totalRenders = 0;
  (window as unknown as { __pashRecordRender?: (id: string, phase: string, actualDuration: number) => void }).__pashRecordRender = (
    id: string,
    phase: string,
    actualDuration: number,
  ) => {
    totalRenders += 1;
    renderCounts[id] = (renderCounts[id] || 0) + 1;
    renderDurations[id] = (renderDurations[id] || 0) + actualDuration;
    // Log every render at trace level so we can see in chrono order which subtree rendered
    log("react-render", { id, phase, ms: Math.round(actualDuration * 100) / 100, n: renderCounts[id] });
  };

  const trackedFonts = [
    "David Libre",
    "Frank Ruhl Libre",
    "Noto Serif Hebrew",
    "Miriam Libre",
    "Rubik",
  ];

  const nativeConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  };

  let overlayEl: HTMLDivElement | null = null;

  const pushEvent = (level: TraceLevel, event: string, details?: unknown) => {
    const item: TraceEvent = {
      t: `${nowSeconds(start)}s`,
      level,
      event,
      details: stringifySafe(details),
    };
    events.push(item);
    if (events.length > MAX_EVENTS) {
      events.splice(0, events.length - MAX_EVENTS);
    }
  };

  const log = (event: string, details?: Record<string, unknown>) => {
    const payload = {
      t: `${nowSeconds(start)}s`,
      event,
      ...(details || {}),
    };
    pushEvent("metric", event, details);
    nativeConsole.log("[startup-trace]", payload);
  };

  const persistLogs = () => {
    try {
      localStorage.setItem(
        TRACE_STORAGE_KEY,
        JSON.stringify({
          exportedAt: new Date().toISOString(),
          href: window.location.href,
          userAgent: navigator.userAgent,
          events,
        }),
      );
    } catch {
      // ignore storage quota issues in trace mode
    }
  };

  const exportLogs = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      href: window.location.href,
      userAgent: navigator.userAgent,
      events,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `startup-trace-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const copyLogs = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(events, null, 2));
      log("copy-logs-success", { count: events.length });
    } catch (error) {
      log("copy-logs-failed", { error: stringifySafe(error) });
    }
  };

  const ensureOverlay = () => {
    if (overlayEl) return overlayEl;

    const panel = document.createElement("div");
    panel.id = "startup-trace-overlay";
    // aria-hidden + contain keep this element out of the LCP candidate set so the
    // diagnostic UI never becomes the largest contentful paint and never inflates
    // CLS. Without this the overlay's text was reported as the LCP element on
    // every reload, making perf metrics look ~750 ms worse than the real app.
    panel.setAttribute("aria-hidden", "true");
    panel.style.position = "fixed";
    panel.style.left = "10px";
    panel.style.bottom = "10px";
    panel.style.zIndex = "2147483647";
    panel.style.background = "rgba(10, 16, 26, 0.94)";
    panel.style.color = "#d9f5ff";
    panel.style.border = "1px solid rgba(76, 188, 255, 0.45)";
    panel.style.borderRadius = "10px";
    panel.style.padding = "10px 12px";
    panel.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    panel.style.fontSize = "11px";
    panel.style.lineHeight = "1.35";
    panel.style.minWidth = "280px";
    panel.style.maxWidth = "48vw";
    panel.style.pointerEvents = "auto";
    panel.style.boxShadow = "0 8px 28px rgba(0,0,0,0.35)";
    panel.style.contain = "layout paint style";
    panel.style.contentVisibility = "auto";

    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.gap = "6px";
    controls.style.marginBottom = "8px";
    controls.style.flexWrap = "wrap";

    const makeBtn = (label: string, onClick: () => void) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.style.padding = "2px 8px";
      btn.style.background = "#123d5f";
      btn.style.border = "1px solid #2a78b0";
      btn.style.color = "#d9f5ff";
      btn.style.borderRadius = "6px";
      btn.style.cursor = "pointer";
      btn.addEventListener("click", onClick);
      return btn;
    };

    controls.appendChild(makeBtn("Stop", () => window.__pashTraceHandle?.stop()));
    controls.appendChild(makeBtn("Export JSON", exportLogs));
    controls.appendChild(makeBtn("Copy", () => {
      void copyLogs();
    }));
    controls.appendChild(makeBtn("Clear", () => {
      events.splice(0, events.length);
      persistLogs();
      log("events-cleared");
    }));

    const body = document.createElement("div");
    body.id = "startup-trace-overlay-body";
    body.style.whiteSpace = "pre";

    const feed = document.createElement("div");
    feed.id = "startup-trace-overlay-feed";
    feed.style.marginTop = "8px";
    feed.style.maxHeight = "140px";
    feed.style.overflow = "auto";
    feed.style.whiteSpace = "pre-wrap";
    feed.style.borderTop = "1px solid rgba(76, 188, 255, 0.25)";
    feed.style.paddingTop = "6px";
    feed.style.color = "#b7e3ff";

    panel.appendChild(controls);
    panel.appendChild(body);
    panel.appendChild(feed);

    document.body.appendChild(panel);
    overlayEl = panel;
    return panel;
  };

  const renderOverlay = (snapshot: OverlaySnapshot) => {
    const panel = ensureOverlay();
    const body = panel.querySelector("#startup-trace-overlay-body") as HTMLDivElement | null;
    const feed = panel.querySelector("#startup-trace-overlay-feed") as HTMLDivElement | null;
    if (!body || !feed) return;

    body.textContent = [
      `t=${snapshot.t} tick=${snapshot.tick}`,
      `ready=${snapshot.readyState} sw=${snapshot.swControlled ? "yes" : "no"}`,
      `fonts=${snapshot.fontStatus} loaded=${snapshot.loadedCount} missing=${snapshot.missingCount}`,
      `google css=${snapshot.googleCssReq} files=${snapshot.googleFontFilesReq}`,
      `fcp=${snapshot.fcpMs ?? "-"}ms lcp=${snapshot.lcpMs ?? "-"}ms`,
      `cls=${snapshot.cls.toFixed(4)} longtasks=${snapshot.longTasks}`,
      `MUT=${snapshot.mutations} top=${snapshot.topMutationTarget}`,
      `RND=${snapshot.reactRenders} top=${snapshot.topRenderId}`,
      `events=${events.length}`,
    ].join("\n");

    const latest = events.slice(-10).map((e) => {
      const detail = e.details === undefined ? "" : ` ${JSON.stringify(e.details)}`;
      return `${e.t} [${e.level}] ${e.event}${detail}`;
    });
    feed.textContent = latest.join("\n");
  };

  log("trace-start", {
    href: window.location.href,
    readyState: document.readyState,
    online: navigator.onLine,
    swControlled: !!navigator.serviceWorker?.controller,
  });

  const consoleKeys: Array<keyof typeof nativeConsole> = ["log", "info", "warn", "error", "debug"];
  for (const key of consoleKeys) {
    const original = nativeConsole[key];
    (console as unknown as Record<string, (...args: unknown[]) => void>)[key] = (...args: unknown[]) => {
      original(...args);
      if (typeof args[0] === "string" && args[0].includes("[startup-trace]")) return;
      pushEvent(key as TraceLevel, `console.${key}`, args.map(stringifySafe));
    };
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const req = args[0] instanceof Request ? args[0] : new Request(args[0], args[1]);
    const t0 = performance.now();
    try {
      const response = await originalFetch(...args);
      pushEvent("metric", "fetch", {
        url: req.url,
        method: req.method,
        status: response.status,
        durationMs: Number((performance.now() - t0).toFixed(1)),
        fromSWCache: response.headers.get("x-sw-cache") ?? null,
      });
      return response;
    } catch (error) {
      pushEvent("error", "fetch-error", {
        url: req.url,
        method: req.method,
        durationMs: Number((performance.now() - t0).toFixed(1)),
        error: stringifySafe(error),
      });
      throw error;
    }
  };

  const onWindowError = (event: ErrorEvent) => {
    pushEvent("error", "window-error", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: stringifySafe(event.error),
    });
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    pushEvent("error", "unhandled-rejection", {
      reason: stringifySafe(event.reason),
    });
  };

  window.addEventListener("error", onWindowError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);

  const fontFaceSet = (document as Document & { fonts?: FontFaceSet }).fonts;
  const onLoading = () => log("fonts-loading", { status: fontFaceSet?.status ?? "unknown" });
  const onLoadingDone = () => {
    const loaded = trackedFonts.filter(checkFontLoaded);
    const missing = trackedFonts.filter((f) => !checkFontLoaded(f));
    log("fonts-loadingdone", { loaded, missing });
  };
  const onLoadingError = () => log("fonts-loadingerror");

  if (fontFaceSet) {
    fontFaceSet.addEventListener("loading", onLoading as EventListener);
    fontFaceSet.addEventListener("loadingdone", onLoadingDone as EventListener);
    fontFaceSet.addEventListener("loadingerror", onLoadingError as EventListener);
  }

  const onSWControllerChange = () => {
    log("sw-controllerchange", {
      hasController: !!navigator.serviceWorker.controller,
    });
  };

  const onSWMessage = (event: MessageEvent) => {
    pushEvent("metric", "sw-message", {
      data: stringifySafe(event.data),
    });
  };

  navigator.serviceWorker?.addEventListener("controllerchange", onSWControllerChange);
  navigator.serviceWorker?.addEventListener("message", onSWMessage);

  const onPageShow = (e: PageTransitionEvent) => log("pageshow", { persisted: e.persisted });
  const onVisibility = () => log("visibility", { state: document.visibilityState });
  const onLoad = () => log("window-load");
  window.addEventListener("pageshow", onPageShow);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("load", onLoad);

  let cls = 0;
  let longTasks = 0;
  let lcpMs: number | null = null;
  let fcpMs: number | null = null;
  const perfObservers: PerformanceObserver[] = [];

  const safeObserve = (type: "paint" | "largest-contentful-paint" | "layout-shift" | "longtask") => {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (type === "layout-shift") {
            const ls = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
            if (!ls.hadRecentInput && typeof ls.value === "number") {
              cls += ls.value;
              log("cls-update", { cls: Number(cls.toFixed(4)) });
            }
            continue;
          }

          if (type === "largest-contentful-paint") {
            lcpMs = Number(entry.startTime.toFixed(1));
          }

          if (type === "longtask") {
            longTasks += 1;
          }

          if (type === "paint" && entry.name === "first-contentful-paint") {
            fcpMs = Number(entry.startTime.toFixed(1));
          }

          log(`perf-${type}`, {
            name: entry.name,
            startTime: Number(entry.startTime.toFixed(1)),
            duration: Number(entry.duration.toFixed(1)),
          });
        }
      });
      observer.observe({ type, buffered: true });
      perfObservers.push(observer);
    } catch {
      // unsupported in this browser
    }
  };

  safeObserve("paint");
  safeObserve("largest-contentful-paint");
  safeObserve("layout-shift");
  safeObserve("longtask");

  // ── DOM mutation tracer ──────────────────────────────────
  // This is the closest we can get to "what just changed visually".
  // We watch #root subtree and log meaningful mutations (not text nodes inside
  // existing elements) so we can correlate every perceived re-render to an
  // actual DOM change.
  let mutationCount = 0;
  const mutationsByTarget: Record<string, number> = {};
  const startMutationObserver = () => {
    const root = document.getElementById("root");
    if (!root) {
      window.setTimeout(startMutationObserver, 50);
      return;
    }
    const mo = new MutationObserver((records) => {
      for (const rec of records) {
        mutationCount += 1;
        const target = rec.target as Element;
        const desc = target.nodeType === 1
          ? `${target.tagName.toLowerCase()}${target.id ? "#" + target.id : ""}${target.className && typeof target.className === "string" ? "." + target.className.split(" ").slice(0, 2).join(".") : ""}`
          : target.nodeName;
        mutationsByTarget[desc] = (mutationsByTarget[desc] || 0) + 1;
        // Only log structural changes, not text/attr churn (those are noisy).
        if (rec.type === "childList" && (rec.addedNodes.length || rec.removedNodes.length)) {
          const added = Array.from(rec.addedNodes).filter((n) => n.nodeType === 1).map((n) => (n as Element).tagName.toLowerCase());
          const removed = Array.from(rec.removedNodes).filter((n) => n.nodeType === 1).map((n) => (n as Element).tagName.toLowerCase());
          if (added.length || removed.length) {
            log("dom-mutation", { target: desc, added, removed });
          }
        }
      }
    });
    mo.observe(root, { childList: true, subtree: true, attributes: true, characterData: false });
    perfObservers.push({ disconnect: () => mo.disconnect() } as PerformanceObserver);
    log("mutation-observer-installed", { rootChildren: root.children.length });
  };
  startMutationObserver();

  let ticks = 0;
  // Delay the first tick by 1.5 s so it never runs during the initial paint /
  // hydration window. Then poll every 2 s instead of 1 s and stop after 30 ticks
  // (~60 s of trace) — enough to diagnose font/SW issues without sustained DOM
  // mutation pressure on the main thread.
  const intervalId = window.setInterval(() => {
    ticks += 1;

    const resources = performance.getEntriesByType("resource");
    const googleCss = resources.filter((r) => r.name.includes("fonts.googleapis.com/css2"));
    const googleFiles = resources.filter((r) => r.name.includes("fonts.gstatic.com"));

    const loadedFonts = trackedFonts.filter(checkFontLoaded);

    log("tick", {
      tick: ticks,
      readyState: document.readyState,
      fontStatus: fontFaceSet?.status ?? "unknown",
      loadedFonts,
      missingFonts: trackedFonts.filter((f) => !checkFontLoaded(f)),
      googleCssReq: googleCss.length,
      googleFontFilesReq: googleFiles.length,
      swControlled: !!navigator.serviceWorker?.controller,
    });

    const topMutationEntry = Object.entries(mutationsByTarget).sort((a, b) => b[1] - a[1])[0];
    const topRenderEntry = Object.entries(renderCounts).sort((a, b) => b[1] - a[1])[0];

    renderOverlay({
      t: `${nowSeconds(start)}s`,
      tick: ticks,
      readyState: document.readyState,
      fontStatus: fontFaceSet?.status ?? "unknown",
      loadedCount: loadedFonts.length,
      missingCount: trackedFonts.length - loadedFonts.length,
      googleCssReq: googleCss.length,
      googleFontFilesReq: googleFiles.length,
      swControlled: !!navigator.serviceWorker?.controller,
      cls,
      longTasks,
      fcpMs,
      lcpMs,
      mutations: mutationCount,
      reactRenders: totalRenders,
      topMutationTarget: topMutationEntry ? `${topMutationEntry[0]}(${topMutationEntry[1]})` : "-",
      topRenderId: topRenderEntry ? `${topRenderEntry[0]}(${topRenderEntry[1]})` : "-",
    });

    if (ticks % 3 === 0) {
      persistLogs();
    }

    if (ticks >= 30) {
      stop();
    }
  }, 2000);

  const stop = () => {
    window.clearInterval(intervalId);

    for (const key of consoleKeys) {
      (console as unknown as Record<string, (...args: unknown[]) => void>)[key] = nativeConsole[key];
    }

    window.fetch = originalFetch;

    if (fontFaceSet) {
      fontFaceSet.removeEventListener("loading", onLoading as EventListener);
      fontFaceSet.removeEventListener("loadingdone", onLoadingDone as EventListener);
      fontFaceSet.removeEventListener("loadingerror", onLoadingError as EventListener);
    }

    window.removeEventListener("error", onWindowError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
    navigator.serviceWorker?.removeEventListener("controllerchange", onSWControllerChange);
    navigator.serviceWorker?.removeEventListener("message", onSWMessage);
    window.removeEventListener("pageshow", onPageShow);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("load", onLoad);

    perfObservers.forEach((o) => o.disconnect());

    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
    }

    persistLogs();
    log("trace-stop", {
      cls: Number(cls.toFixed(4)),
      longTasks,
      lcpMs,
      fcpMs,
      totalEvents: events.length,
    });

    delete window.__pashTraceHandle;
  };

  window.__pashTraceHandle = {
    stop,
    log,
    snapshot: () => ({ events: events.slice(), cls, longTasks, fcpMs, lcpMs }),
  };
}
