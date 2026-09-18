import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@community/lib/use-auth";
import { normalizeTvConfig, type TvConfig } from "@/tv/config";
import { isAllowedEdit } from "@/tv/records";
import { TvApp } from "@/tv/TvApp";
import { TV_DRAFT_CHANNEL, type DraftMessage } from "@community/components/admin/tv/tvDraftChannel";
import { useTvFonts } from "@community/components/admin/tv/tvFonts";

/**
 * The wall board, full screen in a browser - for an admin who wants to see it
 * at real size on a laptop, a desktop monitor, a tablet or a phone, or to use
 * a computer as a display. Admin only.
 *
 *   /admin/tv-board          the saved design, exactly what the TVs show
 *   /admin/tv-board?draft=1  follows the editor's UNSAVED draft live (the
 *                            editor open in another tab of this browser sends
 *                            it over a BroadcastChannel)
 *
 * It does not register as a screen, so it never appears as an unpaired TV
 * and does not affect the uptime reports.
 */
export default function TvBoardPage() {
  const { session, isAdmin, loading } = useAuth();
  const [params] = useSearchParams();
  const followDraft = params.get("draft") === "1";
  const draft = useDraftFromEditor(followDraft && isAdmin);

  // useAuth reports "not admin" for one render before the role check starts;
  // give it a moment so an admin does not see a flash of "no permission".
  const [graceOver, setGraceOver] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setGraceOver(true), 1500);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const previous = document.title;
    document.title = "לוח תצוגה — בית הכנסת";
    return () => {
      document.title = previous;
    };
  }, []);

  useScreenWakeLock(isAdmin);
  useTvFonts();

  if (isAdmin) {
    return (
      <div className="fixed inset-0 z-[60] bg-black" dir="rtl">
        <TvApp mode="web" configOverride={followDraft ? draft : null} exitHref="/community/admin?tab=tv&tvTab=design" />
        {followDraft && !draft && (
          <div className="pointer-events-none fixed bottom-3 left-3 z-[61] rounded-md bg-black/70 px-3 py-1.5 text-xs text-white">
            ממתין לטיוטה מהעורך… (מוצג העיצוב השמור)
          </div>
        )}
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

/** The editor's draft, received live from another tab of this browser. */
function useDraftFromEditor(enabled: boolean): TvConfig | null {
  const [draft, setDraft] = useState<TvConfig | null>(null);
  useEffect(() => {
    if (!enabled || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(TV_DRAFT_CHANNEL);
    channel.onmessage = (e: MessageEvent<DraftMessage>) => {
      // Same-origin only, but still validated like any stored config.
      if (e.data?.type !== "draft") return;
      // The unsaved content edits ride along (whitelisted), so the window also
      // shows a renamed minyan or an edited announcement before saving.
      const records = Array.isArray(e.data.config?._records) ? e.data.config._records.filter(isAllowedEdit).slice(0, 500) : [];
      setDraft({ ...normalizeTvConfig(e.data.config), _records: records });
    };
    channel.postMessage({ type: "hello" } satisfies DraftMessage);
    return () => channel.close();
  }, [enabled]);
  return draft;
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
