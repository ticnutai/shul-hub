import { InfoTip } from "@/components/InfoTip";
import type { BoardElement } from '@/tv/elements';
import { DEFAULT_NEXT_MARK, DEFAULT_PAST_OPACITY, NEXT_SHAPES, NEXT_SHAPE_NAMES, fadesPast, markAlpha, marksNext, pastOpacity, type NextMark } from '@/tv/nextMark';
import { ColourRow, Range, Segments } from './editorParts';

/**
 * "הבא בתור" on the chosen lists - prayers, lessons, the day's times: its
 * shape and colour, and whether what is over fades. "לכל הרשימות בלוח" gives
 * every list of the board the same look. One component, in the text bar
 * under the board and in the chosen part's panel (PartContextPanel).
 */
export function NextMarkTools({ elements, texts, onPatch }: {
  elements: BoardElement[];
  texts: BoardElement[];
  onPatch: (ids: string[], patch: Partial<BoardElement>, what: string) => void;
}) {
  const lists = texts.filter(e => marksNext(e.binding));
  if (!lists.length) return null;
  const mark = lists[0].nextMark ?? DEFAULT_NEXT_MARK;
  const set = (m: NextMark) => onPatch(lists.map(e => e.id), { nextMark: m }, 'nextMark');
  const everyList = elements.filter(e => e.kind === 'text' && marksNext(e.binding) && !e.locked);
  return (
    <div className="space-y-2 rounded-md border border-dashed p-2" role="group" aria-label="סימון הבא בתור" data-testid="next-mark-tools">
      <p className="flex items-center gap-1 text-xs font-semibold">הבא בתור
        <InfoTip>המניין, השיעור או הזמן הבא מסומן. ברגע שהזמן שלו עובר, הסימון עובר לבא אחריו.</InfoTip>
      </p>
      <Segments label="צורת הסימון" value={mark.shape} onChange={shape => set({ ...mark, shape })}
        options={NEXT_SHAPES.map(id => ({ id, name: NEXT_SHAPE_NAMES[id] }))} />
      {mark.shape !== 'none' && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-40">
            <ColourRow label="צבע הסימון" value={mark.color ?? lists[0].color} onChange={color => set({ ...mark, color })}
              reset={mark.color ? { label: 'כמו הטקסט', onClick: () => set({ ...mark, color: undefined }) } : undefined} />
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-2">
            <Range label="אטימות הסימון" value={Math.round(markAlpha(mark) * 100)} min={5} max={100} step={5} show={(v) => `${v}%`}
              onChange={v => set({ ...mark, alpha: v / 100 })} hint="כמה הסימון מלא: נמוך - שקוף ועדין, גבוה - מלא ובולט" />
            <Range label="רוויה" value={Math.round((mark.saturation ?? 1) * 100)} min={0} max={200} step={10} show={(v) => `${v}%`}
              onChange={v => set({ ...mark, saturation: v === 100 ? undefined : v / 100 })} hint="0% - אפור, 100% - הצבע שנבחר, 200% - חי במיוחד" />
          </div>
        </div>
      )}
      {/* What is over: its own part, apart from the mark - it fades with no mark at all too. */}
      <div className="space-y-1.5 border-t pt-2" data-testid="past-tools">
        <p className="flex items-center gap-1 text-xs font-semibold">מה שכבר עבר
          <InfoTip>תפילה, שיעור או זמן שהשעה שלהם עברה מוצגים דהויים, כדי שהעין תגיע מיד למה שעוד לפנינו. "כמה דהוי" קובע כמה רואים אותם.</InfoTip>
        </p>
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" aria-label="עמעום מה שעבר" checked={fadesPast(mark)} onChange={ev => set({ ...mark, dimPast: ev.target.checked })} />
          עמעום מה שכבר עבר
        </label>
        {fadesPast(mark) && (
          <Range label="כמה דהוי" value={Math.round((1 - pastOpacity(mark)) * 100)} min={10} max={85} step={5} show={(v) => `${v}%`}
            onChange={v => set({ ...mark, pastOpacity: Math.round((1 - v / 100) * 100) / 100 === DEFAULT_PAST_OPACITY ? undefined : Math.round((1 - v / 100) * 100) / 100 })}
            hint="נמוך - כמעט כמו השאר; גבוה - כמעט שקוף" />
        )}
      </div>
      {everyList.length > lists.length && (
        <button type="button" className="rounded border px-2 py-1 text-xs hover:border-primary/50"
          onClick={() => onPatch(everyList.map(e => e.id), { nextMark: mark }, 'nextMark-all')}>
          אותו סימון לכל הרשימות בלוח ({everyList.length})
        </button>
      )}
    </div>
  );
}
