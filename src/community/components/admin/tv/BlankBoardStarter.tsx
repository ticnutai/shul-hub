import { useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  { id: "design-sets", label: "שמירה כערכה שלי" },
] as const;
export type BuildStep = (typeof BUILD_STEPS)[number]["id"];

/**
 * "התחלה מחדש" - the one place to start the board over, three ways:
 *  - a blank board: tick what it shows, then arrange and dress it step by
 *    step (blankBoard.ts);
 *  - the system's ordinary board: its look and screens as a new board's
 *    (standardBoard);
 *  - everything deleted: the whole board as a new synagogue's - wording,
 *    logos, occasions and galleries with it.
 * The first two keep what the shul has collected. All three are a draft
 * until "שמור ושדר", and a step back (Ctrl+Z) undoes them; once saved, the
 * board before is in "גרסאות קודמות". It was two things in two tabs - this,
 * and a "reset" in "כלים" that said it reset the colours and deleted it all.
 */
export function BlankBoardStarter({
  onCreate,
  onStandard,
  onWipe,
  unavailable,
}: {
  onCreate: (blocks: BlockId[]) => void;
  onStandard: () => void;
  onWipe: () => void;
  /** Why it is not offered now: starting over is for the whole board, not one kind of screen or an occasion. */
  unavailable?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<BlockId[]>([...STARTER_DEFAULT]);
  const toggle = (id: BlockId) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const fixed = STARTER_BLOCKS.filter((id) => BLOCK_BY_ID[id].chrome || BLOCK_BY_ID[id].zone !== "main");
  const content = STARTER_BLOCKS.filter((id) => !fixed.includes(id));
  const hasContent = chosen.some((id) => content.includes(id));

  if (unavailable)
    return (
      <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground" data-testid="blank-board">
        {unavailable}
      </p>
    );

  if (!open)
    return (
      <div className="flex flex-wrap items-center gap-2" data-testid="blank-board">
        <Button type="button" onClick={() => setOpen(true)}>
          לוח ריק - בוחרים מה יופיע
        </Button>
        <Confirm
          trigger={
            <Button type="button" variant="outline">
              הלוח הרגיל של המערכת
            </Button>
          }
          title="לחזור ללוח הרגיל של המערכת?"
          text="המראה והמסכים יחזרו להיות כמו בלוח חדש. הנוסחים, הלוגואים, המועדים, הגלריות והערכות שלכם נשארים."
          action="חזרה ללוח הרגיל"
          onConfirm={onStandard}
        />
        <Confirm
          trigger={
            <Button type="button" variant="ghost" className="text-destructive">
              מחיקת הכול
            </Button>
          }
          title="למחוק את כל ההגדרות של הלוח?"
          text='הכול חוזר להיות כמו בבית כנסת חדש: המראה והמסכים, וגם הנוסחים, הלוגואים, המועדים, התמונות, הגלריות, הערכות והתיבות שלכם. המניינים, ההודעות והשיעורים לא נמחקים. זו טיוטה עד "שמור ושדר"; אחרי שמירה אפשר להחזיר מ"גרסאות קודמות" בלשונית "כלים".'
          action="מחיקת הכול"
          destructive
          onConfirm={onWipe}
        />
        <p className="w-full text-[11px] text-muted-foreground">הכול טיוטה עד "שמור ושדר", ו"צעד אחורה" (Ctrl+Z) מחזיר.</p>
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

/** Asked before it is done, the same way for each way to start over. */
function Confirm({
  trigger,
  title,
  text,
  action,
  destructive = false,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  text: string;
  action: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{text}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>ביטול</AlertDialogCancel>
          <AlertDialogAction
            className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            onClick={onConfirm}
          >
            {action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
