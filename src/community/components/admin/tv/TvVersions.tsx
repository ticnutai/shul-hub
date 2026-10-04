import { useState } from "react";
import { toast } from "sonner";
import { Eye, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TvConfig } from "@/tv/config";
import { readTvConfigVersion, useTvConfigVersions } from "./tvAdminData";

const when = (iso: string) =>
  new Intl.DateTimeFormat("he-IL", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(iso));

/**
 * The board as it was before: every save keeps the version it replaced (the
 * database does it, so none is ever missed). One can be looked at on the
 * preview, and put back - as a draft, so "שמור ושדר" still decides.
 */
export function TvVersions({
  shown,
  onShow,
  onRestore,
}: {
  /** The version on the preview now, if any. */
  shown: string | null;
  onShow: (version: { id: string; label: string; config: TvConfig } | null) => void;
  onRestore: (config: TvConfig, label: string) => void;
}) {
  const versions = useTvConfigVersions();
  const [busy, setBusy] = useState<string | null>(null);

  const open = async (id: string, then: (c: TvConfig) => void) => {
    setBusy(id);
    try {
      then(await readTvConfigVersion(id));
    } catch {
      toast.error("לא הצלחנו לקרוא את הגרסה. נסו שוב.");
    } finally {
      setBusy(null);
    }
  };

  if (versions.isLoading) return <p className="text-sm text-muted-foreground">טוען גרסאות…</p>;
  if (versions.error) return <p className="text-sm text-muted-foreground">לא הצלחנו לטעון את הגרסאות הקודמות.</p>;
  const list = versions.data ?? [];
  if (!list.length)
    return (
      <p className="text-sm text-muted-foreground" data-testid="tv-versions">
        עוד אין גרסאות קודמות. מהשמירה הבאה, כל "שמור ושדר" ישמור כאן את מה שהיה לפניו.
      </p>
    );

  return (
    <ul className="divide-y rounded-md border" data-testid="tv-versions">
      {list.map((v) => {
        const on = shown === v.id;
        return (
          <li key={v.id} className={`flex flex-wrap items-center gap-2 p-2 text-sm ${on ? "bg-primary/5" : ""}`}>
            <span className="flex-1">
              <span className="block font-medium">על המסכים מ-{when(v.saved_at)}</span>
              <span className="block text-[11px] text-muted-foreground">עד {when(v.replaced_at)}</span>
            </span>
            <Button
              type="button"
              size="sm"
              variant={on ? "default" : "outline"}
              disabled={busy === v.id}
              aria-pressed={on}
              onClick={() =>
                on ? onShow(null) : open(v.id, (config) => onShow({ id: v.id, label: when(v.saved_at), config }))
              }
            >
              <Eye className="size-4" /> {on ? "סגירת התצוגה" : "הצגה"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy === v.id}
              onClick={() => open(v.id, (config) => onRestore(config, when(v.saved_at)))}
            >
              <RotateCcw className="size-4" /> החזרה כטיוטה
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
