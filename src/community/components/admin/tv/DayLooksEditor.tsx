import { DAY_KINDS, type DayKind, type DayLook, type ScreenLayout, type TvConfig } from "@/tv/config";
import { DAY_KIND_LABELS, dayKindAt } from "@/tv/dayLooks";
import { ILLUSTRATION_DEFS } from "@/tv/illustrated";
import { allThemes } from "@/tv/themes";

type Edit = (key: string, update: (c: TvConfig) => TvConfig) => void;

const LAYOUT_NAMES: Record<ScreenLayout, string> = {
  rotate: "סבב שקפים",
  split: "מפוצל",
  dashboard: "לוח מלא",
  illustrated: "תבנית מאוירת",
};

/**
 * "מראה לפי יום": for Shabbat, festivals, Rosh Chodesh and Friday, the board
 * can switch by itself to another layout, painted board or theme. Each choice
 * is optional - "כרגיל" keeps what every other day has.
 */
export function DayLooksEditor({ config, onEdit }: { config: TvConfig; onEdit: Edit }) {
  const themes = allThemes(config.customThemes);
  // What the screens wear right now (the preview above keeps the ordinary look, for editing).
  const today = dayKindAt(new Date(), null, config.shabbat.endMinutesAfterSunset);
  const todayLooked = today && config.dayLooks[today];
  const boards = [...ILLUSTRATION_DEFS, ...config.customIllustrations];
  const set = (kind: DayKind, patch: Partial<DayLook>) =>
    onEdit(`day-look:${kind}`, (c) => {
      const next: DayLook = { ...c.dayLooks[kind], ...patch };
      for (const k of Object.keys(next) as (keyof DayLook)[]) if (!next[k]) delete next[k];
      const dayLooks = { ...c.dayLooks };
      if (Object.keys(next).length) dayLooks[kind] = next;
      else delete dayLooks[kind];
      return { ...c, dayLooks };
    });

  return (
    <div className="mt-4 space-y-3 rounded-lg border p-3">
      <div>
        <div className="text-sm font-medium">מראה לפי יום</div>
        <p className="text-[11px] leading-tight text-muted-foreground">
          הלוח מחליף לבד את המראה בימים האלה, ובשאר הימים חוזר לרגיל. כשמסך השבת פעיל, הוא זה שמוצג בשבת.
          התצוגה המקדימה למעלה מציגה תמיד את המראה הרגיל.
        </p>
        <p className="mt-1 text-xs">
          {today
            ? todayLooked
              ? `עכשיו: ${DAY_KIND_LABELS[today]} — המסכים מציגים את המראה שנבחר לו.`
              : `עכשיו: ${DAY_KIND_LABELS[today]} — לא נבחר לו מראה, המסכים במראה הרגיל.`
            : "עכשיו יום רגיל — המסכים במראה הרגיל."}
        </p>
      </div>
      <div className="hidden grid-cols-[1fr_repeat(3,minmax(0,1fr))] gap-1.5 text-[11px] text-muted-foreground sm:grid">
        <span />
        <span>פריסה</span>
        <span>לוח מצויר</span>
        <span>ערכת נושא</span>
      </div>
      {DAY_KINDS.map((kind) => {
        const look = config.dayLooks[kind] ?? {};
        const layout = look.screenLayout;
        return (
          <div key={kind} className="grid grid-cols-1 gap-1.5 sm:grid-cols-[1fr_repeat(3,minmax(0,1fr))] sm:items-center">
            <span className="text-xs font-medium">{DAY_KIND_LABELS[kind]}</span>
            <select
              aria-label={`פריסה · ${DAY_KIND_LABELS[kind]}`}
              value={layout ?? ""}
              onChange={(e) => set(kind, { screenLayout: (e.target.value || undefined) as ScreenLayout | undefined })}
              className="h-8 rounded-md border bg-background px-1 text-xs"
            >
              <option value="">כרגיל</option>
              {(Object.keys(LAYOUT_NAMES) as ScreenLayout[]).map((l) => (
                <option key={l} value={l}>
                  {LAYOUT_NAMES[l]}
                </option>
              ))}
            </select>
            <select
              aria-label={`לוח מצויר · ${DAY_KIND_LABELS[kind]}`}
              value={look.illustration ?? ""}
              onChange={(e) => set(kind, { illustration: e.target.value || undefined })}
              disabled={(layout ?? config.screenLayout) !== "illustrated"}
              className="h-8 rounded-md border bg-background px-1 text-xs disabled:opacity-50"
            >
              <option value="">כרגיל</option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select
              aria-label={`ערכת נושא · ${DAY_KIND_LABELS[kind]}`}
              value={look.theme ?? ""}
              onChange={(e) => set(kind, { theme: e.target.value || undefined })}
              className="h-8 rounded-md border bg-background px-1 text-xs"
            >
              <option value="">כרגיל</option>
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
