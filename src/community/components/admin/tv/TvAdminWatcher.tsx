import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MonitorX, X } from "lucide-react";
import { useAuth } from "@community/lib/use-auth";
import { useNow } from "@community/lib/realtime";
import { formatDuration } from "@/tv/device";
import { deviceHealth, tvDb, useTvDevices, type TvEvent } from "./tvAdminData";

/**
 * Site-wide alerts for administrators: a screen went offline, or reported an
 * error. Mounted once at the app root; renders nothing for anyone else and
 * does not even query (the tables are admin-only under RLS).
 *
 * Delivery is in-site (toast + a persistent chip until the screen is back).
 * Push to a phone would need a server-side sender, which this project does
 * not have yet.
 */
export default function TvAdminWatcher() {
  const { isAdmin } = useAuth();
  return isAdmin ? <Watcher /> : null;
}

function Watcher() {
  const devices = useTvDevices();
  const now = useNow(15_000).getTime();
  const navigate = useNavigate();
  const location = useLocation();
  const offline = (devices.data ?? []).filter((d) => d.approved && !deviceHealth(d, now).online);
  const offlineKey = offline.map((d) => d.id).sort().join(",");
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  // Toast only on a change during this visit - not for a screen that was
  // already offline when the admin opened the site (the chip covers that).
  const previous = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!devices.data) return;
    const current = new Set(offline.map((d) => d.id));
    if (previous.current) {
      for (const d of offline)
        if (!previous.current.has(d.id))
          toast.warning(`המסך "${d.name}" התנתק`, {
            description: "לא התקבל ממנו דיווח בשתי הדקות וחצי האחרונות.",
            action: { label: "פתח יומן", onClick: () => navigate("/community/admin?tab=tv&tvTab=logs") },
            duration: 15_000,
          });
      for (const id of previous.current)
        if (!current.has(id)) {
          const d = devices.data.find((x) => x.id === id);
          if (d) toast.success(`המסך "${d.name}" חזר לפעול`);
        }
    }
    previous.current = current;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to the set of offline screens only
  }, [offlineKey, devices.data]);

  // Errors reported by a screen (JS errors, failed snapshots), as they arrive.
  // The device list is read through a ref: depending on it re-subscribed on
  // every heartbeat of every TV, and errors arriving in the gap were lost.
  const devicesRef = useRef(devices.data);
  devicesRef.current = devices.data;
  useEffect(() => {
    const channel = tvDb
      .channel(`tv-admin-alerts-${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tv_events" }, (p) => {
        const e = p.new as TvEvent;
        if (e.level !== "error") return;
        // Only paired screens: anyone with the public key can register a
        // "screen", and its text must not reach admins as an alert.
        const device = devicesRef.current?.find((d) => d.id === e.device_id);
        if (!device?.approved) return;
        const name = device.name;
        toast.error(`שגיאה ב"${name}"`, {
          description: e.message,
          action: { label: "פתח יומן", onClick: () => navigate("/community/admin?tab=tv&tvTab=logs") },
        });
      })
      .subscribe();
    return () => {
      void tvDb.removeChannel(channel);
    };
  }, [navigate]);

  const onTvAdmin = location.pathname === "/community/admin" && new URLSearchParams(location.search).get("tab") === "tv";
  if (!offline.length || onTvAdmin || dismissedKey === offlineKey) return null;

  const first = offline[0];
  const silent = deviceHealth(first, now).silentMs;
  return (
    <div
      role="status"
      dir="rtl"
      className="fixed bottom-4 left-4 z-[60] flex max-w-xs items-center gap-2 rounded-full border border-red-300 bg-red-50 py-2 pe-2 ps-4 text-sm text-red-900 shadow-lg dark:border-red-900 dark:bg-red-950 dark:text-red-100"
    >
      <button type="button" className="flex items-center gap-2 text-right" onClick={() => navigate("/community/admin?tab=tv&tvTab=logs")}>
        <MonitorX className="size-4 shrink-0" />
        <span>
          {offline.length === 1 ? `"${first.name}" מנותק` : `${offline.length} מסכים מנותקים`}
          {silent ? ` · ${formatDuration(silent)}` : ""}
        </span>
      </button>
      <button type="button" aria-label="הסתרה עד השינוי הבא" className="rounded-full p-1 hover:bg-red-100 dark:hover:bg-red-900" onClick={() => setDismissedKey(offlineKey)}>
        <X className="size-3.5" />
      </button>
    </div>
  );
}
