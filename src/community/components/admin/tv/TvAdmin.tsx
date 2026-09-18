import { useSearchParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNow } from "@community/lib/realtime";
import { formatDuration } from "@/tv/device";
import { TvDesignPanel } from "./TvDesignPanel";
import { TvDevicesPanel } from "./TvDevicesPanel";
import { TvLogsPanel } from "./TvLogsPanel";
import { deviceHealth, useTvDevices } from "./tvAdminData";

/**
 * "לוח תצוגה" admin tab: screens (live mirror + remote), design (live editor)
 * and reports. The sub-tab is kept in the URL (?tvTab=) so an alert can link
 * straight to the log.
 */
export default function TvAdmin() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tvTab") ?? "screens";
  const devices = useTvDevices();
  const now = useNow(15_000).getTime();
  const offline = (devices.data ?? []).filter((d) => d.approved && !deviceHealth(d, now).online);

  return (
    <div className="space-y-4">
      {offline.map((d) => {
        const h = deviceHealth(d, now);
        return (
          <div key={d.id} role="alert" className="flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
            <AlertTriangle className="size-5 shrink-0" />
            <span>
              <b>{d.name}</b> מנותק{h.silentMs ? ` כבר ${formatDuration(h.silentMs)}` : ""}. הסיבה תופיע ביומן כשהמסך יחזור (הוא שומר
              יומן בזמן הניתוק). אם זה נמשך: בדקו חשמל, Wi-Fi וראוטר.
            </span>
          </div>
        );
      })}

      <Tabs
        dir="rtl"
        value={tab}
        onValueChange={(t) => {
          const next = new URLSearchParams(params);
          next.set("tvTab", t);
          setParams(next, { replace: true });
        }}
      >
        <TabsList>
          <TabsTrigger value="screens">מסכים ושליטה</TabsTrigger>
          <TabsTrigger value="design">עיצוב ופריסה (עורך חי)</TabsTrigger>
          <TabsTrigger value="logs">דוחות ויומן{offline.length ? ` (${offline.length}!)` : ""}</TabsTrigger>
        </TabsList>
        <TabsContent value="screens" className="mt-5">
          <TvDevicesPanel />
        </TabsContent>
        <TabsContent value="design" className="mt-5">
          <TvDesignPanel />
        </TabsContent>
        <TabsContent value="logs" className="mt-5">
          <TvLogsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
