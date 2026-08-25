import { useState, useEffect, useCallback } from "react";
import * as webPushService from "@/services/webPushService";
import type { ServerReminder } from "@/services/webPushService";

/* ─── Types ─────────────────────────────────────────────── */

export type { ServerReminder as PushReminder };

export type WebPushState = "unsupported" | "prompt" | "granted" | "denied" | "subscribed";

/* ─── Hook ──────────────────────────────────────────────── */

export function useWebPush() {
  const [state, setState] = useState<WebPushState>("unsupported");
  const [loading, setLoading] = useState(false);

  const isSupported = webPushService.isWebPushSupported();

  /* ── Init and check existing subscription ────────────── */
  useEffect(() => {
    if (!isSupported) {
      setState("unsupported");
      return;
    }
    webPushService.init().then(() => {
      if (webPushService.isSubscribed()) {
        setState("subscribed");
      } else {
        setState(Notification.permission === "denied" ? "denied" : "prompt");
      }
    });
  }, [isSupported]);

  /* ── Subscribe to push ───────────────────────────────── */
  const subscribe = useCallback(
    async (reminders: ServerReminder[] = []) => {
      setLoading(true);
      try {
        const sub = await webPushService.ensureSubscribed();
        if (!sub) {
          setState("denied");
          return null;
        }
        setState("subscribed");
        if (reminders.length > 0) {
          await webPushService.syncReminders(reminders);
        }
        return sub;
      } catch (err) {
        console.error("Push subscribe failed:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /* ── Unsubscribe ─────────────────────────────────────── */
  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      await webPushService.unsubscribe();
      setState("prompt");
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── Sync reminders to server ────────────────────────── */
  const syncReminders = useCallback(
    async (reminders: ServerReminder[]) => {
      await webPushService.syncReminders(reminders);
    },
    [],
  );

  /* ── Send test push via server ───────────────────────── */
  const sendTestPush = useCallback(async () => {
    if (!webPushService.isSubscribed()) return;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase.functions.invoke("send-push", { body: { test: true } });
    } catch (err) {
      console.error("Test push failed:", err);
    }
  }, []);

  return {
    state,
    isSupported,
    subscription: webPushService.isSubscribed(),
    loading,
    subscribe,
    unsubscribe,
    syncReminders,
    sendTestPush,
  };
}
