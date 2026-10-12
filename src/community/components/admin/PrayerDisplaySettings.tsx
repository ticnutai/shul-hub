import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { MonitorSmartphone, Tv } from "lucide-react";
import type { MinyanCategory, Settings } from "@community/lib/data";
import { useSaveRow } from "@community/lib/admin";
import { isEventCategory } from "@community/lib/specialDays";
import { normalizePrayerLayout, PRAYER_LAYOUTS } from "@community/components/PrayerLayoutPicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChoiceCard, ChoiceGroup } from "./adminUi";

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

/**
 * `showTitle`: false when it stands inside a fold already titled "איך יראו
 * זמני התפילות" (the minyanim's own screen) - the link to the board stays.
 */
export function PrayerDisplaySettings({
  settings,
  categories,
  showTitle = true,
}: {
  settings: Settings | null | undefined;
  categories: MinyanCategory[];
  showTitle?: boolean;
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
        {showTitle ? (
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <MonitorSmartphone className="size-5 text-primary" aria-hidden />
            איך יראו זמני התפילות באתר ובאפליקציה
          </h3>
        ) : (
          <p className="text-sm text-muted-foreground">באתר ובאפליקציה.</p>
        )}
        <Link
          to="/community/admin?tab=tv&panel=layout"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <Tv className="size-3.5" aria-hidden />
          הלוח בבית הכנסת נקבע בנפרד, בעורך הלוח
        </Link>
      </div>

      <p className="mt-4 text-sm font-medium">אילו ימים רואים?</p>
      <ChoiceGroup className="mt-2 grid gap-2 sm:grid-cols-3" label="אילו ימים רואים">
        {DAYS.map((d) => (
          <ChoiceCard
            key={d.value}
            selected={days === d.value}
            title={d.label}
            description={d.description}
            disabled={busy}
            onSelect={() => set({ minyan_days: d.value })}
          />
        ))}
      </ChoiceGroup>

      <p className="mt-5 text-sm font-medium">איך מוצגות התפילות (שחרית, מנחה, ערבית) בתוך יום?</p>
      <ChoiceGroup className="mt-2 grid gap-2 sm:grid-cols-3" label="איך מוצגות התפילות בתוך יום">
        {PRAYER_LAYOUTS.map((l) => (
          <ChoiceCard
            key={l.value}
            selected={layout === l.value}
            title={l.label}
            description={l.description}
            disabled={busy}
            onSelect={() => set({ minyan_layout: l.value })}
          />
        ))}
        <ChoiceCard
          selected={layout === PER_DAY}
          title="לכל יום אחרת"
          description="בוחרים פריסה נפרדת לכל לשונית יום"
          disabled={busy}
          onSelect={() => set({ minyan_layout: null })}
        />
      </ChoiceGroup>

      {layout === PER_DAY && dayTabs.length > 0 && (
        <div className="mt-3 space-y-2 rounded-lg bg-muted/50 p-3" data-testid="prayer-display-per-day">
          {dayTabs.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="min-w-24 font-medium">{c.name}</span>
              <Select
                value={normalizePrayerLayout(c.display_mode)}
                disabled={saveCategory.isPending}
                onValueChange={(value) => saveCategory.mutate({ id: c.id, display_mode: value })}
              >
                <SelectTrigger aria-label={`פריסת התפילות ב${c.name}`} className="h-9 w-auto min-w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRAYER_LAYOUTS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
