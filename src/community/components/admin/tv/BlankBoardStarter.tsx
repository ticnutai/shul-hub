import { useState } from "react";
import { confirmAction } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Notice } from "./Notice";
import { BLOCK_BY_ID } from "@/tv/blocks";
import { STARTER_BLOCKS, STARTER_DEFAULT } from "@/tv/blankBoard";
import type { BlockId } from "@/tv/config";
import { WIPE_GROUPS, type WipeGroup } from "@/tv/wipeGroups";

/** The steps after a new board, in order: what stands where, then the look. */
const BUILD_STEPS = [
  { id: "arrange", label: "סידור על המסך" },
  { id: "design-background", label: "רקע" },
  { id: "design-boxes", label: "תיבות" },
  { id: "design-frames", label: "מסגרות" },
  { id: "design-text", label: "טקסט" },
  { id: "design-sets", label: "שמירה כערכה שלי" },
] as const;
export type BuildStep = (typeof BUILD_STEPS)[number]["id"];

/**
 * "התחלה מחדש" - the one place to start the board over, two ways:
 *  - a blank board: tick what it shows (the usual five ticked to begin with -
 *    what was once a button of its own, "הלוח הבסיסי של המערכת", the same
 *    board twice), then arrange and dress it step by step (blankBoard.ts);
 *  - deleting: tick which of the board's settings go back to a new
 *    synagogue's - the look, the screens, the wording, the logos, the
 *    occasions... (wipeGroups.ts) - and say yes to the list of them.
 * Both are a draft until "שמור ושדר", and a step back (Ctrl+Z) undoes them;
 * once saved, the board before is in "גרסאות קודמות". (A kit of parts also
 * has "איפוס הערכה הנוכחית", in the layout tab: that kit's parts back to how
 * the kit has them - not a new board.)
 */
export function BlankBoardStarter({
  onCreate,
  onWipe,
  unavailable,
}: {
  onCreate: (blocks: BlockId[]) => void;
  onWipe: (groups: WipeGroup[]) => void;
  /** Why it is not offered now: starting over is for the whole board, not one kind of screen or an occasion. */
  unavailable?: string | null;
}) {
  const [open, setOpen] = useState<"blank" | "wipe" | null>(null);
  const [chosen, setChosen] = useState<BlockId[]>([...STARTER_DEFAULT]);
  const toggle = (id: BlockId) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const fixed = STARTER_BLOCKS.filter((id) => BLOCK_BY_ID[id].chrome || BLOCK_BY_ID[id].zone !== "main");
  const content = STARTER_BLOCKS.filter((id) => !fixed.includes(id));
  const hasContent = chosen.some((id) => content.includes(id));

  if (unavailable)
    return (
      <Notice variant="neutral" className="text-xs" data-testid="blank-board">
        {unavailable}
      </Notice>
    );

  if (!open)
    return (
      <div className="flex flex-wrap items-center gap-2" data-testid="blank-board">
        <Button type="button" onClick={() => setOpen("blank")}>
          לוח ריק - בוחרים מה יופיע
        </Button>
        <Button type="button" variant="ghost" className="text-destructive" onClick={() => setOpen("wipe")}>
          מחיקה - בוחרים מה למחוק
        </Button>
        <p className="w-full text-[11px] text-muted-foreground">הכול טיוטה עד "שמור ושדר", ו"צעד אחורה" (Ctrl+Z) מחזיר.</p>
      </div>
    );

  if (open === "wipe") return <WipeChooser onWipe={onWipe} onClose={() => setOpen(null)} />;

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
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => setChosen([...STARTER_BLOCKS])}>בחירת הכל</Button>
        <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => setChosen([])}>ניקוי הכל</Button>
        <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => setChosen([...STARTER_DEFAULT])}
          title="שם בית הכנסת, שעון, תפילות, זמני היום והשורה התחתונה">הבחירה הרגילה</Button>
      </div>
      {group("התוכן", content)}
      {group("למעלה ולמטה", fixed)}
      {!hasContent && <Notice variant="warning" className="p-2 text-xs">בחרו לפחות דבר אחד מהתוכן - מסך בלי תוכן לא מוצג.</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!hasContent}
          onClick={() => {
            onCreate(chosen);
            setOpen(null);
          }}
        >
          יצירת לוח ריק עם מה שבחרתי
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(null)}>
          ביטול
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        העיצוב והסידור מתאפסים; הנוסחים, הלוגואים, המועדים והגלריות שלכם נשארים. שום דבר לא נשמר עד "שמור ושדר".
      </p>
    </div>
  );
}

/**
 * Deleting by groups: each of the board's settings ticked or not, all or
 * none at once, and the list of what goes asked about before it goes.
 */
function WipeChooser({ onWipe, onClose }: { onWipe: (groups: WipeGroup[]) => void; onClose: () => void }) {
  const [picked, setPicked] = useState<WipeGroup[]>([]);
  const flip = (id: WipeGroup) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const names = WIPE_GROUPS.filter((g) => picked.includes(g.id)).map((g) => g.name);
  const wipe = async () => {
    const all = picked.length === WIPE_GROUPS.length;
    const ok = await confirmAction({
      title: all ? "למחוק את כל ההגדרות של הלוח?" : `למחוק ${names.length === 1 ? "את" : `${names.length} דברים:`} ${names.join(", ")}?`,
      description: `${all ? "הלוח יחזור להיות כמו בבית כנסת חדש. " : `יימחקו: ${names.join(", ")}. כל השאר נשאר כמו שהוא. `}המניינים, ההודעות והשיעורים לא נמחקים. זו טיוטה עד "שמור ושדר"; אחרי שמירה אפשר להחזיר מ"גרסאות קודמות" בלשונית "כלים".`,
      confirmLabel: "מחיקה",
      destructive: true,
    });
    if (!ok) return;
    onWipe(WIPE_GROUPS.map((g) => g.id).filter((id) => picked.includes(id)));
    onClose();
  };
  return (
    <div className="space-y-3 rounded-lg border-2 border-destructive/40 p-3" data-testid="wipe-chooser">
      <div className="text-sm font-semibold">מה למחוק? כל מה שתסמנו יחזור להיות כמו בבית כנסת חדש</div>
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => setPicked(WIPE_GROUPS.map((g) => g.id))}>בחירת הכל</Button>
        <Button type="button" variant="outline" size="sm" className="h-7" onClick={() => setPicked([])}>ניקוי הכל</Button>
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {WIPE_GROUPS.map((g) => (
          <label key={g.id} className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm ${picked.includes(g.id) ? "border-destructive bg-destructive/5" : ""}`}>
            <input type="checkbox" className="mt-0.5" checked={picked.includes(g.id)} onChange={() => flip(g.id)} aria-label={g.name} />
            <span>
              <span className="block font-medium">{g.name}</span>
              <span className="block text-[11px] text-muted-foreground">{g.note}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="destructive" disabled={!picked.length} onClick={() => void wipe()}>
          מחיקת מה שנבחר{picked.length ? ` (${picked.length})` : ""}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>ביטול</Button>
      </div>
      <p className="text-[11px] text-muted-foreground">המניינים, ההודעות והשיעורים לא נמחקים אף פעם מכאן.</p>
    </div>
  );
}

/** After a new board: the steps that are left, each a click away, with the one done so far marked. */
export function BuildGuide({ done, onStep, onClose }: { done: BuildStep[]; onStep: (s: BuildStep) => void; onClose: () => void }) {
  return (
    <Notice
      variant="info"
      data-testid="build-guide"
      actions={
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClose}>
          סגירה
        </Button>
      }
    >
      <p className="mb-2 text-sm font-semibold">הלוח החדש נוצר. הצעדים הבאים:</p>
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
    </Notice>
  );
}
