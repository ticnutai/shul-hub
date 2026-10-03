import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BLOCK_BY_ID } from "@/tv/blocks";
import { STARTER_BLOCKS, STARTER_DEFAULT } from "@/tv/blankBoard";
import type { BlockId } from "@/tv/config";

/** The steps after a new board, in order: what stands where, then the look. */
export const BUILD_STEPS = [
  { id: "arrange", label: "סידור על המסך" },
  { id: "design-background", label: "רקע" },
  { id: "design-boxes", label: "תיבות" },
  { id: "design-frames", label: "מסגרות" },
  { id: "design-text", label: "טקסט" },
  { id: "design-sets", label: "שמירה כערכה" },
] as const;
export type BuildStep = (typeof BUILD_STEPS)[number]["id"];

/**
 * "התחלה מאפס": the gabbai ticks what the board shows, and gets one screen
 * with only that on it and the plainest look (blankBoard.ts). Undo brings
 * the board back; nothing is saved until "שמור ושדר".
 */
export function BlankBoardStarter({ onCreate }: { onCreate: (blocks: BlockId[]) => void }) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<BlockId[]>([...STARTER_DEFAULT]);
  const toggle = (id: BlockId) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const fixed = STARTER_BLOCKS.filter((id) => BLOCK_BY_ID[id].chrome || BLOCK_BY_ID[id].zone !== "main");
  const content = STARTER_BLOCKS.filter((id) => !fixed.includes(id));
  const hasContent = chosen.some((id) => content.includes(id));

  if (!open)
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-dashed border-primary/40 p-3" data-testid="blank-board">
        <Button type="button" onClick={() => setOpen(true)}>
          התחלה מאפס - לוח ריק
        </Button>
        <p className="flex-1 text-xs text-muted-foreground">
          בוחרים קודם מה יופיע על הלוח, ואז מסדרים ומעצבים צעד אחרי צעד. אפשר לבטל בכל רגע ב"ביטול שינויים".
        </p>
      </div>
    );

  const group = (title: string, ids: readonly BlockId[]) => (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-semibold">{title}</legend>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {ids.map((id) => (
          <label
            key={id}
            className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm ${chosen.includes(id) ? "border-primary bg-primary/5" : ""}`}
          >
            <input type="checkbox" className="mt-0.5" checked={chosen.includes(id)} onChange={() => toggle(id)} />
            <span>
              <span className="block font-medium">{BLOCK_BY_ID[id].name}</span>
              {BLOCK_BY_ID[id].note && <span className="block text-[11px] text-muted-foreground">{BLOCK_BY_ID[id].note}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    <div className="space-y-3 rounded-lg border-2 border-primary/50 p-3" data-testid="blank-board">
      <div className="text-sm font-semibold">לוח חדש - שלב 1: מה יופיע על הלוח?</div>
      {group("התוכן", content)}
      {group("למעלה ולמטה", fixed)}
      {!hasContent && <p className="text-xs text-amber-700 dark:text-amber-400">בחרו לפחות דבר אחד מהתוכן - מסך בלי תוכן לא מוצג.</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!hasContent}
          onClick={() => {
            onCreate(chosen);
            setOpen(false);
          }}
        >
          יצירת לוח ריק עם מה שבחרתי
        </Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          ביטול
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        העיצוב והסידור מתאפסים; הנוסחים, הלוגואים, המועדים והגלריות שלכם נשארים. שום דבר לא נשמר עד "שמור ושדר".
      </p>
    </div>
  );
}

/** After a new board: the steps that are left, each a click away, with the one done so far marked. */
export function BuildGuide({ done, onStep, onClose }: { done: BuildStep[]; onStep: (s: BuildStep) => void; onClose: () => void }) {
  return (
    <div className="space-y-2 rounded-lg border-2 border-emerald-500/50 bg-emerald-500/5 p-3" data-testid="build-guide">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm font-semibold">הלוח החדש נוצר. הצעדים הבאים:</span>
        <button type="button" className="text-xs underline" onClick={onClose}>
          סגירה
        </button>
      </div>
      <ol className="flex flex-wrap gap-1.5">
        {BUILD_STEPS.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onStep(s.id)}
              className={`h-8 rounded-md border px-2.5 text-xs font-medium ${done.includes(s.id) ? "border-emerald-600 bg-emerald-600 text-white" : "bg-background hover:border-primary/50"}`}
            >
              {done.includes(s.id) ? "✓ " : `${i + 1}. `}
              {s.label}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
