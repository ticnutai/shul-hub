import { memo } from "react";
import { cn } from "@/lib/utils";
import type { AliyahDivision, AliyahSpan } from "@/utils/aliyot";

/** What the reader is looking at within the parsha. */
export type AliyahSelection = null | "reading" | "haftarah" | string;

interface AliyotBarProps {
  division: AliyahDivision;
  onDivisionChange: (d: AliyahDivision) => void;
  spans: AliyahSpan[];
  selected: AliyahSelection;
  onSelect: (s: AliyahSelection) => void;
  /** Vezot Haberakhah has no haftarah of its own, and no maftir. */
  hasHaftarah: boolean;
  /** What this coming Shabbat changes: a doubled parsha, a special maftir */
  notes?: string[];
}

const DIVISIONS: Array<{ id: AliyahDivision; label: string; title: string }> = [
  { id: "none", label: "פרקים", title: "חלוקה לפרקים בלבד" },
  { id: "shabbat", label: "שבת", title: "שבעה קרואים, מפטיר והפטרה" },
  { id: "weekday", label: "שני וחמישי", title: "שלושה קרואים: כהן, לוי, ישראל" },
];

const Chip = ({
  active,
  onClick,
  children,
  title,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  testId?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-pressed={active}
    data-testid={testId}
    className={cn(
      "shrink-0 rounded-full border px-3 py-1 text-sm font-medium transition-colors whitespace-nowrap",
      active
        ? "bg-primary text-primary-foreground border-primary shadow-sm"
        : "bg-card/60 text-foreground border-border hover:bg-accent/15 hover:border-accent/50",
    )}
  >
    {children}
  </button>
);

export const AliyotBar = memo(({ division, onDivisionChange, spans, selected, onSelect, hasHaftarah, notes }: AliyotBarProps) => (
  <div
    dir="rtl"
    data-layout="aliyot-bar"
    data-layout-label="חלוקה לעליות"
    className="mb-3 rounded-xl border border-accent/20 bg-card/40 px-2 py-2 shadow-sm"
  >
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground shrink-0 ps-1">חלוקה</span>
      <div role="radiogroup" aria-label="חלוקה" className="inline-flex rounded-lg border border-border bg-background/60 p-0.5">
        {DIVISIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={division === d.id}
            title={d.title}
            data-testid={`aliyot-division-${d.id}`}
            onClick={() => onDivisionChange(d.id)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
              division === d.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {d.label}
          </button>
        ))}
      </div>
    </div>

    {division !== "none" && spans.length > 0 && (
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]" role="toolbar" aria-label="עליות">
        <Chip active={selected === null} onClick={() => onSelect(null)} testId="aliyah-all">כל הפרשה</Chip>
        {division === "weekday" && (
          <Chip active={selected === "reading"} onClick={() => onSelect("reading")} testId="aliyah-reading">
            כל הקריאה
          </Chip>
        )}
        {spans.map((s) => (
          <Chip
            key={s.key}
            active={selected === s.key}
            onClick={() => onSelect(s.key)}
            title={`${s.verses} פסוקים`}
            testId={`aliyah-${s.key}`}
          >
            {s.label}
          </Chip>
        ))}
        {division === "shabbat" && hasHaftarah && (
          <Chip active={selected === "haftarah"} onClick={() => onSelect("haftarah")} testId="aliyah-haftarah">
            הפטרה
          </Chip>
        )}
      </div>
    )}

    {division !== "none" && notes?.map((n) => (
      <p key={n} className="mt-1.5 px-1 text-xs text-muted-foreground">{n}</p>
    ))}
  </div>
));
AliyotBar.displayName = "AliyotBar";
