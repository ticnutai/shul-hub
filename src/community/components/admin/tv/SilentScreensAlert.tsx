/**
 * A screen nobody has heard from, said where somebody will see it.
 *
 * The device panel has always known this - a red dot and "לא דיווח" next to
 * the screen's name. The trouble is that it only says it inside that panel,
 * and nobody opens a panel to be told that everything is fine. So a board went
 * dark on shabbat afternoon and was found on Sunday evening, not because the
 * system did not know but because it had nowhere to say it.
 *
 * This sits at the top of the whole management page, on every tab. It appears
 * only when a paired screen has been silent for half an hour - past a router
 * reboot, past a Wi-Fi hiccup, past the board reloading itself - which is the
 * point at which it is off, or on a dead network, or its app is gone, and none
 * of those fix themselves quietly.
 *
 * It says what to do, because "a screen is down" is not actionable at the
 * moment somebody reads it on a phone.
 */
import { Link } from "react-router-dom";
import { MonitorX } from "lucide-react";

import { useNow } from "@community/lib/realtime";
import { formatDuration } from "@/tv/device";
import { silentScreens, useTvDevices } from "./tvAdminData";

export function SilentScreensAlert() {
  const { data: devices = [] } = useTvDevices();
  // Once a minute: this is a half-hour threshold, not a clock.
  const now = useNow(60_000);
  const silent = silentScreens(devices, now.getTime());
  if (silent.length === 0) return null;

  return (
    <section
      dir="rtl"
      role="status"
      data-testid="silent-screens-alert"
      className="mt-4 rounded-lg border border-amber-400/50 bg-amber-50 p-3 text-right dark:bg-amber-950/40 sm:p-4"
    >
      <div className="flex items-start gap-2.5">
        <MonitorX className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {silent.length === 1 ? "מסך אחד לא מדווח" : `${silent.length} מסכים לא מדווחים`}
          </h2>
          <ul className="mt-1 space-y-0.5 text-sm text-amber-900/90 dark:text-amber-200/90">
            {silent.map(({ device, silentMs, lastSeen }) => (
              <li key={device.id}>
                <span className="font-medium">{device.name || "מסך ללא שם"}</span>
                {" · "}
                שקט {formatDuration(silentMs ?? 0)}
                {lastSeen && (
                  <span className="text-amber-900/70 dark:text-amber-200/70">
                    {" · "}
                    דיווח אחרון{" "}
                    {lastSeen.toLocaleString("he-IL", {
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Asia/Jerusalem",
                    })}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] leading-relaxed text-amber-900/75 dark:text-amber-200/75">
            הלוח ממשיך להציג את מה שיש לו גם בלי רשת, אז מסך שקט לא בהכרח מסך ריק. כדאי לבדוק
            שהקופסה דולקת ושיש לה אינטרנט; אם היא דולקת ועדיין שקט, כיבוי והדלקה מחזירים אותה.{" "}
            <Link to="/community/admin?tab=tv&tvTab=devices" className="underline">
              רשימת המסכים
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
