/**
 * The ways around the board editor, from one map of it (EDITOR_PLACES):
 * every tab and every section in it, in the editor's own order. Three ways
 * to go about it, chosen in "פריסה ותצוגה" - one at a time, never two:
 *
 *   tabs    the row of tabs, and the design tab's row of topics (as it was)
 *   menu    the whole map down the side: each tab a group, its sections under it
 *   search  "מה לשנות בלוח?": a word finds the section, and where one is stands above
 */
import { useState } from "react";
import { Search, X } from "lucide-react";
import { DESIGN_TOPICS, showDesignTopic, useDesignTopics, type DesignTopicId } from "./designTopics";

export type EditorNav = "tabs" | "menu" | "search" | "folded";
export const EDITOR_NAV_KEY = "shul-hub.tv-editor.nav";
export function readEditorNav(v: unknown): EditorNav {
  return v === "menu" || v === "search" || v === "folded" ? v : "tabs";
}

export type EditorTab = "design" | "layout" | "content" | "occasions" | "tools";
type Place = { id: string; label: string; words?: string };
type Group = { tab: EditorTab; label: string; places: Place[] };

/** Words a section is found by besides its name. */
const DESIGN_WORDS: Record<string, string> = {
  "design-sets": "ערכה עיצוב מוכן התחלה מחדש לוח ריק שמירה",
  "design-background": "צבע תמונה מעבר צבעים גלריה העלאה",
  "design-boxes": "צורה מילוי תיבה רקע תיבה",
  "design-frames": "קו מסגרת עמודים פרוכת",
  "design-text": "גופן גודל צבע כותרת אותיות",
  "design-elements": "חלק שכבה קונטיינר תמונה עיטור עמוד רשימת החלקים בחירה לפי סוג",
};

/** The editor, all of it: its tabs in order, each with its sections in order. */
export function editorPlaces(partsBoard: boolean): Group[] {
  return [
    { tab: "design", label: "עיצוב", places: DESIGN_TOPICS.map((t) => ({ id: t.id, label: t.label, words: DESIGN_WORDS[t.id] })) },
    {
      tab: "layout",
      label: "פריסה",
      places: partsBoard
        ? [{ id: "layout-elements", label: "מה יופיע ובאיזה צד", words: "צד עמוד תוכן מסגרת" }]
        : [
            { id: "layout-screens", label: "מסכים ומה עליהם", words: "מסך עמוד מתחלף" },
            { id: "layout-prayers", label: "זמני התפילות בלוח", words: "מניינים ימים שורות" },
            { id: "layout-screen", label: "פריסת מסך", words: "שעון מדליון" },
            { id: "layout-overflow", label: "כשהתוכן לא נכנס", words: "גלילה מהירות" },
            { id: "layout-logos", label: "לוגואים", words: "לוגו תורמים" },
            { id: "layout-header", label: "ראש המסך", words: "פרשה דף יומי לוגו" },
            { id: "layout-content", label: "איך מוצג כל סוג תוכן", words: "פריסת תפילות לימוד הודעות שיעורים" },
          ],
    },
    {
      tab: "content",
      label: "תוכן",
      places: [
        { id: "content-slideshow", label: "מצגת תמונות", words: "תמונות שקופיות" },
        { id: "content-ticker", label: "סרגל הודעה רץ", words: "כתובית רצה הודעה" },
        { id: "content-reminders", label: "תזכורות וספירה לאחור", words: "תזכורת לפני הזמנים ספירה" },
      ],
    },
    { tab: "occasions", label: "מועדים", places: [{ id: "occasions", label: "שבת, חגים ומועדים", words: "שבת חג ראש חודש יום מיוחד" }] },
    {
      tab: "tools",
      label: "כלים",
      places: [
        { id: "tools-versions", label: "גרסאות קודמות", words: "גרסה שחזור היסטוריה" },
        { id: "tools-transfer", label: "ייבוא וייצוא", words: "קובץ גיבוי העברה פיגמה" },
      ],
    },
  ];
}

/** To a place: its tab, then the section itself - a design topic shown, another section scrolled to. */
export function goToPlace(setTab: (t: EditorTab) => void, tab: EditorTab, id: string) {
  setTab(tab);
  if (tab === "design") return showDesignTopic(id as DesignTopicId);
  window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 80);
}

/** The place being worked on: the design topic shown, else the last one gone to on that tab. */
function useCurrent(tab: string, last: string | null) {
  const { topic } = useDesignTopics();
  return tab === "design" ? topic : last;
}

/** The whole map down the side: the tab open marked, and in it the section. */
export function EditorMenu({ tab, setTab, partsBoard }: { tab: string; setTab: (t: EditorTab) => void; partsBoard: boolean }) {
  const [last, setLast] = useState<string | null>(null);
  const current = useCurrent(tab, last);
  return (
    <nav aria-label="נושאי העורך" data-testid="editor-menu"
      className="sticky top-16 max-h-[calc(100dvh-5rem)] w-40 shrink-0 overflow-y-auto rounded-xl border bg-card p-1.5 text-sm">
      {editorPlaces(partsBoard).map((g) => (
        <div key={g.tab} role="group" aria-label={g.label} className="mb-1.5">
          <button type="button" onClick={() => setTab(g.tab)} aria-current={tab === g.tab ? "true" : undefined}
            className={`w-full rounded-md px-2 py-1 text-right font-semibold ${tab === g.tab ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            {g.label}
          </button>
          {tab === g.tab && g.places.length > 1 && (
            <div className="mt-0.5 border-s-2 border-primary/30 ps-1.5">
              {g.places.map((p) => (
                <button key={p.id} type="button" aria-current={current === p.id ? "true" : undefined}
                  onClick={() => { setLast(p.id); goToPlace(setTab, g.tab, p.id); }}
                  className={`block w-full truncate rounded px-1.5 py-1 text-right text-xs ${current === p.id ? "bg-primary/10 font-semibold text-primary" : "hover:bg-muted"}`}>
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}

/** "מה לשנות בלוח?": a word finds the section; above it, where one is. */
export function EditorSearch({ tab, setTab, partsBoard }: { tab: string; setTab: (t: EditorTab) => void; partsBoard: boolean }) {
  const [query, setQuery] = useState("");
  const [last, setLast] = useState<string | null>(null);
  const current = useCurrent(tab, last);
  const groups = editorPlaces(partsBoard);
  const all = groups.flatMap((g) => g.places.map((p) => ({ ...p, tab: g.tab, group: g.label })));
  const words = query.trim().split(/\s+/).filter(Boolean);
  const found = words.length ? all.filter((p) => words.every((w) => `${p.group} ${p.label} ${p.words ?? ""}`.includes(w))) : [];
  const go = (p: (typeof all)[number]) => {
    setLast(p.id);
    setQuery("");
    goToPlace(setTab, p.tab, p.id);
  };
  const group = groups.find((g) => g.tab === tab);
  const here = group?.places.find((p) => p.id === current);
  return (
    <div className="space-y-1.5" data-testid="editor-search">
      <form role="search" className="relative" onSubmit={(e) => { e.preventDefault(); if (found[0]) go(found[0]); }}>
        <Search className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="מה לשנות בלוח?" placeholder="מה לשנות בלוח? למשל: רקע, גופן, שבת, לוגו…"
          className="h-10 w-full rounded-lg border bg-background pe-8 ps-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        {query && (
          <button type="button" aria-label="ניקוי החיפוש" onClick={() => setQuery("")} className="absolute left-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-muted">
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </form>
      {words.length > 0 && (
        <div className="space-y-1 rounded-lg border bg-card p-1" data-testid="editor-search-results">
          {found.length ? found.map((p) => (
            <button key={p.id} type="button" onClick={() => go(p)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-right text-sm hover:bg-muted">
              <span className="font-medium">{p.label}</span>
              <span className="text-xs text-muted-foreground">{p.group}</span>
            </button>
          )) : <p className="px-2 py-1 text-xs text-muted-foreground">לא נמצא. נסו מילה אחרת.</p>}
        </div>
      )}
      {/* Where one is, each step a way back - and the tabs one click away, as a line of words. */}
      <nav aria-label="איפה אני בעורך" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" data-testid="editor-where">
        {groups.map((g) => (
          <button key={g.tab} type="button" onClick={() => setTab(g.tab)} aria-current={tab === g.tab ? "true" : undefined}
            className={`rounded px-1.5 py-0.5 ${tab === g.tab ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            {g.label}
          </button>
        ))}
        {here && <span className="ms-auto text-muted-foreground">עכשיו: <b className="text-foreground">{group!.label} › {here.label}</b></span>}
      </nav>
    </div>
  );
}
