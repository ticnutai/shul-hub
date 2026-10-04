import { useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  useAnnouncements,
  useChavrutot,
  useMinyanCategories,
  useMinyanim,
  useMinyanOverrides,
  useSettings,
  useShiurim,
} from "@community/lib/data";
import { useCommunityId } from "@community/lib/community";
import { holyWindows, planReminders, type PlannedReminder } from "@community/lib/reminderPlan";
import { useReminderPrefs } from "@community/lib/reminderPrefsStore";
import { CHANNELS, deliver, ensureChannels } from "@community/lib/notify";
import { hasShulAlarm, ShulAlarm } from "@community/lib/shulAlarm";
import type { MinyanOverride } from "@community/lib/minyan-time";

/**
 * The reminders themselves - no screen of its own, beside the bell.
 *
 * In the app the phone keeps them: the week ahead is handed to Android,
 * which shows each on time with the app closed (and rings the ones the
 * member asked to ring). In a browser they can only come while the site is
 * open, so it looks every half minute. Either way a new notice or chavruta
 * the gabbai marked is told the moment it arrives.
 */

/** Ids of the planned reminders in the app: 300000 and up, the learning reminders and the Omer have theirs. */
const PLANNED_FIRST = 300_000;
const PLANNED_LAST = 300_999;
const PLAN_DAYS = 7;
/** Android keeps up to 500 per app; the learning reminders and the Omer need room too. */
const PLAN_MAX = 150;

const native = Capacitor.isNativePlatform();

async function syncNative(plan: PlannedReminder[], ring: boolean): Promise<void> {
  await ensureChannels();
  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter((n) => n.id >= PLANNED_FIRST && n.id <= PLANNED_LAST);
  if (ours.length) await LocalNotifications.cancel({ notifications: ours });

  const alarmPart = ring && hasShulAlarm();
  const rings = alarmPart ? plan.filter((p) => p.kind === "minyan") : [];
  const shown = alarmPart ? plan.filter((p) => p.kind !== "minyan") : plan;
  if (hasShulAlarm()) {
    await ShulAlarm.schedule({
      alarms: rings.map((p, i) => ({ id: PLANNED_FIRST + 500 + i, at: p.at.getTime(), title: p.title, body: p.body })),
    });
  }
  if (shown.length) {
    await LocalNotifications.schedule({
      notifications: shown.map((p, i) => ({
        id: PLANNED_FIRST + i,
        title: p.title,
        body: p.body,
        channelId: CHANNELS.minyan.id,
        schedule: { at: p.at, allowWhileIdle: true },
        extra: { key: p.key },
      })),
    });
  }
}

/** What was already told in this browser, so a reload does not tell it twice. */
const TOLD_KEY = "shul-reminders-told-v1";
function told(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(TOLD_KEY) ?? "{}");
  } catch {
    return {};
  }
}
function markTold(key: string) {
  const all = told();
  const weekAgo = Date.now() - 7 * 86_400_000;
  for (const [k, at] of Object.entries(all)) if (at < weekAgo) delete all[k];
  all[key] = Date.now();
  try {
    localStorage.setItem(TOLD_KEY, JSON.stringify(all));
  } catch {
    /* private mode */
  }
}

export function ReminderEngine() {
  const community = useCommunityId();
  const prefs = useReminderPrefs();
  const { data: minyanim = [] } = useMinyanim();
  const { data: categories = [] } = useMinyanCategories();
  const { data: overrides = [] } = useMinyanOverrides();
  const { data: shiurim = [] } = useShiurim();
  const { data: settings } = useSettings();
  const { data: announcements = [] } = useAnnouncements();
  const { data: chavrutot = [] } = useChavrutot();
  // Back in the app after a while: plan the week from now again.
  const [awake, setAwake] = useState(0);

  useEffect(() => {
    if (!native) return;
    const sub = CapacitorApp.addListener("resume", () => setAwake((n) => n + 1));
    return () => void sub.then((s) => s.remove());
  }, []);

  const inputs = useMemo(
    () => ({ minyanim, categories, overrides: overrides as unknown as MinyanOverride[], shiurim, settings }),
    [minyanim, categories, overrides, shiurim, settings],
  );

  // ---- The app: the week ahead, kept by the phone.
  useEffect(() => {
    if (!native || !community) return;
    const timer = window.setTimeout(() => {
      const plan = planReminders({ ...inputs, prefs, from: new Date(), days: PLAN_DAYS }).slice(0, PLAN_MAX);
      void syncNative(plan, prefs.alarm).catch((e) => console.warn("reminders", e));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [inputs, prefs, community, awake]);

  // ---- The app: new notices while it is closed (its own part, 1.11 on).
  const noticeIds = useMemo(
    () => announcements.filter((a) => a.notification_enabled).map((a) => a.id),
    [announcements],
  );
  useEffect(() => {
    if (!native || !community || !hasShulAlarm()) return;
    void ShulAlarm.configureNotices({
      enabled: prefs.enabled && prefs.announcements,
      url: import.meta.env.VITE_SUPABASE_URL,
      key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      communityId: community,
      seen: noticeIds,
      quiet: holyWindows(new Date(), 8, settings),
    }).catch((e) => console.warn("notices", e));
  }, [noticeIds, prefs.enabled, prefs.announcements, community, settings, awake]);

  // ---- A browser: while the site is open, every half minute.
  const last = useRef(Date.now() - 60_000);
  useEffect(() => {
    if (native || !prefs.enabled) return;
    const check = () => {
      const now = Date.now();
      const from = new Date(Math.max(last.current, now - 10 * 60_000));
      last.current = now;
      const done = told();
      for (const p of planReminders({ ...inputs, prefs, from, days: 2 })) {
        if (p.at.getTime() > now || done[p.key]) continue;
        markTold(p.key);
        void deliver({ title: p.title, body: p.body, tag: p.key, kind: "minyan", sound: prefs.sound });
      }
    };
    check();
    const timer = window.setInterval(check, 30_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [inputs, prefs]);

  // ---- New notices and chavrutot the gabbai marked, the moment they arrive.
  useEffect(() => {
    if (!prefs.enabled || !community) return;
    const showNew = (type: string, on: boolean, items: Array<{ id: string; title: string; body: string }>) => {
      const key = `shul-known-${type}-${community}-v1`;
      let known: Set<string>;
      try {
        known = new Set<string>(JSON.parse(localStorage.getItem(key) ?? "[]"));
      } catch {
        known = new Set();
      }
      // The first time on this device everything is "known": no flood of old notices.
      if (known.size > 0 && on) {
        for (const item of items.filter((i) => !known.has(i.id))) {
          void deliver({ title: item.title, body: item.body, tag: `${type}:${item.id}`, kind: "notice", sound: prefs.sound });
        }
      }
      try {
        localStorage.setItem(key, JSON.stringify(items.map((i) => i.id)));
      } catch {
        /* private mode */
      }
    };
    showNew(
      "announcements",
      prefs.announcements,
      announcements.filter((a) => a.notification_enabled).map((a) => ({ id: a.id, title: a.title, body: a.body })),
    );
    showNew(
      "chavrutot",
      prefs.chavrutot,
      chavrutot.filter((c) => c.notification_enabled).map((c) => ({ id: c.id, title: `חברותא: ${c.topic}`, body: c.time_text })),
    );
  }, [announcements, chavrutot, prefs.enabled, prefs.announcements, prefs.chavrutot, prefs.sound, community]);

  return null;
}
