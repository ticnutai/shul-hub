/**
 * All the parts of one kind at once - every text, every frame... - to change
 * them together (a colour, a font). Used in the list of parts and under the
 * board's preview, where the board is edited directly: one piece, both places.
 */
import type { BoardElement } from '@/tv/elements';
import { choiceChipClass } from './Notice';

/** The kinds the parts are chosen by, all of one at a time. */
export const KIND_GROUPS: ReadonlyArray<readonly [string, ReadonlyArray<BoardElement['kind']>]> = [
  ['כל הטקסטים', ['text']],
  ['כל המסגרות', ['frame']],
  ['כל התיבות', ['box']],
  ['כל התמונות', ['image']],
  ['כל העיטורים והעמודים', ['ornament', 'column']],
];

/** "טקסטים" of "כל הטקסטים": the kind's name, for the lines that speak of it. */
export const kindName = (kind: number) => KIND_GROUPS[kind][0].replace('כל ה', '');

/** The parts of one kind (or all of them, with none). */
export const ofKind = (elements: BoardElement[], kind: number | null) =>
  kind === null ? elements : elements.filter(x => KIND_GROUPS[kind][1].includes(x.kind));

/** A part drawn from a picture: a colour or a fill is not painted on it. */
const paintless = (e: BoardElement | undefined) => !!e && (e.kind === 'image' || (e.kind === 'frame' && !!e.image));

/**
 * The buttons, one per kind, with how many there are. A press chooses them
 * all and reports the kind (for a list to show that kind alone); with Shift it
 * adds them to what is chosen, and reports no kind.
 */
export function KindPicker({ elements, selected, select, onKind, testId = 'elements-by-kind' }: {
  elements: BoardElement[];
  selected: string[];
  select: (ids: string[]) => void;
  onKind: (kind: number | null) => void;
  testId?: string;
}) {
  const picture = selected.filter(id => paintless(elements.find(x => x.id === id))).length;
  const locked = elements.filter(x => selected.includes(x.id) && x.locked).length;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="בחירה לפי סוג" data-testid={testId}>
        <span className="text-muted-foreground">בחירה לפי סוג:</span>
        {KIND_GROUPS.map(([label, kinds], i) => {
          const ids = elements.filter(x => kinds.includes(x.kind) && !x.hidden).map(x => x.id);
          const all = ids.length > 0 && ids.every(id => selected.includes(id));
          return (
            <button key={label} type="button" disabled={!ids.length} aria-pressed={all}
              title="לחיצה בוחרת את כולם. Shift + לחיצה - מוסיף אותם למה שכבר נבחר."
              onClick={ev => {
                // The first one able to take a colour leads, so the panel offers the colour.
                const lead = [...ids].sort((a, b) => Number(paintless(elements.find(x => x.id === a))) - Number(paintless(elements.find(x => x.id === b))));
                select(ev.shiftKey ? [...new Set([...selected, ...lead])] : lead);
                onKind(ev.shiftKey ? null : i);
              }}
              className={choiceChipClass(all, 'text-xs disabled:opacity-40')}>
              {label} ({ids.length})
            </button>
          );
        })}
      </div>
      {selected.length > 1 && (picture > 0 || locked > 0) && (
        <p className="text-[11px] text-muted-foreground" data-testid={`${testId}-note`}>
          {picture > 0 && `${picture} מהנבחרים עשויים מתמונה: צבע ומילוי לא חלים עליהם - את הגוונים שלהם מכוונים בכלי התמונה. `}
          {locked > 0 && `${locked} נעולים, ולא ישתנו עד שישוחררו.`}
        </p>
      )}
    </div>
  );
}

/**
 * The parts of the kind chosen, each with its box: take some off, choose all
 * of them again, or clear - and back to every kind.
 */
export function KindChecklist({ elements, kind, selected, select, onClose }: {
  elements: BoardElement[];
  kind: number;
  selected: string[];
  select: (ids: string[]) => void;
  onClose: () => void;
}) {
  const listed = ofKind(elements, kind);
  const ids = listed.map(x => x.id);
  const every = ids.length > 0 && ids.every(id => selected.includes(id));
  return (
    <div className="space-y-1.5 rounded-md border bg-muted/30 p-2 text-xs" data-testid="kind-checklist">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{kindName(kind)} ({listed.length})</span>
        <button type="button" className="rounded border bg-background px-2 py-0.5" disabled={every}
          onClick={() => select([...new Set([...selected, ...ids])])}>בחירת כל ה{kindName(kind)}</button>
        <button type="button" className="rounded border bg-background px-2 py-0.5" disabled={!selected.length}
          onClick={() => select([])}>ניקוי הבחירה</button>
        <button type="button" className="ms-auto font-medium text-primary underline underline-offset-2" onClick={onClose}>סגירת הרשימה</button>
      </div>
      <div className="grid max-h-48 grid-cols-1 gap-0.5 overflow-y-auto sm:grid-cols-2">
        {[...listed].reverse().map(e => (
          <label key={e.id} className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 ${selected.includes(e.id) ? 'bg-primary/10' : ''}`}>
            <input type="checkbox" className="size-4 shrink-0" aria-label={`סימון ${e.name}`} checked={selected.includes(e.id)}
              onChange={ev => select(ev.target.checked ? [...new Set([...selected, e.id])] : selected.filter(id => id !== e.id))} />
            <span className={`truncate ${e.hidden ? 'text-muted-foreground line-through' : ''}`}>{e.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
