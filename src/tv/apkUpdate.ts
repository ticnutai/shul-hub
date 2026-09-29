import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

/**
 * The board app updates itself. The website publishes /tv-version.json next
 * to /tv.apk; the app compares it with its own version, downloads a newer APK
 * in the background, and shows a small line on the screen: "press OK to
 * install". Android's installer then asks for one more OK - an app can never
 * install itself silently on a device nobody manages.
 *
 * Needs the ApkUpdater plugin (android-tv, from 1.35) when the board runs from
 * the APK's own copy, or NativeBridge (from 1.37) when it runs from the
 * website, as every box does. On an older app, or in a browser, nothing here runs.
 */

interface ApkUpdaterPlugin {
  info(): Promise<{ versionCode: number; versionName: string; canInstall: boolean; downloaded: boolean; silent?: boolean }>;
  download(opts: { url: string }): Promise<{ bytes: number }>;
  install(): Promise<{ needsPermission: boolean }>;
  addListener(event: "progress", fn: (e: { percent: number }) => void): Promise<PluginListenerHandle>;
}

const ApkUpdaterPluginImpl = registerPlugin<ApkUpdaterPlugin>("ApkUpdater");

/**
 * The same updater through the WebView's own bridge (NativeBridge.java, from
 * app 1.37).
 *
 * Every box shows the board from the website, and there Capacitor's plugins
 * are not reachable - so the plugin above never ran on a wall, and a box kept
 * whatever APK it was first given. A JavaScript interface belongs to the
 * WebView, not to the page's origin, and is there either way. Its download
 * reports back through `shul-apk` events.
 */
export interface ShulTvNative {
  info(): string;
  download(url: string): boolean;
  install(): string;
  /** From app 1.38: check, fetch and install now (AutoUpdate). */
  installNow?(): boolean;
}

/** What the app says about itself, for the admin (version, silent updates). */
export interface NativeAppInfo {
  versionCode: number;
  versionName: string;
  canInstall: boolean;
  silent?: boolean;
  readyName?: string;
  lastError?: string;
  lastResult?: string;
}

export function nativeAppInfo(): NativeAppInfo | null {
  const n = nativeBridge();
  if (!n) return null;
  try {
    const raw = n.info();
    return raw ? (JSON.parse(raw) as NativeAppInfo) : null;
  } catch {
    return null;
  }
}

/** "עדכון עכשיו" from the admin. False when this app cannot (older app, or Android before 12). */
export function installUpdateNow(): boolean {
  const n = nativeBridge();
  return Boolean(n?.installNow?.());
}

function nativeBridge(): ShulTvNative | null {
  const n = (window as { ShulTvNative?: ShulTvNative }).ShulTvNative;
  return n && typeof n.info === "function" ? n : null;
}

export function bridgeUpdater(n: ShulTvNative): ApkUpdaterPlugin {
  const progressFns = new Set<(e: { percent: number }) => void>();
  return {
    async info() {
      const raw = n.info();
      if (!raw) throw new Error("info failed");
      return JSON.parse(raw);
    },
    download({ url }) {
      return new Promise((resolve, reject) => {
        const onEvent = (e: Event) => {
          const d = (e as CustomEvent<{ type: string; percent?: number; bytes?: number; message?: string }>).detail;
          if (d.type === "progress") progressFns.forEach((fn) => fn({ percent: d.percent ?? 0 }));
          else {
            window.removeEventListener("shul-apk", onEvent);
            if (d.type === "done") resolve({ bytes: d.bytes ?? 0 });
            else reject(new Error(d.message ?? "download failed"));
          }
        };
        window.addEventListener("shul-apk", onEvent);
        if (!n.download(url)) {
          window.removeEventListener("shul-apk", onEvent);
          reject(new Error("url not allowed"));
        }
      });
    },
    async install() {
      const r = n.install();
      if (r === "error") throw new Error("install failed");
      return { needsPermission: r === "permission" };
    },
    async addListener(_event, fn) {
      progressFns.add(fn);
      return { remove: async () => void progressFns.delete(fn) } as PluginListenerHandle;
    },
  };
}

/** The plugin when the board runs from the APK's own copy; the bridge when it runs from the website. */
function updater(): ApkUpdaterPlugin {
  const n = nativeBridge();
  return n && !(Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("ApkUpdater")) ? bridgeUpdater(n) : ApkUpdaterPluginImpl;
}

export const VERSION_URL = "https://shul-hub.lovable.app/tv-version.json";
const CHECK_EVERY_MS = 3 * 60 * 60 * 1000;
const FIRST_CHECK_MS = 60 * 1000;

export type RemoteVersion = { versionCode: number; versionName: string; apk: string };

/** The published version, if it is valid and newer than the installed one. */
export function newerVersion(raw: unknown, installedCode: number): RemoteVersion | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const code = Number(r.versionCode);
  const apk = typeof r.apk === "string" ? r.apk : "";
  if (!Number.isInteger(code) || code <= installedCode) return null;
  if (!/^https:\/\/shul-hub\.lovable\.app\/[\w./-]+\.apk$/.test(apk)) return null;
  return { versionCode: code, versionName: String(r.versionName ?? code), apk };
}

export type UpdateState =
  | { phase: "idle" }
  | { phase: "downloading"; version: string; percent: number }
  | { phase: "ready"; version: string }
  | { phase: "permission"; version: string }
  /** Silent updates are on, but Android has not yet been told this app may install. */
  | { phase: "allow"; version: string };

export function canSelfUpdate(): boolean {
  return (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("ApkUpdater")) || nativeBridge() !== null;
}

/** Checks, downloads and offers the update. `install()` is what OK on the remote calls. */
export function useApkUpdate(log?: (msg: string) => void): { state: UpdateState; install: () => Promise<boolean> } {
  const [state, setState] = useState<UpdateState>({ phase: "idle" });
  const busy = useRef(false);
  const logRef = useRef(log);
  logRef.current = log;

  const check = useCallback(async () => {
    if (busy.current || !canSelfUpdate()) return;
    busy.current = true;
    const ApkUpdater = updater();
    try {
      const mine = await ApkUpdater.info();
      // The app updates itself at night (AutoUpdate, Android 12+): no "press
      // OK" here. All it may need, once, is to be allowed to install apps -
      // and that is asked for on the screen, with OK opening Android's switch.
      if (mine.silent) {
        setState(mine.canInstall ? { phase: "idle" } : { phase: "allow", version: mine.versionName });
        return;
      }
      const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const next = newerVersion(await res.json(), mine.versionCode);
      if (!next) return;
      logRef.current?.(`נמצאה גרסה חדשה של האפליקציה: ${next.versionName} (מותקנת ${mine.versionName})`);
      setState({ phase: "downloading", version: next.versionName, percent: 0 });
      const progress = await ApkUpdater.addListener("progress", (e) =>
        setState((s) => (s.phase === "downloading" ? { ...s, percent: Math.max(0, e.percent) } : s)),
      );
      try {
        await ApkUpdater.download({ url: next.apk });
      } finally {
        await progress.remove();
      }
      setState({ phase: "ready", version: next.versionName });
      logRef.current?.(`גרסה ${next.versionName} ירדה ומחכה ללחיצת OK בשלט`);
    } catch (e) {
      setState({ phase: "idle" });
      logRef.current?.(`בדיקת עדכון נכשלה: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    if (!canSelfUpdate()) return;
    const first = window.setTimeout(() => void check(), FIRST_CHECK_MS);
    const every = window.setInterval(() => void check(), CHECK_EVERY_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
    };
  }, [check]);

  const install = useCallback(async () => {
    if (state.phase !== "ready" && state.phase !== "permission" && state.phase !== "allow") return false;
    try {
      const r = await updater().install();
      if (state.phase === "allow") {
        // The switch is open; nothing more to press here - the night does the rest.
        setState({ phase: "idle" });
        logRef.current?.("נפתח מסך ההרשאה להתקנה - לעדכונים שקטים");
        return true;
      }
      // First time: Android opened its "allow installs from this app" screen; after that, OK again.
      setState(r.needsPermission ? { phase: "permission", version: state.version } : { phase: "ready", version: state.version });
      logRef.current?.(r.needsPermission ? "נפתח מסך ההרשאה להתקנה" : "נפתח מתקין אנדרואיד");
    } catch (e) {
      logRef.current?.(`פתיחת ההתקנה נכשלה: ${e instanceof Error ? e.message : String(e)}`);
    }
    return true;
  }, [state]);

  return { state, install };
}

/** The line on the screen, or null. */
export function updateText(state: UpdateState): string | null {
  switch (state.phase) {
    case "downloading":
      return `מוריד גרסה חדשה של הלוח (${state.version})… ${state.percent}%`;
    case "ready":
      return `גרסה חדשה של הלוח (${state.version}) מוכנה · לחצו OK בשלט להתקנה`;
    case "permission":
      return `אשרו "התקנת אפליקציות" ללוח במסך שנפתח, חזרו ולחצו OK שוב`;
    case "allow":
      return `כדי שהלוח יתעדכן לבד בלילה: לחצו OK ואשרו "התקנת אפליקציות" - פעם אחת בלבד`;
    default:
      return null;
  }
}
