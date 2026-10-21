/**
 * The content of a live part - the prayers, the lessons, the times of the
 * day, the notices - in the panel by the board ("התוכן"): how many rows to a
 * page, what happens when they do not fit (pages that take turns, and how
 * long each stays; or a slow scroll), which times of the day it shows, and
 * the way to where its words come from (the minyanim, the lessons, the
 * notices of the site), opened beside the editor.
 */
import { ExternalLink } from "lucide-react";
import { InfoTip } from "@/components/InfoTip";
import type { TvConfig } from "@/tv/config";
import { BINDING_LABELS, SCROLLABLE, type BoardElement, type ElementBinding } from "@/tv/elements";
import { ZMAN_DISPLAY_KEYS, ZMAN_DISPLAY_LABELS } from "@/community/lib/zmanim";
import { FIT_CHOICES, Segments, Stepper } from "./editorParts";

const LISTS: ElementBinding[] = ["prayers", "lessons", "zmanim"];
const SECONDS = [3, 5, 10, 15, 30, 60, 120] as const;
const secondsName = (s: number) => (s < 60 ? `${s} שניות` : s === 60 ? "דקה" : `${s / 60} דקות`);

/** Where a part's words are written: the gabbai's section of the site, opened in a tab of its own (the editor stays as it is). */
const SOURCES: Partial<Record<ElementBinding, { tab: string; label: string }>> = {
  prayers: { tab: "minyanim", label: "עריכת המניינים" },
  lessons: { tab: "shiurim", label: "עריכת השיעורים" },
  announcements: { tab: "announcements", label: "עריכת המודעות" },
};

/** The parts the tab is for: those chosen, else the container's own - each a live list or paragraph. */
export const liveParts = (elements: BoardElement[]) => elements.filter((e) => e.binding && SCROLLABLE.includes(e.binding) && !e.locked);

export function LiveListTools({ parts, config, onPatch }: {
  parts: BoardElement[];
  config: TvConfig;
  onPatch: (id: string, patch: Partial<BoardElement>, what: string) => void;
}) {
  return (
    <div className="space-y-3" data-testid="ctx-content">
      {parts.map((e) => {
        const binding = e.binding as ElementBinding;
        const list = LISTS.includes(binding);
        const paged = !e.scroll;
        const seconds = e.pageSeconds ?? 15;
        const source = SOURCES[binding];
        const zmanim = binding === "zmanim" ? e.zmanKeys ?? ZMAN_DISPLAY_KEYS.filter((k) => !config.hidden.includes(`zman.${k}`)) : [];
        return (
          <div key={e.id} className="space-y-2 text-xs" data-content-part={binding}>
            {parts.length > 1 && <p className="font-semibold">{BINDING_LABELS[binding]}</p>}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {list && (
                <label className="flex items-center gap-1.5">
                  שורות בעמוד
                  <Stepper label={`שורות בעמוד של ${BINDING_LABELS[binding]}`} value={e.rowsPerPage ?? 3} min={1} max={30} step={1}
                    onChange={(v) => onPatch(e.id, { rowsPerPage: v }, "rows")} />
                </label>
              )}
              <span className="flex flex-wrap items-center gap-1.5">
                כשלא נכנס
                <Segments label={`כשהתוכן לא נכנס ב${BINDING_LABELS[binding]}`} value={e.scroll ?? ""}
                  onChange={(v) => onPatch(e.id, { scroll: (v || undefined) as BoardElement["scroll"] }, "fit")} options={FIT_CHOICES(binding)} />
                <InfoTip>"בלי גלילה": רשימה מתחלקת לעמודים שמתחלפים, ופסקה מוקטנת כדי שתיכנס. גלילה: התוכן זז לאט, כך שהכול עובר מול הקהל. חל על החלק הזה בלבד.</InfoTip>
              </span>
            </div>
            {list && paged && (
              <div className="flex flex-wrap items-center gap-1.5">
                כל עמוד מוצג
                <span className="inline-flex flex-wrap gap-1" role="radiogroup" aria-label={`כמה זמן מוצג כל עמוד של ${BINDING_LABELS[binding]}`}>
                  {SECONDS.map((s) => (
                    <button key={s} type="button" role="radio" aria-checked={seconds === s} onClick={() => onPatch(e.id, { pageSeconds: s }, "seconds")}
                      className={`h-7 rounded-md border px-2 ${seconds === s ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/50"}`}>
                      {secondsName(s)}
                    </button>
                  ))}
                </span>
                <Stepper label={`שניות לכל עמוד של ${BINDING_LABELS[binding]}`} value={seconds} min={3} max={600} step={1} format={(v) => `${v} שניות`}
                  onChange={(v) => onPatch(e.id, { pageSeconds: v }, "seconds")} />
              </div>
            )}
            {binding === "zmanim" && (
              <div className="space-y-1" data-testid="ctx-zmanim">
                <span className="flex items-center gap-1">
                  אילו זמנים
                  <InfoTip>מג״א מחושב לפי 72 דקות קבועות לפני הנץ ואחרי השקיעה. הגר״א מחושב מהנץ לשקיעה. הזמנים עצמם מחושבים לפי המיקום של בית הכנסת, ולכן אי אפשר לשנות אותם - רק לבחור אילו מוצגים.</InfoTip>
                </span>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {ZMAN_DISPLAY_KEYS.map((key) => (
                    <label key={key} className="flex items-center gap-1.5">
                      <input type="checkbox" checked={zmanim.includes(key)}
                        onChange={(ev) => onPatch(e.id, { zmanKeys: ev.target.checked ? [...zmanim, key] : zmanim.filter((k) => k !== key) }, "zman-keys")} />
                      {ZMAN_DISPLAY_LABELS[key]}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {source && (
              <a href={`/community/admin?tab=${source.tab}`} target="_blank" rel="noreferrer"
                className="inline-flex h-7 items-center gap-1 rounded-md border px-2 hover:border-primary/50" data-testid={`ctx-source-${binding}`}>
                <ExternalLink className="size-3.5" aria-hidden /> {source.label}
                <span className="text-muted-foreground">- נפתח בלשונית חדשה, והלוח מתעדכן לבד</span>
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
