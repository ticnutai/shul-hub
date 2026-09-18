/**
 * The TV's link to the control center: identity, heartbeat, event log and
 * connection diagnosis. Framework-free; `useDeviceLink` binds it to React.
 *
 * Calls go through plain fetch to the RPC endpoints rather than supabase-js,
 * because diagnosing an outage needs the raw failure: a thrown TypeError
 * (nothing reached the network) must be told apart from an HTTP status (the
 * server answered), and supabase-js folds both into one error shape.
 */

const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const IDENTITY_KEY = "shul-tv-device";
const QUEUE_KEY = "shul-tv-event-queue";
const LAST_BEAT_KEY = "shul-tv-last-beat";
const OUTAGE_KEY = "shul-tv-outage";
/** When the board app went to the background, while it is there. */
const BACKGROUND_KEY = "shul-tv-background-since";

/** Recommended cadence: cheap for the server, and 3 missed beats = 3 minutes. */
export const HEARTBEAT_MS = 60_000;
/** While cut off, retry sooner so recovery is noticed within seconds, then settle. */
const RETRY_STEPS_MS = [10_000, 20_000, 30_000, 60_000];
const MAX_QUEUE = 300;

export type OutageReason = "network" | "internet" | "server" | "server_error" | "auth" | "timeout" | "restart" | "background";

export const OUTAGE_REASON_LABELS: Record<OutageReason, string> = {
  network: "אין רשת (Wi-Fi או כבל מנותקים)",
  internet: "יש רשת אבל אין אינטרנט (ראוטר או ספק)",
  server: "יש אינטרנט אבל השרת לא עונה",
  server_error: "שגיאת שרת",
  auth: "המסך לא אומת מול השרת",
  timeout: "השרת לא ענה בזמן",
  restart: "המסך כבה או הופעל מחדש (למשל הפסקת חשמל)",
  background: "נפתחה בטלוויזיה אפליקציה אחרת (הלוח עבר לרקע)",
};

export interface DeviceStatus {
  id: string;
  approved: boolean;
  name: string;
  pairingCode: string | null;
  online: boolean;
  outageReason: OutageReason | null;
}

interface QueuedEvent {
  at: string;
  level: "info" | "warn" | "error";
  kind: string;
  message: string;
  details?: Record<string, unknown>;
}

interface Outage {
  since: number;
  reasons: OutageReason[];
  attempts: number;
}

/* ------------------------------------------------------------ storage -- */

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the link still works, just without memory */
  }
}

function identity(): { id: string; secret: string } {
  const existing = load<{ id?: string; secret?: string }>(IDENTITY_KEY, {});
  if (existing.id && existing.secret && existing.secret.length >= 32) return existing as { id: string; secret: string };
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const created = {
    id: crypto.randomUUID(),
    secret: Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""),
  };
  save(IDENTITY_KEY, created);
  return created;
}

/* ----------------------------------------------------------- transport -- */

class RpcError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function rpc<T>(fn: string, args: Record<string, unknown>, timeoutMs = 15_000): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") throw new RpcError("timeout", -1);
    throw new RpcError(String(error), 0);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new RpcError(body?.message ?? `HTTP ${res.status}`, res.status, body?.code);
  return body as T;
}

/** Is the wider internet reachable? Tells "router/ISP down" from "server down". */
async function internetReachable(): Promise<boolean> {
  try {
    // An opaque no-cors response still resolves only if the request got through.
    await fetch("https://connectivitycheck.gstatic.com/generate_204", {
      mode: "no-cors",
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    return true;
  } catch {
    return false;
  }
}

async function diagnose(error: unknown): Promise<OutageReason> {
  if (error instanceof RpcError) {
    if (error.status === -1) return "timeout";
    if (error.status === 401 || error.status === 403) return "auth";
    if (error.status >= 500 && error.code !== "P0002") return "server_error";
    if (error.status > 0) return "server";
  }
  if (!navigator.onLine) return "network";
  return (await internetReachable()) ? "server" : "internet";
}

/* ---------------------------------------------------------------- link -- */

export class DeviceLink {
  readonly id: string;
  private readonly secret: string;
  private queue: QueuedEvent[] = load<QueuedEvent[]>(QUEUE_KEY, []);
  private outage: Outage | null = load<Outage | null>(OUTAGE_KEY, null);
  private timer: number | undefined;
  private flushTimer: number | undefined;
  private stopped = false;
  private registered = false;
  private flushing = false;
  private flushAgain = false;
  private status: DeviceStatus;
  private readonly recentErrors = new Map<string, number>();

  constructor(
    private readonly getState: () => Record<string, unknown>,
    private readonly onStatus: (status: DeviceStatus) => void,
    private readonly info: Record<string, unknown>,
  ) {
    const me = identity();
    this.id = me.id;
    this.secret = me.secret;
    this.status = { id: me.id, approved: false, name: "", pairingCode: null, online: false, outageReason: null };
  }

  start() {
    const lastBeat = load<number | null>(LAST_BEAT_KEY, null);
    const gapMs = lastBeat ? Date.now() - lastBeat : null;
    const backgroundSince = load<number | null>(BACKGROUND_KEY, null);
    save(BACKGROUND_KEY, null);
    if (gapMs !== null && gapMs > 3 * HEARTBEAT_MS) {
      // The app was not running for longer than a few heartbeats. If it had
      // been sent to the background (someone opened YouTube on the TV) that
      // is the reason; otherwise a power cut, the TV switched off, or a crash.
      // Count it as an outage so the report shows the gap with a reason.
      const reason: OutageReason = backgroundSince ? "background" : "restart";
      if (!this.outage) this.outage = { since: backgroundSince ?? lastBeat!, reasons: [], attempts: 0 };
      if (!this.outage.reasons.includes(reason)) this.outage.reasons.push(reason);
      save(OUTAGE_KEY, this.outage);
    }
    this.log("info", "boot", "המסך עלה", {
      sinceLastHeartbeatMs: gapMs,
      userAgent: navigator.userAgent.slice(0, 160),
      screen: `${screen.width}x${screen.height}`,
    });

    window.addEventListener("error", this.onError);
    window.addEventListener("unhandledrejection", this.onRejection);
    window.addEventListener("online", this.onOnline);
    void this.beat();
  }

  stop() {
    this.stopped = true;
    window.clearTimeout(this.timer);
    window.clearTimeout(this.flushTimer);
    window.removeEventListener("error", this.onError);
    window.removeEventListener("unhandledrejection", this.onRejection);
    window.removeEventListener("online", this.onOnline);
  }

  /**
   * The board app left the screen (another app opened) or came back.
   * In the background Android pauses the WebView, heartbeats stop and the
   * admin sees the screen go offline - which is true, the board is not on the
   * wall. This records why, so the report says "another app was opened"
   * instead of guessing a power cut.
   */
  setForeground(active: boolean) {
    if (this.stopped) return;
    if (!active) {
      if (load<number | null>(BACKGROUND_KEY, null) === null) save(BACKGROUND_KEY, Date.now());
      this.log("warn", "background", "הלוח עבר לרקע: נפתחה בטלוויזיה אפליקציה אחרת");
      this.scheduleFlush(0);
      return;
    }
    const since = load<number | null>(BACKGROUND_KEY, null);
    save(BACKGROUND_KEY, null);
    if (since === null) return;
    const awayMs = Date.now() - since;
    // Short trips (the remote's Home button pressed by mistake) stay a log line.
    if (awayMs > 3 * HEARTBEAT_MS) {
      if (!this.outage) this.outage = { since, reasons: [], attempts: 0 };
      if (!this.outage.reasons.includes("background")) this.outage.reasons.push("background");
      save(OUTAGE_KEY, this.outage);
    } else {
      this.log("info", "background", `הלוח חזר למסך אחרי ${formatDuration(awayMs)}`);
    }
    window.clearTimeout(this.timer);
    void this.beat();
  }

  /** Push the current state now (slide change, command) instead of waiting a minute. */
  reportNow() {
    if (!this.status.online) return;
    window.clearTimeout(this.timer);
    void this.beat();
  }

  log(level: QueuedEvent["level"], kind: string, message: string, details?: Record<string, unknown>) {
    this.queue.push({ at: new Date().toISOString(), level, kind, message: message.slice(0, 1000), details });
    if (this.queue.length > MAX_QUEUE) this.queue.splice(0, this.queue.length - MAX_QUEUE);
    save(QUEUE_KEY, this.queue);
    if (this.status.online) this.scheduleFlush();
  }

  async putSnapshot(image: string) {
    await rpc("tv_put_snapshot", { p_device_id: this.id, p_secret: this.secret, p_image: image }, 30_000);
  }

  /* ---------------------------------------------------------- internals */

  private async beat() {
    if (this.stopped) return;
    try {
      const result = this.registered
        ? await rpc<{ approved: boolean; name: string; pairing_code: string | null }>("tv_heartbeat", {
            p_device_id: this.id,
            p_secret: this.secret,
            p_state: this.getState(),
          })
        : await rpc<{ approved: boolean; name: string; pairing_code: string | null }>("tv_register", {
            p_device_id: this.id,
            p_secret: this.secret,
            p_info: this.info,
          });
      this.registered = true;
      save(LAST_BEAT_KEY, Date.now());
      this.recover();
      this.setStatus({ approved: result.approved, name: result.name, pairingCode: result.pairing_code, online: true, outageReason: null });
      this.scheduleFlush(0);
      this.schedule(HEARTBEAT_MS);
    } catch (error) {
      if (error instanceof RpcError && error.code === "P0002" && this.registered) {
        // The admin removed this screen: start over as a new, unpaired device.
        this.registered = false;
        this.schedule(1000);
        return;
      }
      const reason = await diagnose(error);
      if (!this.outage) this.outage = { since: Date.now(), reasons: [], attempts: 0 };
      this.outage.attempts += 1;
      if (!this.outage.reasons.includes(reason)) this.outage.reasons.push(reason);
      save(OUTAGE_KEY, this.outage);
      this.setStatus({ online: false, outageReason: reason });
      const step = RETRY_STEPS_MS[Math.min(this.outage.attempts - 1, RETRY_STEPS_MS.length - 1)];
      this.schedule(step);
    }
  }

  private recover() {
    if (!this.outage) return;
    const until = Date.now();
    const durationMs = until - this.outage.since;
    const reasons = this.outage.reasons.length ? this.outage.reasons : (["server"] as OutageReason[]);
    this.log("warn", "outage", `ניתוק של ${formatDuration(durationMs)}: ${reasons.map((r) => OUTAGE_REASON_LABELS[r]).join(" ← ")}`, {
      from: new Date(this.outage.since).toISOString(),
      to: new Date(until).toISOString(),
      durationMs,
      reasons,
      attempts: this.outage.attempts,
    });
    this.outage = null;
    save(OUTAGE_KEY, null);
  }

  private scheduleFlush(delay = 2000) {
    window.clearTimeout(this.flushTimer);
    this.flushTimer = window.setTimeout(() => void this.flush(), delay);
  }

  private async flush() {
    if (this.queue.length === 0 || !this.registered) return;
    // One upload at a time. Found on the device: the timed flush and the one
    // after a command's immediate report ran concurrently, both sent the same
    // events before either removed them, and every command was logged twice.
    if (this.flushing) {
      this.flushAgain = true;
      return;
    }
    this.flushing = true;
    const batch = this.queue.slice(0, 200);
    try {
      await rpc("tv_log", { p_device_id: this.id, p_secret: this.secret, p_events: batch });
      this.queue.splice(0, batch.length);
      save(QUEUE_KEY, this.queue);
    } catch {
      /* stays queued; the next successful heartbeat flushes it */
    } finally {
      this.flushing = false;
    }
    if (this.flushAgain || this.queue.length) {
      this.flushAgain = false;
      if (this.queue.length) this.scheduleFlush(500);
    }
  }

  private schedule(ms: number) {
    window.clearTimeout(this.timer);
    if (!this.stopped) this.timer = window.setTimeout(() => void this.beat(), ms);
  }

  private setStatus(patch: Partial<DeviceStatus>) {
    this.status = { ...this.status, ...patch };
    this.onStatus(this.status);
  }

  private readonly onOnline = () => {
    // The network is back: do not wait out the retry step.
    this.schedule(500);
  };

  private readonly onError = (e: ErrorEvent) => this.reportError(e.message || "שגיאה", e.filename ? `${e.filename}:${e.lineno}` : undefined);
  private readonly onRejection = (e: PromiseRejectionEvent) =>
    this.reportError(e.reason instanceof Error ? e.reason.message : String(e.reason), undefined);

  /** Same error at most once per 10 minutes, so a loop cannot flood the log. */
  private reportError(message: string, where: string | undefined) {
    const now = Date.now();
    if ((this.recentErrors.get(message) ?? 0) > now - 10 * 60_000) return;
    this.recentErrors.set(message, now);
    this.log("error", "js-error", message, where ? { where } : undefined);
  }
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} שנ׳`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} דק׳`;
  const h = Math.floor(m / 60);
  return `${h} שע׳${m % 60 ? ` ו־${m % 60} דק׳` : ""}`;
}
