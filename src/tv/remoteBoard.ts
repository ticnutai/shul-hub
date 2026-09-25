/**
 * The board's code, live from the website.
 *
 * The APK used to carry the whole board, so every new feature - a new layout,
 * a painted board - reached the wall only after somebody rebuilt the APK and
 * climbed up to the TV to install it. Now the APK is a shell with a fallback:
 *
 *   1. It starts the board it carries, straight away. A TV that boots after a
 *      power cut before the router is back still shows the times.
 *   2. Meanwhile it asks the website for the board (index-tv.html, built with
 *      the site on every publish). When the answer is a real board page, it
 *      moves the WebView there, handing over the screen's identity so it
 *      stays paired with the same synagogue.
 *   3. Offline at boot? It keeps asking every few minutes and moves over once
 *      the internet is back.
 *
 * On the website's copy, every reload (the admin's "reload" command, the
 * nightly refresh, the watchdog) first checks that the site answers; if it
 * does not, the board goes back to the copy in the APK instead of leaving a
 * browser error page on the wall. It also notices a newly published version
 * and reloads itself onto it.
 *
 * Build the APK with VITE_TV_REMOTE=0 to keep the old, fully local behaviour.
 */

export const REMOTE_BOARD_URL = "https://shul-hub.lovable.app/index-tv.html";
const REMOTE_ORIGIN = new URL(REMOTE_BOARD_URL).origin;

/** Present in index-tv.html; a page without it (an error page, a login wall) is not the board. */
export const BOARD_MARKER = 'name="shul-tv-board"';

/** What moves with the screen: who it is, and which synagogue it last showed. */
export const HANDOFF_KEYS = ["shul-tv-device", "shul-tv-community"] as const;
/** On the website's copy: where the APK's own copy lives, to fall back to. */
const LOCAL_URL_KEY = "shul-tv-local-url";

const PROBE_TIMEOUT_MS = 8_000;
const RETRY_MS = 5 * 60_000;
const VERSION_CHECK_MS = 15 * 60_000;

type Store = Pick<Storage, "getItem" | "setItem">;

export function isRemoteBoard(origin = window.location.origin): boolean {
  return origin === REMOTE_ORIGIN;
}

export function remoteEnabled(): boolean {
  return import.meta.env.VITE_TV_REMOTE !== "0";
}

/** The fragment handed to the website's copy: the identity keys and the way back. */
export function encodeHandoff(storage: Store, localUrl: string): string {
  const values: Record<string, string> = {};
  for (const key of HANDOFF_KEYS) {
    const value = storage.getItem(key);
    if (value !== null) values[key] = value;
  }
  return `handoff=${encodeURIComponent(JSON.stringify({ values, localUrl }))}`;
}

/**
 * Takes a handoff from the location hash, if there is one. The APK's copy is
 * the screen's identity, so its values win over whatever this origin holds.
 * Returns true when a handoff was read.
 */
export function applyHandoff(hash: string, storage: Store): boolean {
  const match = /(?:^#|&)handoff=([^&]*)/.exec(hash);
  if (!match) return false;
  try {
    const data = JSON.parse(decodeURIComponent(match[1])) as { values?: Record<string, unknown>; localUrl?: unknown };
    for (const key of HANDOFF_KEYS) {
      const value = data.values?.[key];
      if (typeof value === "string" && storage.getItem(key) !== value) storage.setItem(key, value);
    }
    if (typeof data.localUrl === "string" && /^https?:\/\/localhost\//.test(data.localUrl)) {
      storage.setItem(LOCAL_URL_KEY, data.localUrl);
    }
    return true;
  } catch {
    return false;
  }
}

/** The script the board page loads (its hash changes with every publish). */
export function boardScript(html: string): string | null {
  return /<script[^>]+src="([^"]*index-tv[^"]*\.js)"/.exec(html)?.[1] ?? null;
}

/** The website's board page, or null when it is out of reach or not the board. */
export async function fetchRemoteBoard(fetchImpl: typeof fetch = fetch, timeoutMs = PROBE_TIMEOUT_MS): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${REMOTE_BOARD_URL}?probe=${Date.now()}`, { cache: "no-store", signal: controller.signal });
    if (!res.ok) return null;
    const html = await res.text();
    return html.includes(BOARD_MARKER) ? html : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * On the APK's copy: move to the website's copy as soon as it answers.
 * Returns a function that stops trying.
 */
export function startRemoteSwitch(): () => void {
  let stopped = false;
  let timer: number | undefined;
  const attempt = async () => {
    if (stopped) return;
    if (await fetchRemoteBoard()) {
      if (stopped) return;
      const localUrl = `${window.location.origin}/`;
      window.location.replace(`${REMOTE_BOARD_URL}?t=${Date.now()}#${encodeHandoff(localStorage, localUrl)}`);
      return;
    }
    timer = window.setTimeout(attempt, RETRY_MS);
  };
  void attempt();
  return () => {
    stopped = true;
    window.clearTimeout(timer);
  };
}

function localUrl(): string | null {
  try {
    return localStorage.getItem(LOCAL_URL_KEY);
  } catch {
    return null;
  }
}

/**
 * Reload the board. On the website's copy, only when the website answers;
 * otherwise back to the APK's own copy, never to a browser error page.
 */
export function reloadBoard(): void {
  const back = isRemoteBoard() ? localUrl() : null;
  if (!back) {
    window.location.reload();
    return;
  }
  void fetchRemoteBoard().then((html) => {
    if (html) window.location.replace(`${REMOTE_BOARD_URL}?t=${Date.now()}`);
    else window.location.replace(back);
  });
}

/**
 * On the website's copy: reload onto a newly published board. Checks now and
 * then; a check that cannot reach the site changes nothing.
 */
export function watchForNewVersion(): () => void {
  const current = document.querySelector<HTMLScriptElement>('script[type="module"][src*="index-tv"]')?.getAttribute("src");
  if (!current) return () => {};
  const timer = window.setInterval(async () => {
    const html = await fetchRemoteBoard();
    const next = html && boardScript(html);
    if (next && next !== current) reloadBoard();
  }, VERSION_CHECK_MS);
  return () => window.clearInterval(timer);
}
