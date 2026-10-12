import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "./Notice";
import { frameLabel, type FrameId } from "@/tv/frameLooks";
import type { CustomBox } from "@/tv/config";
import { readabilityIssues, type ReadabilityIssue } from "@/tv/readability";


/**
 * Under the preview: where the board is hard to read, measured on the board
 * as drawn after each change. A click on a place opens its box's text.
 */
export function ReadabilityNote({
  watch,
  customBoxes,
  onFix,
}: {
  watch: unknown;
  customBoxes: CustomBox[];
  onFix: (frame: string | null) => void;
}) {
  const nameOf = (frame: string) => frameLabel(frame as FrameId, customBoxes);
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
    <Notice variant="warning" className="mt-2" data-testid="readability">
      <button type="button" className="flex w-full items-center gap-1 text-right font-medium" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="flex-1">
          בדיקת קריאוּת: {issues.length === 1 ? "מקום אחד" : `${issues.length} מקומות`} שקשה לקרוא מרחוק
        </span>
        <ChevronDown className={`size-4 shrink-0 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1">
          {issues.map((i) => (
            <li key={i.where} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="flex-1">
                {i.where} - הטקסט כמעט באותו גוון כמו הרקע (ניגוד {i.ratio} מתוך 21; צריך לפחות 3)
              </span>
              <Button type="button" variant="link" size="sm" className="h-6 px-0 text-xs" onClick={() => onFix(i.frame)}>
                לתיקון
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Notice>
  );
}
