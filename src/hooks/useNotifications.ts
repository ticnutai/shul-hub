import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import * as webPushService from "@/services/webPushService";

/* ─── Types ──────────────────────────────────────────────── */

const STORAGE_KEY = "dailyLearningReminders_v2";
const FIRST_INSTALL_KEY = "app_first_install_done";
const CHANNEL_ID = "daily_learning_reminders_v2";
const PERMISSION_AUTO_REQUEST_KEY = "daily_notifications_permission_auto_requested_v1";
const SETTINGS_CHANGED_EVENT = "daily_learning_reminders_changed_v1";

async function ensureNotificationChannel() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const channels = await LocalNotifications.listChannels();
    const exists = channels.channels.some((c) => c.id === CHANNEL_ID);
    if (!exists) {
      await LocalNotifications.createChannel({
        id: CHANNEL_ID,
        name: "תזכורות לימוד",
        description: "תזכורות יומיות ללימוד תורה",
        importance: 5,
        visibility: 1,
        sound: "default",
        vibration: true,
        lights: true,
      });
    }
  } catch (e) {
    console.warn("Failed to create daily notification channel:", e);
  }
}

function shouldAutoRequestPermission(reminders: SingleReminder[], permission: NotificationPermission): boolean {
  if (!Capacitor.isNativePlatform()) return false;
  if (permission !== "default") return false;
  if (!reminders.some((r) => r.enabled)) return false;
  try {
    return localStorage.getItem(PERMISSION_AUTO_REQUEST_KEY) !== "1";
  } catch {
    return true;
  }
}

export interface SingleReminder {
  id: string;          // unique id
  enabled: boolean;
  hour: number;        // 0-23
  minute: number;      // 0-59
  message: string;
  label: string;       // user-friendly name
  days: number[];      // 0=Sun … 6=Sat, empty = every day
  popup: boolean;      // show in-app popup
  sound: boolean;
}

export interface ReminderSettings {
  /** kept for backwards compat – mirrors first reminder */
  enabled: boolean;
  hour: number;
  minute: number;
  message: string;
  /** new multi-reminder list */
  reminders: SingleReminder[];
}

/* ─── Defaults ───────────────────────────────────────────── */

const makeId = () => Math.random().toString(36).slice(2, 10);

export function createDefaultReminder(overrides?: Partial<SingleReminder>): SingleReminder {
  return {
    id: makeId(),
    enabled: true,
    hour: 7,
    minute: 0,
    message: "זמן ללמוד תורה! 📖",
    label: "תזכורת לימוד",
    days: [],
    popup: true,
    sound: true,
    ...overrides,
  };
}

const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: false,
  hour: 7,
  minute: 0,
  message: "זמן ללמוד תורה! 📖",
  reminders: [],
};

/* ─── Persistence ────────────────────────────────────────── */

export function loadReminderSettings(): ReminderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    // migrate v1
    const v1 = localStorage.getItem("dailyLearningReminder");
    if (v1) {
      const old = JSON.parse(v1) as { enabled: boolean; hour: number; minute: number; message: string };
      const migrated: ReminderSettings = {
        ...old,
        reminders: old.enabled
          ? [createDefaultReminder({ enabled: true, hour: old.hour, minute: old.minute, message: old.message })]
          : [],
      };
      saveReminderSettings(migrated);
      return migrated;
    }
    return DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveReminderSettings(settings: ReminderSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  try {
    window.dispatchEvent(new CustomEvent<ReminderSettings>(SETTINGS_CHANGED_EVENT, { detail: settings }));
  } catch {
    // ignore dispatch errors
  }
  console.debug("[notifications] saveReminderSettings", settings);
  // Sync enabled reminders to Web Push (VAPID) server for background delivery
  if (webPushService.isWebPushSupported()) {
    const pushReminders: webPushService.ServerReminder[] = settings.reminders
      .filter((r) => r.enabled)
      .map((r) => ({
        id: r.id,
        enabled: true,
        hour: r.hour,
        minute: r.minute,
        message: r.message,
        type: "daily" as const,
        days: r.days,
      }));
    webPushService.syncReminders(pushReminders);
  }
}

/* ─── Auto-enable on first install ───────────────────────── */

function maybeAutoEnable(): ReminderSettings {
  const done = localStorage.getItem(FIRST_INSTALL_KEY);
  if (done) return loadReminderSettings();

  localStorage.setItem(FIRST_INSTALL_KEY, "1");
  // Do not auto-enable reminders on first install. Users must opt in.
  const existing = loadReminderSettings();
  if (existing.reminders.length > 0) {
    console.debug("[notifications] first install marker set, preserving existing reminders");
    return existing;
  }
  console.debug("[notifications] first install marker set, keeping reminders disabled by default");
  return DEFAULT_SETTINGS;
}

/* ─── Permission ─────────────────────────────────────────── */

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (Capacitor.isNativePlatform()) {
    const result = await LocalNotifications.requestPermissions();
    return result.display === "granted" ? "granted" : "denied";
  }
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  return Notification.requestPermission();
}

/* ─── In-App Popup ───────────────────────────────────────── */

let _popupCallback: ((reminder: SingleReminder) => void) | null = null;

export function onReminderPopup(cb: (reminder: SingleReminder) => void) {
  _popupCallback = cb;
}

function triggerPopup(reminder: SingleReminder) {
  if (_popupCallback) _popupCallback(reminder);
}

/* ─── Native (Capacitor) local notifications ─────────────── */

async function scheduleNativeNotifications(reminders: SingleReminder[]) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await ensureNotificationChannel();
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel(pending);
    }

    const enabled = reminders.filter((r) => r.enabled);
    if (enabled.length === 0) return;

    const notifications = enabled.map((r, idx) => {
      const now = new Date();
      const scheduled = new Date(now.getFullYear(), now.getMonth(), now.getDate(), r.hour, r.minute, 0);
      if (scheduled.getTime() <= now.getTime()) {
        scheduled.setDate(scheduled.getDate() + 1);
      }
      return {
        id: idx + 1,
        title: "חמישה חומשי תורה עם פירושים",
        body: r.message,
        channelId: CHANNEL_ID,
        schedule: {
          at: scheduled,
          every: "day" as const,
          allowWhileIdle: true,
        },
        sound: r.sound ? "default" : null,
        smallIcon: "ic_launcher",
        largeIcon: "ic_launcher",
      };
    });

    await LocalNotifications.schedule({ notifications });
  } catch (e) {
    console.warn("Failed to schedule native notifications:", e);
  }
}

/* ─── Browser web notification check ─────────────────────── */

/**
 * Safe notification display: on mobile Chrome/Android the `Notification`
 * constructor is illegal — must go through the service worker registration.
 */
async function showLocalNotification(title: string, options: NotificationOptions) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, options);
        return;
      }
    }
    new Notification(title, options);
  } catch (e) {
    console.warn("[Notifications] failed to show notification:", e);
  }
}

function maybeSendBrowserNotifications(reminders: SingleReminder[]) {
  if (Capacitor.isNativePlatform()) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const now = new Date();
  const dayOfWeek = now.getDay();

  for (const r of reminders) {
    if (!r.enabled) continue;
    if (r.days.length > 0 && !r.days.includes(dayOfWeek)) continue;

    const todayKey = `reminder_sent_${r.id}_${now.toDateString()}`;
    if (localStorage.getItem(todayKey)) continue;

    const scheduledMs = new Date(
      now.getFullYear(), now.getMonth(), now.getDate(), r.hour, r.minute, 0
    ).getTime();

    if (now.getTime() >= scheduledMs) {
      void showLocalNotification("חמישה חומשי תורה עם פירושים", {
        body: r.message,
        icon: "/favicon.ico",
        dir: "rtl",
        lang: "he",
        tag: r.id,
      });
      localStorage.setItem(todayKey, "1");

      if (r.popup) triggerPopup(r);
    }
  }
}

/* legacy compat */
function maybeSendDailyNotification(settings: ReminderSettings) {
  if (settings.reminders.length > 0) {
    maybeSendBrowserNotifications(settings.reminders);
    return;
  }
  // fallback legacy single reminder
  if (!settings.enabled) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();
  const todayKey = `reminder_sent_${now.toDateString()}`;
  if (localStorage.getItem(todayKey)) return;
  const scheduledMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), settings.hour, settings.minute, 0).getTime();
  if (now.getTime() >= scheduledMs) {
    void showLocalNotification("חמישה חומשי תורה עם פירושים", {
      body: settings.message, icon: "/favicon.ico", dir: "rtl", lang: "he",
    });
    localStorage.setItem(todayKey, "1");
  }
}

/* ─── Hook ───────────────────────────────────────────────── */

export function useNotifications() {
  const [settings, setSettings] = useState<ReminderSettings>(() => maybeAutoEnable());
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (Capacitor.isNativePlatform()) return "default";
    return "Notification" in window ? Notification.permission : "denied";
  });
  const [supported] = useState(() => Capacitor.isNativePlatform() || "Notification" in window);
  const [popupReminder, setPopupReminder] = useState<SingleReminder | null>(null);

  // Register popup callback
  useEffect(() => {
    onReminderPopup((r) => setPopupReminder(r));
    return () => { _popupCallback = null; };
  }, []);

  // Check native permission on mount
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      ensureNotificationChannel().catch(() => {});
      LocalNotifications.checkPermissions().then((r) => {
        setPermission(r.display === "granted" ? "granted" : "default");
      });
    }
  }, []);

  // Proactively request permission once when user has active reminders.
  useEffect(() => {
    if (!shouldAutoRequestPermission(settings.reminders, permission)) return;

    console.debug("[notifications] auto permission request start", {
      permission,
      enabledCount: settings.reminders.filter((r) => r.enabled).length,
    });

    requestNotificationPermission()
      .then((result) => setPermission(result))
      .catch(() => {})
      .finally(() => {
        try {
          localStorage.setItem(PERMISSION_AUTO_REQUEST_KEY, "1");
        } catch {
          // ignore storage errors
        }
      });
  }, [settings.reminders, permission]);

  // Keep multiple hook instances in sync within the same tab and across tabs.
  useEffect(() => {
    const syncFromStorage = () => {
      setSettings(loadReminderSettings());
    };
    const onSettingsChanged = (e: Event) => {
      const custom = e as CustomEvent<ReminderSettings>;
      if (custom.detail) {
        setSettings(custom.detail);
        return;
      }
      syncFromStorage();
    };

    window.addEventListener("storage", syncFromStorage);
    window.addEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged as EventListener);
    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged as EventListener);
    };
  }, []);

  // Browser polling
  useEffect(() => {
    maybeSendDailyNotification(settings);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        maybeSendDailyNotification(settings);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    const interval = setInterval(() => {
      maybeSendDailyNotification(settings);
    }, 60_000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(interval);
    };
  }, [settings]);

  // Schedule native when settings change
  useEffect(() => {
    scheduleNativeNotifications(settings.reminders);
  }, [settings.reminders]);

  const updateSettings = useCallback((partial: Partial<ReminderSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveReminderSettings(next);
      return next;
    });
  }, []);

  const addReminder = useCallback((overrides?: Partial<SingleReminder>) => {
    setSettings((prev) => {
      const r = createDefaultReminder(overrides);
      const next = { ...prev, reminders: [...prev.reminders, r] };
      saveReminderSettings(next);
      return next;
    });
  }, []);

  const updateReminder = useCallback((id: string, partial: Partial<SingleReminder>) => {
    setSettings((prev) => {
      const reminders = prev.reminders.map((r) => (r.id === id ? { ...r, ...partial } : r));
      const next = { ...prev, reminders };
      saveReminderSettings(next);
      return next;
    });
  }, []);

  const removeReminder = useCallback((id: string) => {
    setSettings((prev) => {
      const reminders = prev.reminders.filter((r) => r.id !== id);
      const next = { ...prev, reminders };
      saveReminderSettings(next);
      return next;
    });
  }, []);

  const requestPermission = useCallback(async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    return result;
  }, []);

  const sendTestNotification = useCallback(() => {
    if (!supported || permission !== "granted") return;
    if (Capacitor.isNativePlatform()) {
      LocalNotifications.schedule({
        notifications: [{
          id: 9999,
          title: "חמישה חומשי תורה עם פירושים - בדיקה",
          body: settings.reminders[0]?.message || settings.message,
          channelId: CHANNEL_ID,
          sound: "default",
          smallIcon: "ic_launcher",
        }],
      });
    } else {
      void showLocalNotification("חמישה חומשי תורה עם פירושים - בדיקה", {
        body: settings.reminders[0]?.message || settings.message,
        icon: "/favicon.ico",
        dir: "rtl",
        lang: "he",
      });
    }
  }, [supported, permission, settings]);

  const dismissPopup = useCallback(() => setPopupReminder(null), []);

  return {
    settings,
    updateSettings,
    addReminder,
    updateReminder,
    removeReminder,
    permission,
    requestPermission,
    sendTestNotification,
    supported,
    popupReminder,
    dismissPopup,
  };
}
