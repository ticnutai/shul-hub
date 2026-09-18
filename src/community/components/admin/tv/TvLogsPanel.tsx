import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNow } from "@community/lib/realtime";
import { formatDuration, OUTAGE_REASON_LABELS, type OutageReason } from "@/tv/device";
import { deviceHealth, useTvDevices, useTvEvents, type TvDevice, type TvEvent } from "./tvAdminData";

/**
 * Reports: availability, disconnections with their reason, errors, and the
 * full event log.
 *
 * Where the numbers come from:
 *   - past outages are the `outage` events a TV uploads when it reconnects
 *     (it buffers them while offline, with the reason it diagnosed);
 *   - an outage still in progress cannot be reported by the TV, so it is
 *     derived here from the missing heartbeat: from `last_seen_at` until now.
 */

const PERIODS = [
  { days: 1, label: "24 שעות" },
  { days: 7, label: "7 ימים" },
  { days: 30, label: "30 ימים" },
];

const KIND_LABELS: Record<string, string> = {
  boot: "הפעלה",
  outage: "ניתוק",
  "js-error": "שגיאת תוכנה",
  command: "פקודה",
  snapshot: "צילום מסך",
  paired: "צימוד",
};

interface Outage {
  deviceId: string;
  from: Date;
  to: Date | null;
  durationMs: number;
  reasons: OutageReason[];
  attempts?: number;
  ongoing: boolean;
}

function outagesFor(device: TvDevice, events: TvEvent[], now: number): Outage[] {
  const list: Outage[] = events
    .filter((e) => e.device_id === device.id && e.kind === "outage")
    .map((e) => {
      const to = e.details.to ? new Date(e.details.to) : new Date(e.occurred_at);
      const durationMs = Number(e.details.durationMs) || 0;
      return {
        deviceId: device.id,
        from: e.details.from ? new Date(e.details.from) : new Date(to.getTime() - durationMs),
        to,
        durationMs,
        reasons: (e.details.reasons ?? []) as OutageReason[],
        attempts: e.details.attempts,
        ongoing: false,
      };
    });
  const health = deviceHealth(device, now);
  if (!health.online && health.lastSeen) {
    list.unshift({
      deviceId: device.id,
      from: health.lastSeen,
      to: null,
      durationMs: now - health.lastSeen.getTime(),
      reasons: [],
      ongoing: true,
    });
  }
  return list.sort((a, b) => b.from.getTime() - a.from.getTime());
}

export function TvLogsPanel() {
  const [days, setDays] = useState(7);
  const devices = useTvDevices();
  const events = useTvEvents(days);
  const now = useNow(30_000).getTime();
  const approved = useMemo(() => (devices.data ?? []).filter((d) => d.approved), [devices.data]);
  const [deviceFilter, setDeviceFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<"all" | "warn" | "error">("all");

  const all = useMemo(() => events.data ?? [], [events.data]);
  const periodMs = days * 86_400_000;
  const windowStart = now - periodMs;

  const perDevice = useMemo(
    () =>
      approved.map((d) => {
        const outages = outagesFor(d, all, now);
        // Downtime clipped to the selected window; a device paired recently is
        // measured from when it was paired, not charged for time before it existed.
        const since = Math.max(windowStart, new Date(d.approved_at ?? d.created_at).getTime());
        const downtime = outages.reduce((sum, o) => {
          const start = Math.max(o.from.getTime(), since);
          const end = o.to ? o.to.getTime() : now;
          return sum + Math.max(0, end - start);
        }, 0);
        const measured = Math.max(1, now - since);
        const errors = all.filter((e) => e.device_id === d.id && e.level === "error");
        return { device: d, outages, downtime, uptime: Math.max(0, 1 - downtime / measured), errors };
      }),
    [approved, all, now, windowStart],
  );

  const visible = all.filter(
    (e) =>
      (deviceFilter === "all" || e.device_id === deviceFilter) &&
      (levelFilter === "all" || (levelFilter === "warn" ? e.level !== "info" : e.level === "error")),
  );
  const nameOf = (id: string) => (devices.data ?? []).find((d) => d.id === id)?.name ?? "מסך שהוסר";

  const exportCsv = () => {
    const rows = [["זמן", "מסך", "רמה", "סוג", "הודעה", "פרטים"]];
    for (const e of visible)
      rows.push([new Date(e.occurred_at).toLocaleString("he-IL"), nameOf(e.device_id), e.level, e.kind, e.message, JSON.stringify(e.details)]);
    // Byte-order mark so Excel opens the Hebrew as UTF-8.
    const csv = String.fromCharCode(0xfeff) + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `tv-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">תקופה:</span>
        {PERIODS.map((p) => (
          <Button key={p.days} type="button" size="sm" variant={days === p.days ? "default" : "outline"} onClick={() => setDays(p.days)}>
            {p.label}
          </Button>
        ))}
      </div>

      {events.error && <p className="text-destructive">לא ניתן לטעון את היומן.</p>}

      <div className="grid gap-3 md:grid-cols-2">
        {perDevice.map(({ device, outages, downtime, uptime, errors }) => {
          const health = deviceHealth(device, now);
          return (
            <section key={device.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2">
                {health.online ? <CheckCircle2 className="size-5 text-emerald-500" /> : <WifiOff className="size-5 text-red-500" />}
                <h3 className="font-semibold">{device.name}</h3>
                <span className="ms-auto text-2xl font-bold tabular-nums">{(uptime * 100).toFixed(uptime > 0.999 ? 1 : 2)}%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                זמינות ב{PERIODS.find((p) => p.days === days)?.label} · {outages.length} ניתוקים · סה״כ {formatDuration(downtime)} ·{" "}
                {errors.length} שגיאות
              </p>
            </section>
          );
        })}
      </div>

      <section className="rounded-xl border bg-card shadow-sm">
        <h3 className="border-b p-4 text-base font-semibold">ניתוקים</h3>
        {perDevice.every((p) => p.outages.length === 0) ? (
          <p className="p-4 text-sm text-muted-foreground">אין ניתוקים בתקופה הזו.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-right text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">מסך</th>
                  <th className="px-4 py-2 font-medium">מתי</th>
                  <th className="px-4 py-2 font-medium">משך</th>
                  <th className="px-4 py-2 font-medium">סיבה</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {perDevice
                  .flatMap((p) => p.outages)
                  .sort((a, b) => b.from.getTime() - a.from.getTime())
                  .map((o, i) => (
                    <tr key={i} className={o.ongoing ? "bg-red-50 dark:bg-red-950/30" : ""}>
                      <td className="px-4 py-2">{nameOf(o.deviceId)}</td>
                      <td className="px-4 py-2 tabular-nums">
                        {o.from.toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}
                        {o.to ? ` – ${o.to.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}` : ""}
                      </td>
                      <td className="px-4 py-2 tabular-nums">
                        {formatDuration(o.durationMs)}
                        {o.ongoing && <Badge variant="destructive" className="ms-2">עדיין מנותק</Badge>}
                      </td>
                      <td className="px-4 py-2">
                        {o.ongoing
                          ? "המסך לא מדווח. הסיבה תיקבע כשיחזור (הוא שומר יומן בזמן הניתוק)."
                          : o.reasons.length
                            ? o.reasons.map((r) => OUTAGE_REASON_LABELS[r] ?? r).join(" ← ")
                            : "לא ידוע"}
                        {o.attempts ? <span className="text-xs text-muted-foreground"> · {o.attempts} ניסיונות התחברות</span> : null}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b p-4">
          <h3 className="text-base font-semibold">יומן אירועים</h3>
          <select
            aria-label="סינון לפי מסך"
            value={deviceFilter}
            onChange={(e) => setDeviceFilter(e.target.value)}
            className="ms-auto h-8 rounded-md border bg-background px-2 text-sm"
          >
            <option value="all">כל המסכים</option>
            {(devices.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            aria-label="סינון לפי חומרה"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as typeof levelFilter)}
            className="h-8 rounded-md border bg-background px-2 text-sm"
          >
            <option value="all">הכל</option>
            <option value="warn">אזהרות ושגיאות</option>
            <option value="error">שגיאות בלבד</option>
          </select>
          <Button type="button" variant="outline" size="sm" onClick={exportCsv} disabled={!visible.length}>
            <Download className="size-4" /> ייצוא CSV
          </Button>
        </div>
        {events.isLoading ? (
          <p className="p-4 text-muted-foreground">טוען…</p>
        ) : visible.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">אין אירועים להצגה.</p>
        ) : (
          <ul className="max-h-[32rem] divide-y overflow-y-auto">
            {visible.slice(0, 500).map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2 text-sm">
                <span className="w-32 shrink-0 tabular-nums text-muted-foreground">
                  {new Date(e.occurred_at).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                {e.level === "error" ? (
                  <Badge variant="destructive">שגיאה</Badge>
                ) : e.level === "warn" ? (
                  <Badge className="bg-amber-500 hover:bg-amber-500">
                    <AlertTriangle className="me-1 size-3" />
                    אזהרה
                  </Badge>
                ) : (
                  <Badge variant="secondary">{KIND_LABELS[e.kind] ?? e.kind}</Badge>
                )}
                <span className="text-muted-foreground">{nameOf(e.device_id)}</span>
                <span className="min-w-0 flex-1">{e.message}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
