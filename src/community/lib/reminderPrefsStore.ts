import { useSyncExternalStore } from "react";
import { DEFAULT_REMINDER_PREFS, normalizeReminderPrefs, type ReminderPrefs } from "./reminderPlan";

/**
 * The member's reminder choices, on this device: the bell's window writes
 * them, the reminders read them (ReminderEngine). The key is the one the
 * choices were always kept under, so nobody's choices are lost.
 */
const KEY = "shul-notification-preferences-v1";
const listeners = new Set<() => void>();
let current: ReminderPrefs | null = null;

function read(): ReminderPrefs {
  if (current) return current;
  try {
    current = normalizeReminderPrefs(JSON.parse(localStorage.getItem(KEY) ?? "{}"));
  } catch {
    current = { ...DEFAULT_REMINDER_PREFS };
  }
  return current;
}

export function getReminderPrefs(): ReminderPrefs {
  return read();
}

export function setReminderPrefs(change: Partial<ReminderPrefs> | ((p: ReminderPrefs) => ReminderPrefs)): void {
  const prev = read();
  current = normalizeReminderPrefs(typeof change === "function" ? change(prev) : { ...prev, ...change });
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* private mode: kept for this visit */
  }
  listeners.forEach((l) => l());
}

export function useReminderPrefs(): ReminderPrefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    read,
  );
}
