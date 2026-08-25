import { useState, useCallback, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const STORAGE_KEY = "omer_reminder_v2";
const CHANNEL_ID = "omer_reminders_v2";
const NOTIF_ID_START = 3100;

export interface OmerReminderConfig {
  enabled: boolean;
  hour: number;
  minute: number;
}

function loadConfig(): OmerReminderConfig {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return { enabled: false, hour: 20, minute: 0, ...JSON.parse(s) };
  } catch { /* ignore */ }
  return { enabled: false, hour: 20, minute: 0 };
}

function saveConfig(config: OmerReminderConfig) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch { /* ignore */ }
}

async function ensureChannel() {
  try {
    const { channels } = await LocalNotifications.listChannels();
    if (!channels.some((c) => c.id === CHANNEL_ID)) {
      await LocalNotifications.createChannel({
        id: CHANNEL_ID,
        name: "ספירת העומר",
        description: "תזכורת יומית לספירת העומר",
        importance: 4,
        visibility: 1,
        sound: "default",
        vibration: true,
        lights: true,
      });
    }
  } catch { /* ignore */ }
}

async function cancelOmerNotifs() {
  try {
    const pending = await LocalNotifications.getPending();
    const ours = pending.notifications.filter(
      (n) => n.id >= NOTIF_ID_START && n.id < NOTIF_ID_START + 49,
    );
    if (ours.length > 0) await LocalNotifications.cancel({ notifications: ours });
  } catch { /* ignore */ }
}

async function scheduleOmerNotifs(config: OmerReminderConfig, startDate: Date, endDate: Date) {
  await cancelOmerNotifs();
  if (!config.enabled) return;

  try {
    await ensureChannel();
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endMidnight = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

    const iter = new Date(Math.max(startDate.getTime(), todayMidnight.getTime()));
    iter.setHours(config.hour, config.minute, 0, 0);
    if (iter <= today) iter.setDate(iter.getDate() + 1);

    const notifications: Parameters<typeof LocalNotifications.schedule>[0]["notifications"] = [];
    let id = NOTIF_ID_START;

    while (iter <= endMidnight && notifications.length < 49) {
      notifications.push({
        id: id++,
        title: "ספירת העומר 🕯️",
        body: "זמן לספור ספירת העומר!",
        channelId: CHANNEL_ID,
        schedule: { at: new Date(iter) },
        extra: { type: "omer" },
      });
      iter.setDate(iter.getDate() + 1);
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
  } catch (e) {
    console.warn("[OmerReminders] Failed to schedule:", e);
  }
}

async function requestPermission(): Promise<"granted" | "denied"> {
  if (!Capacitor.isNativePlatform()) {
    if (!("Notification" in window)) return "denied";
    const r = await Notification.requestPermission();
    return r === "granted" ? "granted" : "denied";
  }
  try {
    const { display } = await LocalNotifications.requestPermissions();
    return display === "granted" ? "granted" : "denied";
  } catch { return "denied"; }
}

export function useOmerReminders(startDate?: Date, endDate?: Date) {
  const [config, setConfig] = useState<OmerReminderConfig>(loadConfig);
  const [permission, setPermission] = useState<"default" | "granted" | "denied">("default");
  const isNative = Capacitor.isNativePlatform();

  // Check current permission state on mount
  useEffect(() => {
    if (!isNative) return;
    LocalNotifications.checkPermissions()
      .then(({ display }) => {
        if (display === "granted") setPermission("granted");
        else if (display === "denied") setPermission("denied");
      })
      .catch(() => { /* ignore */ });
  }, [isNative]);

  const enable = useCallback(
    async (hour: number, minute: number) => {
      const perm = await requestPermission();
      setPermission(perm);
      if (perm !== "granted") return false;
      const next: OmerReminderConfig = { enabled: true, hour, minute };
      setConfig(next);
      saveConfig(next);
      if (startDate && endDate) await scheduleOmerNotifs(next, startDate, endDate);
      return true;
    },
    [startDate, endDate],
  );

  const disable = useCallback(async () => {
    const next: OmerReminderConfig = { ...config, enabled: false };
    setConfig(next);
    saveConfig(next);
    if (isNative) await cancelOmerNotifs();
  }, [config, isNative]);

  const updateTime = useCallback(
    async (hour: number, minute: number) => {
      const next: OmerReminderConfig = { ...config, hour, minute };
      setConfig(next);
      saveConfig(next);
      if (next.enabled && isNative && startDate && endDate) {
        await scheduleOmerNotifs(next, startDate, endDate);
      }
    },
    [config, isNative, startDate, endDate],
  );

  return { config, permission, isNative, enable, disable, updateTime };
}
