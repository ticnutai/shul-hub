import type { BoardElement } from '@/tv/elements';
import { DEFAULT_NEXT_MARK, NEXT_SHAPES, NEXT_SHAPE_NAMES, markAlpha, marksNext, type NextMark } from '@/tv/nextMark';
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
      <p className="text-xs font-semibold">סימון "הבא בתור"</p>
      <p className="text-[11px] text-muted-foreground">המניין, השיעור או הזמן הבא מסומן. ברגע שהזמן שלו עובר, הסימון עובר לבא אחריו.</p>
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
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" aria-label="עמעום מה שעבר" checked={mark.dimPast !== false} onChange={ev => set({ ...mark, dimPast: ev.target.checked ? undefined : false })} />
            עמעום מה שכבר עבר
          </label>
        </div>
      )}
      {everyList.length > lists.length && (
        <button type="button" className="rounded border px-2 py-1 text-xs hover:border-primary/50"
          onClick={() => onPatch(everyList.map(e => e.id), { nextMark: mark }, 'nextMark-all')}>
          אותו סימון לכל הרשימות בלוח ({everyList.length})
        </button>
      )}
    </div>
  );
}
