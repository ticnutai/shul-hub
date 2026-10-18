/**
 * The gabbai's area as tiles: a screen of big buttons, each opening the next
 * step in the whole frame - מניינים → יום חול → שחרית → the list - with the
 * path back at the top ("ראשי › מניינים › יום חול › שחרית"), every step of
 * it a link, and the phone's own back button going back a step.
 *
 * Another way into the same screens, not other screens: the last step is the
 * screen the tabs open, told what was chosen on the way (MinyanimAdmin's
 * `chosen`, the board editor's ?tvTab= and ?panel=). A step with one choice
 * only is never shown - it is taken. The tabs stay, as they were; which of
 * the two is up is the gabbai's choice (adminLayout.ts).
 */
import type { ReactNode } from "react";
import { PATH_BESIDE_ID } from "./adminPath";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarClock, CalendarDays, ChevronLeft, Home, MonitorSmartphone, Palette, ScrollText,
  Settings2, Wrench, LayoutTemplate, Type, type LucideIcon,
} from "lucide-react";
import { minyanSubcategories, useMinyanCategories, useMinyanim } from "@community/lib/data";
import { isEventCategory } from "@community/lib/specialDays";
import { useNow } from "@community/lib/realtime";
import { MinyanimAdmin } from "./MinyanimAdmin";
import { MinyanOverridesAdmin } from "./MinyanOverridesAdmin";
import { silentScreens, useTvDevices } from "./tv/tvAdminData";
import type { AdminSection } from "@community/lib/adminSections";
import { confirmLeave } from "@community/lib/unsavedChanges";

/** The steps under a section, deepest last: what "back" takes off. */
const STEP_PARAMS = ["cat", "prayer", "tvTab", "panel"] as const;

function useSteps() {
  const [params, setParams] = useSearchParams();
  /**
   * A step forward (or back): its own entry in the history, so the phone's
   * back button undoes it. A form with unsaved changes on the screen being
   * left asks first (unsavedChanges.ts).
   */
  const go = async (set: Record<string, string | null>) => {
    if (!(await confirmLeave())) return;
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(set)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    next.delete("settingsTab");
    next.delete("focus");
    setParams(next);
  };
  return { params, go };
}

function Tile({ icon: Icon, label, hint, badge, onClick, testId }: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  badge?: string | number | null;
  onClick: () => void | Promise<void>;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="group relative flex min-h-[5.5rem] flex-col items-start gap-1 rounded-xl border bg-card p-3 text-right shadow-sm transition hover:border-primary hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary sm:min-h-[6.5rem] sm:gap-1.5 sm:p-4"
    >
      <span className="flex w-full items-center gap-2">
        <Icon className="size-5 shrink-0 text-primary sm:size-6" aria-hidden />
        <span className="min-w-0 flex-1 text-[15px] font-semibold leading-tight sm:text-base">{label}</span>
        {badge !== undefined && badge !== null && badge !== 0 && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">{badge}</span>
        )}
        <ChevronLeft className="hidden size-4 shrink-0 text-muted-foreground transition group-hover:-translate-x-0.5 min-[420px]:block" aria-hidden />
      </span>
      {hint && <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">{hint}</span>}
    </button>
  );
}

function TileGrid({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3" data-testid="admin-tiles">
      {children}
    </div>
  );
}

/** "ראשי › מניינים › יום חול": where one is, each step a way back to it. */
function Path({ steps, beside = false }: { steps: { label: string; onClick?: () => void | Promise<void> }[]; beside?: boolean }) {
  const back = [...steps].reverse().find((s, i) => i > 0 && s.onClick);
  const nav = (
    <nav aria-label="המיקום בניהול" className="flex flex-wrap items-center gap-1.5 text-sm" data-testid="admin-path">
      {back && (
        <button type="button" onClick={back.onClick} className="me-1 rounded-md border px-2.5 py-1.5 font-medium hover:bg-muted" aria-label={`חזרה ל${back.label}`}>
          → חזרה
        </button>
      )}
      {steps.map((s, i) => (
        <span key={`${s.label}${i}`} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-muted-foreground" aria-hidden>›</span>}
          {s.onClick && i < steps.length - 1 ? (
            <button type="button" onClick={s.onClick} className="rounded px-1 text-primary underline-offset-2 hover:underline">
              {i === 0 ? <><Home className="mb-0.5 inline size-3.5" aria-hidden /> {s.label}</> : s.label}
            </button>
          ) : (
            <span className="px-1 font-semibold" aria-current="page">{s.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
  if (!beside) return nav;
  // The steps and, beside them on the same line, what the section puts there (the boards: screens off line).
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {nav}
      <div id={PATH_BESIDE_ID} className="min-w-0 flex-1" />
    </div>
  );
}


export function AdminTiles({ sections, badges, renderSection }: {
  /** The sections this gabbai has (the store app has no boards). */
  sections: AdminSection[];
  badges: Record<string, number | undefined>;
  /** The section's own screen, exactly as its tab shows it. */
  renderSection: (value: string) => ReactNode;
}) {
  const { params, go } = useSteps();
  const tab = params.get("tab");
  const section = sections.find((s) => s.value === tab);
  const home = () => go({ tab: null, ...Object.fromEntries(STEP_PARAMS.map((k) => [k, null])) });

  if (!section) {
    return (
      <div className="mt-5 space-y-3" data-testid="admin-home">
        <p className="text-sm text-muted-foreground">בחרו מה לנהל. כל לחיצה פותחת את השלב הבא; למעלה תמיד אפשר לחזור.</p>
        <TileGrid label="מדורי ניהול">
          {sections.map((s) => (
            <Tile
              key={s.value}
              icon={s.icon}
              label={s.label}
              hint={s.hint}
              badge={badges[s.value]}
              testId={`admin-tile-${s.value}`}
              onClick={() => go({ tab: s.value, ...Object.fromEntries(STEP_PARAMS.map((k) => [k, null])) })}
            />
          ))}
        </TileGrid>
      </div>
    );
  }

  const root = { label: "ראשי", onClick: home };
  const sectionStep = { label: section.label, onClick: () => go(Object.fromEntries(STEP_PARAMS.map((k) => [k, null]))) };
  if (section.value === "minyanim") return <MinyanimSteps root={root} sectionStep={sectionStep} />;
  if (section.value === "tv") return <TvSteps root={root} sectionStep={sectionStep} renderSection={renderSection} />;
  return (
    <div className="mt-5 space-y-5">
      <Path steps={[root, sectionStep]} />
      {renderSection(section.value)}
    </div>
  );
}

type Step = { label: string; onClick?: () => void | Promise<void> };

/** מניינים → the day (חול, שבת…) → the prayer (שחרית, מנחה…) → the list. */
function MinyanimSteps({ root, sectionStep }: { root: Step; sectionStep: Step }) {
  const { params, go } = useSteps();
  const { data: categories = [] } = useMinyanCategories();
  const { data: minyanim = [] } = useMinyanim();
  const regular = useMemo(() => categories.filter((c) => !isEventCategory(c)), [categories]);
  const cat = params.get("cat");
  const prayer = params.get("prayer");
  const count = (categoryId: string, systemKey: string | null, p?: string) =>
    minyanim.filter((m) => (m.category_id === categoryId || (!m.category_id && m.day_type === systemKey)) && (!p || m.prayer === p)).length;

  // Its own two tiles, beside the days: what is different about one date, and the days themselves.
  if (cat === "overrides" || cat === "manage") {
    return (
      <div className="mt-5 space-y-5">
        <Path steps={[root, sectionStep, { label: cat === "overrides" ? "שינוי ליום אחד" : "ימים, תפילות ותצוגה" }]} />
        {/* "ימים, תפילות ותצוגה": the days and how the times are shown, not the list again - each day's tile opens that. */}
        {cat === "overrides" ? <MinyanOverridesAdmin /> : <MinyanimAdmin manageOnly />}
      </div>
    );
  }

  // One day only: no step to choose it.
  const category = categories.find((c) => c.id === cat) ?? (regular.length === 1 ? regular[0] : undefined);
  if (!category) {
    return (
      <div className="mt-5 space-y-4">
        <Path beside steps={[root, sectionStep]} />
        <TileGrid label="ימים">
          {regular.map((c) => (
            <Tile
              key={c.id}
              icon={CalendarDays}
              label={c.name}
              hint={`${count(c.id, c.system_key)} מניינים${c.active ? "" : " · מוסתר באתר"}`}
              testId={`minyan-tile-${c.id}`}
              onClick={() => go({ cat: c.id, prayer: null })}
            />
          ))}
          <Tile icon={CalendarClock} label="שינוי ליום אחד" hint="תאריך שבו הזמנים שונים מהרגיל" testId="minyan-tile-overrides" onClick={() => go({ cat: "overrides", prayer: null })} />
          <Tile icon={Settings2} label="ימים, תפילות ותצוגה" hint="הוספה, סידור ועריכה של הימים והתפילות, ואיך הזמנים מוצגים" testId="minyan-tile-manage" onClick={() => go({ cat: "manage", prayer: null })} />
        </TileGrid>
      </div>
    );
  }

  const subs = minyanSubcategories(category);
  const chosenSub = subs.find((s) => s.id === prayer) ?? (subs.length === 1 ? subs[0] : undefined);
  // Back to the day's prayers - when there was a choice of them to go back to.
  const dayStep: Step = { label: category.name, onClick: subs.length > 1 ? () => go({ prayer: null }) : undefined };
  if (subs.length > 1 && !chosenSub) {
    return (
      <div className="mt-5 space-y-4">
        <Path steps={[root, sectionStep, dayStep]} />
        <TileGrid label="תפילות">
          {subs.map((s) => (
            <Tile key={s.id} icon={ScrollText} label={s.label} hint={`${count(category.id, category.system_key, s.id)} מניינים`} testId={`minyan-tile-prayer-${s.id}`} onClick={() => go({ cat: category.id, prayer: s.id })} />
          ))}
        </TileGrid>
      </div>
    );
  }
  return (
    <div className="mt-5 space-y-5">
      <Path steps={[root, sectionStep, dayStep, ...(subs.length > 1 && chosenSub ? [{ label: chosenSub.label }] : [])]} />
      <MinyanimAdmin chosen={{ categoryId: category.id, prayer: chosenSub?.id }} />
    </div>
  );
}

const TV_STEPS: { tvTab: string; panel?: string; label: string; icon: LucideIcon; hint: string }[] = [
  { tvTab: "design", panel: "design", label: "עיצוב", icon: Palette, hint: "ערכות, רקע, תיבות, מסגרות, טקסט וחלקים - עם תצוגה מקדימה" },
  { tvTab: "design", panel: "layout", label: "פריסה", icon: LayoutTemplate, hint: "מה מופיע על הלוח ובאיזה צד, המסכים והעמודים" },
  { tvTab: "design", panel: "content", label: "תוכן", icon: Type, hint: "טקסטים, תזכורות לפני הזמנים, כתובית רצה" },
  { tvTab: "design", panel: "occasions", label: "מועדים", icon: CalendarDays, hint: "שבת, חגים, ראש חודש וימים משלכם" },
  { tvTab: "design", panel: "tools", label: "כלים", icon: Wrench, hint: "גרסאות, ייבוא וייצוא" },
  { tvTab: "screens", label: "מסכים מחוברים", icon: MonitorSmartphone, hint: "מה מוצג עכשיו, שלט רחוק, חיבור מסך" },
  { tvTab: "logs", label: "דוחות ויומן", icon: ScrollText, hint: "מה קרה במסכים ומתי" },
];

/** תצוגות → what to work on → the editor, opened there (its preview always beside it). */
function TvSteps({ root, sectionStep, renderSection }: { root: Step; sectionStep: Step; renderSection: (value: string) => ReactNode }) {
  const { params, go } = useSteps();
  const { data: devices = [] } = useTvDevices();
  const now = useNow(60_000);
  const silent = silentScreens(devices, now.getTime()).length;
  const tvTab = params.get("tvTab");
  const panel = params.get("panel");
  const step = TV_STEPS.find((s) => s.tvTab === tvTab && (!s.panel || s.panel === (panel ?? "design")));
  if (!tvTab) {
    return (
      <div className="mt-5 space-y-4">
        <Path steps={[root, sectionStep]} />
        <TileGrid label="תצוגות">
          {TV_STEPS.map((s) => (
            <Tile
              key={`${s.tvTab}:${s.panel ?? ""}`}
              icon={s.icon}
              label={s.label}
              hint={s.hint}
              badge={s.tvTab === "screens" && silent ? `${silent} מנותקים` : null}
              testId={`tv-tile-${s.panel ?? s.tvTab}`}
              onClick={() => go({ tvTab: s.tvTab, panel: s.panel ?? null })}
            />
          ))}
        </TileGrid>
      </div>
    );
  }
  return (
    <div className="mt-2 space-y-3">
      <Path beside steps={[root, sectionStep, { label: step?.label ?? "עורך" }]} />
      {/* Opened anew at the step chosen: the editor reads ?panel= when it opens. */}
      <div key={`${tvTab}:${panel ?? ""}`}>{renderSection("tv")}</div>
    </div>
  );
}
