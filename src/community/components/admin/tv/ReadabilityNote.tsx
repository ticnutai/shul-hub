import { useEffect, useState } from "react";
import { FRAME_LABELS, type FrameId } from "@/tv/frameLooks";
import { readabilityIssues, type ReadabilityIssue } from "@/tv/readability";

const nameOf = (frame: string) => FRAME_LABELS[frame as FrameId] ?? "תיבה";

/**
 * Under the preview: where the board is hard to read, measured on the board
 * as drawn after each change. A click on a place opens its box's text.
 */
export function ReadabilityNote({ watch, onFix }: { watch: unknown; onFix: (frame: string | null) => void }) {
  const [issues, setIssues] = useState<ReadabilityIssue[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // After the board has drawn the change (fonts, colours, the preview's own frames).
    const t = window.setTimeout(() => {
      const root = document.querySelector<HTMLElement>("[data-board-preview] .tv-frame .tv-root");
      setIssues(root ? readabilityIssues(root, nameOf) : []);
    }, 700);
    return () => window.clearTimeout(t);
  }, [watch]);

  if (!issues.length) return null;
  return (
    <div className="mt-2 rounded-lg border border-amber-500/60 bg-amber-500/10 p-2 text-sm" data-testid="readability">
      <button type="button" className="w-full text-right font-medium" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        ⚠️ בדיקת קריאוּת: {issues.length === 1 ? "מקום אחד" : `${issues.length} מקומות`} שקשה לקרוא מרחוק {open ? "▲" : "▼"}
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1">
          {issues.map((i) => (
            <li key={i.where} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="flex-1">
                {i.where} - הטקסט כמעט באותו גוון כמו הרקע (ניגוד {i.ratio} מתוך 21; צריך לפחות 3)
              </span>
              <button type="button" className="underline" onClick={() => onFix(i.frame)}>
                לתיקון
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
