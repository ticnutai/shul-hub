/**
 * More ways into the gabbai's same screens (adminLayout.ts), beside the tabs
 * and the tiles - each a way to choose, never a screen of its own:
 *
 *   side    the sections in their groups down the side, the screen beside
 *           them; folded to icons (by itself on the boards' editor, which
 *           needs the width)
 *   menus   a row of four menus, one to a group, each opening its sections
 *   search  "מה לנהל?": a search over the sections and the boards' steps,
 *           with what was opened lately
 *
 * And the two pieces every layout shares: the chooser of the layout, and the
 * phone's list of the sections (one list on a phone, whatever the layout).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Check, ChevronDown, LayoutGrid, List, Menu, PanelRight, PanelRightClose, PanelRightOpen, Search, X, type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { groupSections, type AdminSection } from "@community/lib/adminSections";
import { ADMIN_LAYOUTS, type AdminLayout } from "@community/lib/adminLayout";
import { readStored, writeStored } from "./tv/editorLayout";
import { TV_STEPS, useSteps } from "./AdminTiles";

/** What each layout is called, and a line of what it is - in the chooser. */
const LAYOUT_INFO: Record<AdminLayout, { label: string; hint: string; icon: LucideIcon }> = {
  tabs: { label: "רשימה", hint: "כל המדורים בשורה אחת למעלה", icon: List },
  tiles: { label: "אריחים", hint: "כפתורים גדולים, צעד אחרי צעד", icon: LayoutGrid },
  side: { label: "תפריט צד", hint: "המדורים בקבוצות בצד, והמסך לידם", icon: PanelRight },
  menus: { label: "תפריטים", hint: "ארבע קבוצות למעלה, כל אחת נפתחת", icon: Menu },
  search: { label: "חיפוש", hint: "כותבים מה לנהל, ורואים מה פתחתם לאחרונה", icon: Search },
};

/** The chooser of the layout: one button, opening the five. */
export function LayoutChooser({ layout, onChange }: { layout: AdminLayout; onChange: (next: AdminLayout) => void }) {
  const Icon = LAYOUT_INFO[layout].icon;
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <button type="button" data-testid="admin-layout-switch" aria-label={`פריסת מסך הניהול: ${LAYOUT_INFO[layout].label}`}
          className="flex min-h-11 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm hover:bg-muted sm:min-h-9">
          <Icon className="size-4" aria-hidden /> {LAYOUT_INFO[layout].label} <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>פריסת מסך הניהול</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={layout} onValueChange={(v) => onChange(v as AdminLayout)}>
          {ADMIN_LAYOUTS.map((l) => {
            const I = LAYOUT_INFO[l].icon;
            return (
              <DropdownMenuRadioItem key={l} value={l} className="items-start gap-2 py-2">
                <I className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="flex flex-col">
                  <span className="font-medium">{LAYOUT_INFO[l].label}</span>
                  <span className="text-xs text-muted-foreground">{LAYOUT_INFO[l].hint}</span>
                </span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** On a phone: the sections as one list to choose from - the same in every layout that has no tiles. */
export function SectionSelect({ sections, value, onChange, label }: {
  sections: AdminSection[];
  value: string;
  onChange: (tab: string) => void;
  label: (s: AdminSection) => string;
}) {
  return (
    <div className="sticky top-[var(--app-header-height,7rem)] z-20 bg-background py-2 sm:hidden" data-focus-hide>
      <Select dir="rtl" value={value} onValueChange={onChange}>
        <SelectTrigger aria-label="מדור ניהול" className="h-12 w-full font-semibold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent dir="rtl" position="popper" className="max-h-[60dvh]">
          {sections.map((s) => (
            <SelectItem key={s.value} value={s.value} className="min-h-11 py-3">
              {label(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type LayoutProps = {
  sections: AdminSection[];
  activeTab: string;
  openTab: (tab: string) => void | Promise<void>;
  sectionLabel: (s: AdminSection) => string;
  renderSection: (value: string) => ReactNode;
};

const SIDE_NARROW_KEY = "shul-hub.admin.side-narrow";

/** The sections down the side, in their groups; the screen beside them. */
export function SideMenuLayout({ sections, activeTab, openTab, sectionLabel, renderSection }: LayoutProps) {
  const [pref, setPref] = useState<boolean | null>(() => {
    const v = readStored(SIDE_NARROW_KEY);
    return v === null ? null : v === "1";
  });
  // Folded by itself on the boards' editor - it needs the width - until asked otherwise.
  const narrow = pref ?? activeTab === "tv";
  const fold = () => {
    setPref(!narrow);
    writeStored(SIDE_NARROW_KEY, narrow ? "0" : "1");
  };
  return (
    <div className="mt-4 min-w-0" data-testid="admin-side-layout">
      <SectionSelect sections={sections} value={activeTab} onChange={(t) => void openTab(t)} label={sectionLabel} />
      <div className="flex min-w-0 items-start gap-4">
        <nav aria-label="מדורי ניהול" data-focus-hide data-testid="admin-side-menu"
          className={`sticky top-3 hidden max-h-[calc(100dvh-1.5rem)] shrink-0 overflow-y-auto rounded-xl border bg-card p-2 sm:block ${narrow ? "w-14" : "w-56"}`}>
          <button type="button" onClick={fold} aria-label={narrow ? "הרחבת התפריט" : "צמצום התפריט"} title={narrow ? "הרחבת התפריט" : "צמצום התפריט לסמלים"}
            className="mb-1 flex h-8 w-full items-center justify-center gap-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted">
            {narrow ? <PanelRightOpen className="size-4" aria-hidden /> : <><PanelRightClose className="size-4" aria-hidden /> צמצום</>}
          </button>
          {groupSections(sections).map((g) => (
            <div key={g.id} className="mb-2" role="group" aria-label={g.label}>
              {narrow ? <div className="mx-2 my-1 border-t" aria-hidden /> : <div className="px-2 pb-1 pt-2 text-[11px] font-semibold text-muted-foreground">{g.label}</div>}
              {g.sections.map((s) => {
                const on = s.value === activeTab;
                return (
                  <button key={s.value} type="button" onClick={() => void openTab(s.value)} aria-current={on ? "page" : undefined}
                    title={narrow ? sectionLabel(s) : s.hint} aria-label={narrow ? sectionLabel(s) : undefined}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right text-sm ${narrow ? "justify-center" : ""} ${on ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                    <s.icon className="size-4 shrink-0" aria-hidden />
                    {!narrow && <span className="min-w-0 flex-1 truncate">{sectionLabel(s)}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="min-w-0 flex-1 space-y-6" data-testid="admin-screen">{renderSection(activeTab)}</div>
      </div>
    </div>
  );
}

/** A row of four menus, one to a group; where one is, under it. */
export function MenusLayout({ sections, activeTab, openTab, sectionLabel, renderSection }: LayoutProps) {
  const groups = groupSections(sections);
  const current = groups.find((g) => g.sections.some((s) => s.value === activeTab));
  const section = sections.find((s) => s.value === activeTab);
  return (
    <div className="mt-4 min-w-0 space-y-5" data-testid="admin-menus-layout">
      <SectionSelect sections={sections} value={activeTab} onChange={(t) => void openTab(t)} label={sectionLabel} />
      <nav aria-label="מדורי ניהול" data-focus-hide className="hidden flex-wrap items-center gap-1 rounded-xl border bg-card p-1.5 sm:flex" data-testid="admin-menus">
        {groups.map((g) => (
          <DropdownMenu key={g.id} dir="rtl">
            <DropdownMenuTrigger asChild>
              <button type="button" className={`flex h-9 items-center gap-1.5 rounded-md px-3 text-sm ${g === current ? "bg-primary/10 font-semibold text-primary" : "hover:bg-muted"}`}>
                {g.label} <ChevronDown className="size-3.5" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {g.sections.map((s) => (
                <DropdownMenuItem key={s.value} onSelect={() => void openTab(s.value)} className="items-start gap-2 py-2">
                  <s.icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="flex flex-1 flex-col">
                    <span className="font-medium">{sectionLabel(s)}</span>
                    <span className="text-xs text-muted-foreground">{s.hint}</span>
                  </span>
                  {s.value === activeTab && <Check className="size-4 text-primary" aria-hidden />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
        {section && current && (
          <span className="ms-auto hidden items-center gap-1.5 px-2 text-sm text-muted-foreground md:flex" data-testid="admin-menus-where">
            {current.label} <span aria-hidden>›</span> <span className="font-semibold text-foreground">{sectionLabel(section)}</span>
          </span>
        )}
      </nav>
      <div className="min-w-0 space-y-6" data-testid="admin-screen">{renderSection(activeTab)}</div>
    </div>
  );
}

/** One place to go to: a section, or one of the boards' steps. */
type Destination = { key: string; label: string; hint: string; icon: LucideIcon; group: string; set: Record<string, string | null> };

const RECENT_KEY = "shul-hub.admin.recent";
const STEPS_OFF = { cat: null, prayer: null, tvTab: null, panel: null } as const;

function destinations(sections: AdminSection[], sectionLabel: (s: AdminSection) => string): Destination[] {
  const out: Destination[] = [];
  for (const g of groupSections(sections)) {
    for (const s of g.sections) {
      out.push({ key: s.value, label: sectionLabel(s), hint: s.hint, icon: s.icon, group: g.label, set: { ...STEPS_OFF, tab: s.value } });
      // The boards: each of their steps a place of its own, as the tiles have them.
      if (s.value === "tv") {
        for (const t of TV_STEPS) {
          out.push({ key: `tv:${t.tvTab}:${t.panel ?? ""}`, label: `${s.label} › ${t.label}`, hint: t.hint, icon: t.icon, group: g.label, set: { ...STEPS_OFF, tab: "tv", tvTab: t.tvTab, panel: t.panel ?? null } });
        }
      }
    }
  }
  return out;
}

/** "מה לנהל?": a search over every place, and what was opened lately; a place open, the way back to the search above it. */
export function SearchLayout({ sections, chosen, sectionLabel, renderSection }: Omit<LayoutProps, "activeTab" | "openTab"> & {
  /** The section open, if one is (?tab=); none - the search. */
  chosen: string | null;
}) {
  const { params, go } = useSteps();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      const v = JSON.parse(readStored(RECENT_KEY) ?? "[]");
      return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 6) : [];
    } catch {
      return [];
    }
  });
  const all = destinations(sections, sectionLabel);
  const open = async (d: Destination) => {
    await go(d.set);
    const next = [d.key, ...recent.filter((k) => k !== d.key)].slice(0, 6);
    setRecent(next);
    writeStored(RECENT_KEY, JSON.stringify(next));
    setQuery("");
  };
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!chosen) input.current?.focus();
  }, [chosen]);

  const section = sections.find((s) => s.value === chosen);
  if (section) {
    const tvStep = section.value === "tv" ? TV_STEPS.find((t) => t.tvTab === (params.get("tvTab") ?? "design") && (!t.panel || t.panel === (params.get("panel") ?? "design"))) : undefined;
    return (
      <div className="mt-4 min-w-0 space-y-5" data-testid="admin-search-layout">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-1.5" data-focus-hide>
          <button type="button" onClick={() => void go({ ...STEPS_OFF, tab: null })} data-testid="admin-search-back"
            className="flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-muted">
            <Search className="size-4" aria-hidden /> מה לנהל?
          </button>
          <span className="flex items-center gap-1.5 px-1 text-sm">
            <section.icon className="size-4 text-primary" aria-hidden />
            <span className="font-semibold">{sectionLabel(section)}</span>
            {tvStep && <><span className="text-muted-foreground" aria-hidden>›</span> {tvStep.label}</>}
          </span>
          {/* Lately opened, to go straight there: the places besides this one. */}
          <span className="ms-auto hidden flex-wrap gap-1 md:flex" aria-label="נפתחו לאחרונה">
            {recent.map((k) => all.find((d) => d.key === k)).filter((d): d is Destination => Boolean(d) && d!.key !== section.value).slice(0, 4).map((d) => (
              <button key={d.key} type="button" onClick={() => void open(d)} className="h-8 rounded-full border px-2.5 text-xs hover:bg-muted">{d.label}</button>
            ))}
          </span>
        </div>
        <div className="min-w-0 space-y-6" data-testid="admin-screen">{renderSection(section.value)}</div>
      </div>
    );
  }

  const words = query.trim().split(/\s+/).filter(Boolean);
  const found = words.length ? all.filter((d) => words.every((w) => `${d.label} ${d.hint} ${d.group}`.includes(w))) : [];
  const lately = recent.map((k) => all.find((d) => d.key === k)).filter((d): d is Destination => Boolean(d));
  const row = (d: Destination) => (
    <button key={d.key} type="button" onClick={() => void open(d)} data-testid={`admin-search-${d.key}`}
      className="flex w-full items-start gap-3 rounded-lg border bg-card p-3 text-right hover:border-primary">
      <d.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{d.label}</span>
        <span className="block text-xs text-muted-foreground">{d.hint}</span>
      </span>
      <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:block">{d.group}</span>
    </button>
  );
  return (
    <div className="mx-auto mt-6 max-w-2xl space-y-5" data-testid="admin-search-layout">
      <form role="search" onSubmit={(e) => { e.preventDefault(); if (found[0]) void open(found[0]); }} className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input ref={input} value={query} onChange={(e) => setQuery(e.target.value)} aria-label="מה לנהל?" placeholder="מה לנהל? למשל: שחרית, מודעה, רקע ללוח, גבאי…"
          className="h-14 w-full rounded-xl border bg-background pe-10 ps-11 text-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        {query && (
          <button type="button" aria-label="ניקוי החיפוש" onClick={() => setQuery("")} className="absolute left-3 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-muted">
            <X className="size-4" aria-hidden />
          </button>
        )}
      </form>
      {words.length ? (
        <div className="space-y-2" data-testid="admin-search-results">
          {found.length ? found.map(row) : <p className="text-center text-sm text-muted-foreground">לא נמצא. נסו מילה אחרת, או בחרו מהרשימה למטה.</p>}
        </div>
      ) : (
        <>
          {lately.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">נפתחו לאחרונה</h2>
              <div className="grid gap-2 sm:grid-cols-2">{lately.map(row)}</div>
            </section>
          )}
          {groupSections(sections).map((g) => (
            <section key={g.id} className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">{g.label}</h2>
              <div className="grid gap-2 sm:grid-cols-2">{all.filter((d) => d.group === g.label && !d.key.startsWith("tv:")).map(row)}</div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
