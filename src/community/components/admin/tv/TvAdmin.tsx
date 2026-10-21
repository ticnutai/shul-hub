import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PATH_BESIDE_ID } from "../adminPath";
import { ChevronDown, MonitorX } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNow } from "@community/lib/realtime";
import { formatDuration } from "@/tv/device";
import { TvDesignPanel } from "./TvDesignPanel";
import { TvDevicesPanel } from "./TvDevicesPanel";
import { TvLogsPanel } from "./TvLogsPanel";
import { deviceHealth, useTvDevices } from "./tvAdminData";
import { noticeClass } from "./Notice";
import { useEditorPrefsSync } from "./editorPrefs";

/**
 * "לוח תצוגה" admin tab: screens (live mirror + remote), design (live editor)
 * and reports. The sub-tab is kept in the URL (?tvTab=) so an alert can link
 * straight to the log.
 */
export default function TvAdmin() {
  const [params, setParams] = useSearchParams();
  // Lands on the displays, because that is what the tab is called and what
  // it is for. "מסכים מחוברים" is about the boxes on the walls - a different
  // question, asked far less often, and one that has its own alert above.
  // "מועדים ואירועים" was a tab of its own; it is the board editor's "מועדים" now.
  const tab = params.get("tvTab") === "events" ? "design" : params.get("tvTab") ?? "design";
  // How the editor looks to this gabbai, kept with the account - the same on every computer (editorPrefs.ts).
  useEditorPrefsSync();
  const devices = useTvDevices();
  const now = useNow(15_000).getTime();
  const offline = (devices.data ?? []).filter((d) => d.approved && !deviceHealth(d, now).online);

  return (
    <div className="space-y-4">
      {offline.length > 0 && <OfflineAlert offline={offline} now={now} />}

      <Tabs
        dir="rtl"
        value={tab}
        onValueChange={(t) => {
          const next = new URLSearchParams(params);
          next.set("tvTab", t);
          setParams(next, { replace: true });
        }}
      >
        <TabsList
          data-focus-hide
          className="grid h-auto w-full grid-cols-1 gap-1 px-1 py-1.5 text-right sm:flex sm:flex-wrap"
        >
          <TabsTrigger value="design">התצוגות והעיצוב</TabsTrigger>
          <TabsTrigger value="screens">מסכים מחוברים</TabsTrigger>
          <TabsTrigger value="logs">דוחות ויומן{offline.length ? ` (${offline.length} מנותקים)` : ""}</TabsTrigger>
        </TabsList>
        <TabsContent value="screens" className="mt-5">
          <TvDevicesPanel />
        </TabsContent>
        <TabsContent value="design" className="mt-5" data-focus-tight>
          <TvDesignPanel />
        </TabsContent>
        <TabsContent value="logs" className="mt-5">
          <TvLogsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const OPEN_KEY = "tv-admin.offline-open";

/**
 * The screens that went silent: one short line, the details opened from it.
 * A full red box for each took a third of the editor (אושר של יהודי, 11.10.2026);
 * the line stays, so a screen that went down is never missed.
 */
function OfflineAlert({ offline, now }: { offline: ReturnType<typeof useTvDevices>["data"] & object; now: number }) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(OPEN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggle = () => {
    setOpen((v) => {
      try {
        localStorage.setItem(OPEN_KEY, v ? "0" : "1");
      } catch {
        /* a private window: it opens closed next time */
      }
      return !v;
    });
  };
  // Beside the steps ("חזרה › ראשי › תצוגות"), on their line, when the tiles show them; else where it stands.
  const [beside, setBeside] = useState<HTMLElement | null>(null);
  useEffect(() => setBeside(document.getElementById(PATH_BESIDE_ID)), []);
  const alert = (
    <div role="alert" data-focus-hide data-testid="offline-alert" className={noticeClass("error")}>
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2 text-right">
        <MonitorX className="size-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
        <span className="min-w-0 flex-1 truncate">
          <b>{offline.length === 1 ? "מסך אחד מנותק" : `${offline.length} מסכים מנותקים`}</b>: {offline.map((d) => d.name).join(", ")}
        </span>
        <span className="shrink-0 text-xs underline">{open ? "הסתרת הפרטים" : "פרטים"}</span>
        <ChevronDown className={`size-4 shrink-0 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <ul className="space-y-1 border-t border-red-200 p-3 dark:border-red-900">
          {offline.map((d) => {
            const h = deviceHealth(d, now);
            return (
              <li key={d.id}>
                <b>{d.name}</b> מנותק{h.silentMs ? ` כבר ${formatDuration(h.silentMs)}` : ""}.
              </li>
            );
          })}
          <li className="text-xs">הסיבה תופיע ביומן כשהמסך יחזור (הוא שומר יומן בזמן הניתוק). אם זה נמשך: בדקו חשמל, רשת אלחוטית וראוטר.</li>
        </ul>
      )}
    </div>
  );
  return beside ? createPortal(alert, beside) : alert;
}
