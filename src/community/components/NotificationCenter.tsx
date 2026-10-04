import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
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
import { useMinyanim, useShiurim } from "@community/lib/data";
import { setReminderPrefs, useReminderPrefs } from "@community/lib/reminderPrefsStore";
import { playChime, showSystemNotification } from "@community/lib/notify";
import { hasShulAlarm, ShulAlarm } from "@community/lib/shulAlarm";

const native = Capacitor.isNativePlatform();

/**
 * What the phone allows the app: reminders on the minute (Android 12 and up
 * asks for it), and the whole-screen ring (Android 14 and up). Null in a
 * browser, or before it is known.
 */
function usePhoneAllows(open: boolean) {
  const [allows, setAllows] = useState<{ exact: boolean; fullScreen: boolean } | null>(null);
  const refresh = useCallback(async () => {
    if (!native) return;
    try {
      if (hasShulAlarm()) setAllows(await ShulAlarm.status());
      else {
        const exact = await LocalNotifications.checkExactNotificationSetting();
        setAllows({ exact: exact.exact_alarm === "granted", fullScreen: false });
      }
    } catch {
      setAllows(null);
    }
  }, []);
  useEffect(() => {
    if (!open) return;
    void refresh();
    // Back from the phone's settings: look again.
    const again = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", again);
    return () => document.removeEventListener("visibilitychange", again);
  }, [open, refresh]);
  return allows;
}

export function NotificationCenter() {
  const { data: minyanim = [] } = useMinyanim();
  const { data: shiurim = [] } = useShiurim();
  const preferences = useReminderPrefs();
  const setPreferences = setReminderPrefs;
  const [open, setOpen] = useState(false);
  const allows = usePhoneAllows(open);
  const availableMinyanim = minyanim.filter((item) => item.active && item.notification_enabled);
  const availableShiurim = shiurim.filter((item) => item.active && item.notification_enabled);

  async function toggleEnabled(enabled: boolean) {
    setPreferences((current) => ({ ...current, enabled }));
    if (!enabled) return;

    if (native) {
      try {
        const now = await LocalNotifications.checkPermissions();
        const granted =
          now.display === "granted" || (await LocalNotifications.requestPermissions()).display === "granted";
        if (granted) toast.success("ההתראות הופעלו", { description: "התזכורות יגיעו גם כשהאפליקציה סגורה." });
        else
          toast.info("ההתראות חסומות בטלפון", {
            description: "אפשר לאשר אותן בהגדרות הטלפון ← אפליקציות ← התראות.",
          });
      } catch {
        toast.info("ההתראות הופעלו בתוך האפליקציה");
      }
      return;
    }

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

  /** As a reminder comes: on the phone's notifications (or the page), with its sound. */
  async function tryIt() {
    if (preferences.sound) playChime();
    const ok = await showSystemNotification("בדיקה: מנחה 13:30", "בעוד 10 דקות · כך תיראה תזכורת", "shul-test", "minyan");
    if (!ok) toast("בדיקה: מנחה 13:30", { description: "בעוד 10 דקות · כך תיראה תזכורת (בתוך האתר)" });
  }

  async function allowExact() {
    try {
      if (hasShulAlarm()) await ShulAlarm.openExactSettings();
      else await LocalNotifications.changeExactNotificationSetting();
    } catch {
      toast.info("אפשר לאשר בהגדרות הטלפון ← אפליקציות ← הרשאות מיוחדות ← שעונים מעוררים ותזכורות");
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="הגדרות התראות"
          /* The same gold as ב״ה on the other side of the header: with the
             other icons gone it is one of two marks on that line, and the two
             should look like a pair rather than one shouting. */
          className="text-sidebar-primary hover:bg-sidebar-accent hover:text-gold"
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
            אפשר לבחור סוגי התראות וגם מניין או שיעור מסוים. רשימה ריקה פירושה לקבל את כולם. בשבת ובחג אין התראות.
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
        {preferences.enabled && (
          <section className="space-y-3 rounded-xl border p-3" data-testid="reminder-how">
            <div className="flex items-center justify-between">
              <Label htmlFor="notifications-sound">צליל עם כל התראה</Label>
              <Switch
                id="notifications-sound"
                checked={preferences.sound}
                onCheckedChange={(sound) => setPreferences((current) => ({ ...current, sound }))}
              />
            </div>
            {hasShulAlarm() && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="notifications-alarm">מניין מצלצל כמו שעון מעורר</Label>
                  <Switch
                    id="notifications-alarm"
                    checked={preferences.alarm}
                    onCheckedChange={(alarm) => setPreferences((current) => ({ ...current, alarm }))}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  על כל המסך, גם כשהטלפון נעול, עד שלוחצים "עצירה". לא בשבת ובחג.
                </p>
                {preferences.alarm && allows && !allows.fullScreen && (
                  <Button type="button" size="sm" variant="outline" onClick={() => void ShulAlarm.openFullScreenSettings()}>
                    לאשר צלצול על כל המסך
                  </Button>
                )}
              </div>
            )}
            {native && allows && !allows.exact && (
              <div className="space-y-1 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                <p>הטלפון עלול לאחר תזכורות בכמה דקות. כדי שיגיעו בדיוק בזמן:</p>
                <Button type="button" size="sm" variant="outline" onClick={() => void allowExact()}>
                  לאשר תזכורות בדיוק בזמן
                </Button>
              </div>
            )}
            {!native && (
              <p className="text-xs text-muted-foreground">
                באתר התזכורות מגיעות כל עוד האתר פתוח. כדי לקבל אותן גם כשהוא סגור - באפליקציה.
              </p>
            )}
            <Button type="button" size="sm" variant="secondary" onClick={() => void tryIt()}>
              לנסות: כך תיראה תזכורת
            </Button>
          </section>
        )}
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
