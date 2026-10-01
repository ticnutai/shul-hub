import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { MonitorSmartphone, Tv } from "lucide-react";
import type { MinyanCategory, Settings } from "@community/lib/data";
import { useSaveRow } from "@community/lib/admin";
import { isEventCategory } from "@community/lib/specialDays";
import { normalizePrayerLayout, PRAYER_LAYOUTS } from "@community/components/PrayerLayoutPicker";

/**
 * "איך יראו זמני התפילות" - the one place the website and the app's prayer
 * times are set: which days (settings.minyan_days) and how a day's prayers are
 * drawn (settings.minyan_layout, or a layout per day when it is empty).
 *
 * The board is a separate system on purpose - a wall nobody taps - and is set
 * in its own editor (tv_config.prayerDays); this panel only points there.
 */
const DAYS: { value: string; label: string; description: string }[] = [
  { value: "day", label: "כל יום בלשונית משלו", description: "נפתח על היום; שאר הימים בלחיצה" },
  { value: "week_today", label: "כל השבוע · היום למעלה", description: "היום ראשון ומסומן, ואחריו הימים הבאים" },
  { value: "week_fixed", label: "כל השבוע · סדר קבוע", description: "חול, שישי, שבת - היום מסומן במקומו" },
];

const PER_DAY = "per_day";

function Choice({
  pressed,
  label,
  description,
  onClick,
  disabled,
}: {
  pressed: boolean;
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={
        "rounded-lg border p-3 text-right transition-colors disabled:opacity-60 " +
        (pressed ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted")
      }
    >
      <span className="block text-sm font-medium">{label}</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
    </button>
  );
}

export function PrayerDisplaySettings({
  settings,
  categories,
}: {
  settings: Settings | null | undefined;
  categories: MinyanCategory[];
}) {
  const saveSettings = useSaveRow("settings", "settings");
  const saveCategory = useSaveRow("minyan_categories", "minyan_categories");
  const busy = !settings?.id || saveSettings.isPending;
  const days = settings?.minyan_days ?? "day";
  const layout = settings?.minyan_layout ?? PER_DAY;
  const dayTabs = categories.filter((c) => !isEventCategory(c));
  // Reached from "עריכת התצוגה" on the home page: brought into view.
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (window.location.hash === "#prayer-display") ref.current?.scrollIntoView({ block: "start" });
  }, []);

  const set = (fields: Partial<Pick<Settings, "minyan_days" | "minyan_layout">>) => {
    if (settings?.id) saveSettings.mutate({ id: settings.id, ...fields });
  };

  return (
    <section ref={ref} id="prayer-display" className="scroll-mt-24 rounded-xl border bg-card p-4 sm:p-5" data-testid="prayer-display">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <MonitorSmartphone className="size-5 text-primary" aria-hidden />
          איך יראו זמני התפילות באתר ובאפליקציה
        </h3>
        <Link
          to="/community/admin?tab=tv&panel=layout"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <Tv className="size-3.5" aria-hidden />
          הלוח בבית הכנסת נקבע בנפרד, בעורך הלוח
        </Link>
      </div>

      <p className="mt-4 text-sm font-medium">אילו ימים רואים?</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3" role="group" aria-label="אילו ימים רואים">
        {DAYS.map((d) => (
          <Choice
            key={d.value}
            pressed={days === d.value}
            label={d.label}
            description={d.description}
            disabled={busy}
            onClick={() => days !== d.value && set({ minyan_days: d.value })}
          />
        ))}
      </div>

      <p className="mt-5 text-sm font-medium">איך מוצגות התפילות (שחרית, מנחה, ערבית) בתוך יום?</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3" role="group" aria-label="איך מוצגות התפילות בתוך יום">
        {PRAYER_LAYOUTS.map((l) => (
          <Choice
            key={l.value}
            pressed={layout === l.value}
            label={l.label}
            description={l.description}
            disabled={busy}
            onClick={() => layout !== l.value && set({ minyan_layout: l.value })}
          />
        ))}
        <Choice
          pressed={layout === PER_DAY}
          label="לכל יום אחרת"
          description="בוחרים פריסה נפרדת לכל לשונית יום"
          disabled={busy}
          onClick={() => layout !== PER_DAY && set({ minyan_layout: null })}
        />
      </div>

      {layout === PER_DAY && dayTabs.length > 0 && (
        <div className="mt-3 space-y-2 rounded-lg bg-muted/50 p-3" data-testid="prayer-display-per-day">
          {dayTabs.map((c) => (
            <label key={c.id} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="min-w-24 font-medium">{c.name}</span>
              <select
                value={normalizePrayerLayout(c.display_mode)}
                disabled={saveCategory.isPending}
                onChange={(e) => saveCategory.mutate({ id: c.id, display_mode: e.target.value })}
                className="h-8 rounded-md border bg-background px-2 text-sm"
              >
                {PRAYER_LAYOUTS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
    </section>
  );
}
