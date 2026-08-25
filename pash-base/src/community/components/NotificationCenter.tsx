import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAnnouncements, useChavrutot, useMinyanim, useSettings, useShiurim } from "@community/lib/data";
import { resolveMinyan, zmanimFor } from "@community/lib/minyan-time";

type Preferences = {
  enabled: boolean;
  minyanim: boolean;
  shiurim: boolean;
  announcements: boolean;
  chavrutot: boolean;
  selectedMinyanIds: string[];
  selectedShiurIds: string[];
};

const STORAGE_KEY = "shul-notification-preferences-v1";
const defaults: Preferences = {
  enabled: false,
  minyanim: true,
  shiurim: true,
  announcements: true,
  chavrutot: false,
  selectedMinyanIds: [],
  selectedShiurIds: [],
};

function loadPreferences(): Preferences {
  if (typeof window === "undefined") return defaults;
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") };
  } catch {
    return defaults;
  }
}

function deliverNotification(title: string, body: string) {
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico", dir: "rtl", lang: "he" });
    return;
  }
  toast(title, { description: body, duration: 8000 });
}

export function NotificationCenter() {
  const { data: minyanim = [] } = useMinyanim();
  const { data: shiurim = [] } = useShiurim();
  const { data: settings } = useSettings();
  const { data: announcements = [] } = useAnnouncements();
  const { data: chavrutot = [] } = useChavrutot();
  const [preferences, setPreferences] = useState(loadPreferences);
  const availableMinyanim = minyanim.filter((item) => item.active && item.notification_enabled);
  const availableShiurim = shiurim.filter((item) => item.active && item.notification_enabled);

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)), [preferences]);

  useEffect(() => {
    if (!preferences.enabled) return;
    const showNew = (
      type: string,
      enabled: boolean,
      items: Array<{ id: string; title: string; body: string }>,
    ) => {
      const key = `shul-known-${type}-v1`;
      const known = new Set<string>(JSON.parse(localStorage.getItem(key) ?? "[]"));
      if (known.size > 0 && enabled) {
        items
          .filter((item) => !known.has(item.id))
          .forEach((item) => deliverNotification(item.title, item.body));
      }
      localStorage.setItem(key, JSON.stringify(items.map((item) => item.id)));
    };
    showNew(
      "announcements",
      preferences.announcements,
      announcements
        .filter((item) => item.notification_enabled)
        .map((item) => ({ id: item.id, title: item.title, body: item.body })),
    );
    showNew(
      "chavrutot",
      preferences.chavrutot,
      chavrutot
        .filter((item) => item.notification_enabled)
        .map((item) => ({ id: item.id, title: `חברותא: ${item.topic}`, body: item.time_text })),
    );
  }, [
    announcements,
    chavrutot,
    preferences.announcements,
    preferences.chavrutot,
    preferences.enabled,
  ]);

  const schedule = useMemo(
    () => ({ minyanim: availableMinyanim, shiurim: availableShiurim, settings }),
    [availableMinyanim, availableShiurim, settings],
  );

  useEffect(() => {
    if (!preferences.enabled) return;
    const check = () => {
      const now = new Date();
      const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      const notify = (key: string, title: string, body: string) => {
        const storageKey = `shul-notified-${today}-${key}`;
        if (sessionStorage.getItem(storageKey)) return;
        sessionStorage.setItem(storageKey, "1");
        deliverNotification(title, body);
      };
      const due = (time: string, minutes: number) => {
        const match = time.match(/^(\d{1,2}):(\d{2})/);
        if (!match) return false;
        const event = new Date(now);
        event.setHours(Number(match[1]), Number(match[2]), 0, 0);
        const difference = (event.getTime() - now.getTime()) / 60000;
        return difference >= 0 && difference < Math.max(1, minutes);
      };
      if (preferences.minyanim) {
        const zmanim = zmanimFor(now, schedule.settings);
        schedule.minyanim
          .filter(
            (item) =>
              preferences.selectedMinyanIds.length === 0 ||
              preferences.selectedMinyanIds.includes(item.id),
          )
          .forEach((item) => {
            const resolved = resolveMinyan(item, zmanim);
            if (resolved && due(resolved.time, item.reminder_minutes))
              notify(
                `minyan-${item.id}`,
                `תזכורת: ${item.label}`,
                `${resolved.time}${item.room ? ` · ${item.room}` : ""}`,
              );
          });
      }
      if (preferences.shiurim) {
        schedule.shiurim
          .filter((item) => item.schedule_type === "daily" || item.day_of_week === now.getDay())
          .filter(
            (item) =>
              preferences.selectedShiurIds.length === 0 ||
              preferences.selectedShiurIds.includes(item.id),
          )
          .forEach((item) => {
            if (due(item.time_text, item.reminder_minutes))
              notify(
                `shiur-${item.id}`,
                `תזכורת לשיעור: ${item.title}`,
                `${item.time_text}${item.location ? ` · ${item.location}` : ""}`,
              );
          });
      }
    };
    check();
    const timer = window.setInterval(check, 30_000);
    return () => window.clearInterval(timer);
  }, [preferences, schedule]);

  async function toggleEnabled(enabled: boolean) {
    setPreferences((current) => ({ ...current, enabled }));
    if (!enabled) return;

    if (typeof Notification === "undefined") {
      toast.info("התזכורות הופעלו בתוך האתר", {
        description: "הדפדפן אינו תומך בהתראות מערכת, לכן הן יוצגו כל עוד האתר פתוח.",
      });
      return;
    }

    if (Notification.permission === "granted") {
      toast.success("ההתראות הופעלו");
      return;
    }

    if (Notification.permission === "denied") {
      toast.info("התזכורות הופעלו בתוך האתר", {
        description: "התראות מערכת חסומות בדפדפן. ניתן לאפשר אותן בהגדרות האתר.",
      });
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") toast.success("התראות המערכת הופעלו");
      else
        toast.info("התזכורות הופעלו בתוך האתר", {
          description: "לא ניתנה הרשאת מערכת, לכן הן יוצגו כל עוד האתר פתוח.",
        });
    } catch {
      toast.info("התזכורות הופעלו בתוך האתר", {
        description: "לא ניתן לפתוח הרשאת מערכת בדפדפן הזה.",
      });
    }
  }

  const toggleId = (field: "selectedMinyanIds" | "selectedShiurIds", id: string) =>
    setPreferences((current) => ({
      ...current,
      [field]: current[field].includes(id)
        ? current[field].filter((item) => item !== id)
        : [...current[field], id],
    }));

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="הגדרות התראות"
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-gold"
        >
          <Bell className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent
        dir="rtl"
        className="max-h-[85vh] w-[calc(100%-2rem)] overflow-y-auto text-right sm:max-w-lg"
      >
        <DialogHeader className="text-right">
          <DialogTitle>התראות ותזכורות</DialogTitle>
          <DialogDescription>
            אפשר לבחור סוגי התראות וגם מניין או שיעור מסוים. רשימה ריקה פירושה לקבל את כולם.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between rounded-xl border p-3">
          <Label htmlFor="notifications-enabled">הפעלת התראות</Label>
          <Switch
            id="notifications-enabled"
            checked={preferences.enabled}
            onCheckedChange={toggleEnabled}
          />
        </div>
        <PreferenceGroup
          title="מניינים"
          enabled={preferences.minyanim}
          onEnabled={(value) => setPreferences((current) => ({ ...current, minyanim: value }))}
        >
          {availableMinyanim.map((item) => (
            <Choice
              key={item.id}
              label={item.label}
              checked={preferences.selectedMinyanIds.includes(item.id)}
              onChange={() => toggleId("selectedMinyanIds", item.id)}
            />
          ))}
        </PreferenceGroup>
        <PreferenceGroup
          title="מודעות חדשות"
          enabled={preferences.announcements}
          onEnabled={(value) => setPreferences((current) => ({ ...current, announcements: value }))}
        >
          <p className="text-sm text-muted-foreground">התראה על מודעות שהמנהל סימן.</p>
        </PreferenceGroup>
        <PreferenceGroup
          title="חברותות חדשות"
          enabled={preferences.chavrutot}
          onEnabled={(value) => setPreferences((current) => ({ ...current, chavrutot: value }))}
        >
          <p className="text-sm text-muted-foreground">התראה על הצעות חברותא שהמנהל סימן.</p>
        </PreferenceGroup>
        <PreferenceGroup
          title="שיעורים"
          enabled={preferences.shiurim}
          onEnabled={(value) => setPreferences((current) => ({ ...current, shiurim: value }))}
        >
          {availableShiurim.map((item) => (
            <Choice
              key={item.id}
              label={item.title}
              checked={preferences.selectedShiurIds.includes(item.id)}
              onChange={() => toggleId("selectedShiurIds", item.id)}
            />
          ))}
        </PreferenceGroup>
      </DialogContent>
    </Dialog>
  );
}

function PreferenceGroup({
  title,
  enabled,
  onEnabled,
  children,
}: {
  title: string;
  enabled: boolean;
  onEnabled: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <Switch aria-label={`התראות ${title}`} checked={enabled} onCheckedChange={onEnabled} />
      </div>
      {enabled && <div className="mt-3 grid gap-2">{children}</div>}
    </section>
  );
}

function Choice({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-muted/60 p-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={onChange} />
      {label}
    </label>
  );
}
