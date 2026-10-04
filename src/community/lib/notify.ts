import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { toast } from "sonner";

/**
 * Telling a member something now: a notice from the gabbai, a minyan about
 * to start. One way out for the website and the app:
 *   - the page in front of them: a message on it, with a short chime;
 *   - the page hidden or the app in the background: the phone's own
 *     notification - in the app always, in a browser when allowed.
 * In a browser a notification goes through the page's service worker when it
 * has one: Chrome on Android refuses `new Notification()` outright
 * ("Illegal constructor"), which used to take the whole reminder down with
 * it - not even the message on the page was left.
 */

/** The phone's notification channels of the synagogue (the app). */
export const CHANNELS = {
  minyan: { id: "shul_minyanim_v2", name: "תזכורות למניינים ולשיעורים", description: "רגע לפני שמתחיל מניין או שיעור שבחרתם" },
  notice: { id: "shul_notices_v2", name: "מודעות בית הכנסת", description: "מודעה חדשה מהגבאי" },
} as const;

let channelsReady: Promise<void> | null = null;

/**
 * A notification channel with the phone's own notification sound.
 *
 * Asking for sound "default" names a sound file called "default" inside the
 * app - there is none, so every such channel was silent: the learning
 * reminders, the Omer, everything (found on a Galaxy S25). Left out, Android
 * uses the phone's sound. A channel cannot be changed once made, and one
 * deleted comes back with its old settings if made again under the same id -
 * so the silent ones are retired, and a new id is made in their place.
 */
export async function ensureSoundChannel(
  channel: { id: string; name: string; description: string; importance: 1 | 2 | 3 | 4 | 5 },
  retired: string[] = [],
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { channels } = await LocalNotifications.listChannels();
  for (const id of retired) {
    if (channels.some((c) => c.id === id)) await LocalNotifications.deleteChannel({ id });
  }
  if (channels.some((c) => c.id === channel.id)) return;
  await LocalNotifications.createChannel({ ...channel, visibility: 1, vibration: true, lights: true });
}

/** The silent channels of before (ensureSoundChannel). */
const RETIRED = ["shul_minyanim", "shul_notices"];

/** The channels, made once: loud, on top of whatever is open, with a buzz. */
export function ensureChannels(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve();
  channelsReady ??= (async () => {
    try {
      // 5: pops up over the app in use (heads-up), with sound.
      for (const c of Object.values(CHANNELS)) await ensureSoundChannel({ ...c, importance: 5 }, RETIRED);
    } catch (e) {
      channelsReady = null;
      console.warn("notification channels", e);
    }
  })();
  return channelsReady;
}

let audio: AudioContext | null = null;

/** Two soft notes, made on the spot - nothing to download, nothing to license. */
export function playChime(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    if (audio.state === "suspended") void audio.resume();
    const start = audio.currentTime + 0.02;
    [880, 1318.5].forEach((freq, i) => {
      const osc = audio!.createOscillator();
      const gain = audio!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = start + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      osc.connect(gain).connect(audio!.destination);
      osc.start(t);
      osc.stop(t + 0.65);
    });
  } catch {
    /* no sound is no harm */
  }
}

/** Ids of the notifications shown right away in the app (not the planned ones). */
let nextNowId = 400_000 + Math.floor(Math.random() * 1000);

/** The phone's own notification; false when there is no way to show one. */
export async function showSystemNotification(title: string, body: string, tag: string, kind: keyof typeof CHANNELS): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      await ensureChannels();
      nextNowId = nextNowId >= 499_000 ? 400_000 : nextNowId + 1;
      await LocalNotifications.schedule({
        notifications: [{ id: nextNowId, title, body, channelId: CHANNELS[kind].id, extra: { tag } }],
      });
      return true;
    } catch {
      return false;
    }
  }
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
  const options: NotificationOptions = { body, tag, icon: "/favicon.ico", badge: "/favicon.ico", dir: "rtl", lang: "he" };
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) {
      await reg.showNotification(title, options);
      return true;
    }
  } catch {
    /* on to the page's own */
  }
  try {
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

/**
 * Tells it: on the page when it is in front (with the chime), else as the
 * phone's notification - and if that cannot be, on the page after all.
 */
export async function deliver({
  title,
  body,
  tag,
  kind,
  sound,
}: {
  title: string;
  body: string;
  tag: string;
  kind: keyof typeof CHANNELS;
  sound: boolean;
}): Promise<void> {
  const inFront = typeof document === "undefined" || document.visibilityState === "visible";
  if (inFront) {
    toast(title, { description: body, duration: 10_000 });
    if (sound) playChime();
    return;
  }
  if (!(await showSystemNotification(title, body, tag, kind))) {
    toast(title, { description: body, duration: 10_000 });
  }
}
