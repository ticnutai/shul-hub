import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@community/lib/use-auth";
import { TvApp } from "@/tv/TvApp";
import { TvDesignPanel } from "@community/components/admin/tv/TvDesignPanel";
import { useTvFonts } from "@community/components/admin/tv/tvFonts";

/**
 * The wall board, full screen in a browser - for an admin who wants to see it
 * at real size on a laptop, a desktop monitor, a tablet or a phone, or to use
 * a computer as a display. Admin only.
 *
 *   /admin/tv-board          the saved design, exactly what the TVs show
 *   /admin/tv-board?draft=1  the live editor: the board on the whole screen
 *                            with every design control in a floating panel.
 *                            Its unsaved draft stays in step with an editor
 *                            open on the admin page (tvDraftChannel).
 *
 * It does not register as a screen, so it never appears as an unpaired TV
 * and does not affect the uptime reports.
 */
export default function TvBoardPage() {
  const { session, isAdmin, loading } = useAuth();
  const [params] = useSearchParams();
  const studio = params.get("draft") === "1" || params.get("live") === "1";

  // useAuth reports "not admin" for one render before the role check starts;
  // give it a moment so an admin does not see a flash of "no permission".
  const [graceOver, setGraceOver] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setGraceOver(true), 1500);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const previous = document.title;
    document.title = studio ? "עורך חי — לוח התצוגה" : "לוח תצוגה — בית הכנסת";
    return () => {
      document.title = previous;
    };
  }, [studio]);

  useScreenWakeLock(isAdmin);
  useTvFonts();

  if (isAdmin) {
    if (studio) {
      return (
        <div dir="rtl">
          <TvDesignPanel studio />
        </div>
      );
    }
    return (
      <div className="fixed inset-0 z-[60] bg-black" dir="rtl">
        <TvApp mode="web" exitHref="/community/admin?tab=tv&tvTab=design" />
      </div>
    );
  }

  if (loading || (session && !graceOver)) {
    return <div className="flex min-h-dvh items-center justify-center text-muted-foreground">טוען…</div>;
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-6" dir="rtl">
      <div className="card-elev flex max-w-md items-start gap-3 p-6">
        <ShieldAlert className="size-5 shrink-0 text-destructive" />
        <div>
          <p className="font-medium">תצוגת הלוח בדפדפן זמינה למנהלים בלבד</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {session ? "החשבון המחובר אינו מנהל." : "יש להתחבר עם חשבון מנהל."}
          </p>
          <Link to={session ? "/community" : "/auth"} className="mt-3 inline-block text-sm font-medium text-primary underline">
            {session ? "חזרה לאתר" : "התחברות"}
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Keeps a laptop or monitor used as a display from sleeping. */
function useScreenWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        const l = await navigator.wakeLock.request("screen");
        if (cancelled) void l.release();
        else lock = l;
      } catch {
        /* denied or unsupported */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };
    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}
