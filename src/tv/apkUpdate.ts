import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

/**
 * The board app updates itself. The website publishes /tv-version.json next
 * to /tv.apk; the app compares it with its own version, downloads a newer APK
 * in the background, and shows a small line on the screen: "press OK to
 * install". Android's installer then asks for one more OK - an app can never
 * install itself silently on a device nobody manages.
 *
 * Needs the ApkUpdater plugin (android-tv, from 1.35). On an older app, or in
 * a browser, nothing here runs.
 */

interface ApkUpdaterPlugin {
  info(): Promise<{ versionCode: number; versionName: string; canInstall: boolean; downloaded: boolean }>;
  download(opts: { url: string }): Promise<{ bytes: number }>;
  install(): Promise<{ needsPermission: boolean }>;
  addListener(event: "progress", fn: (e: { percent: number }) => void): Promise<PluginListenerHandle>;
}

const ApkUpdater = registerPlugin<ApkUpdaterPlugin>("ApkUpdater");

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
  | { phase: "permission"; version: string };

export function canSelfUpdate(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("ApkUpdater");
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
    try {
      const mine = await ApkUpdater.info();
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
    if (state.phase !== "ready" && state.phase !== "permission") return false;
    try {
      const r = await ApkUpdater.install();
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
    default:
      return null;
  }
}
