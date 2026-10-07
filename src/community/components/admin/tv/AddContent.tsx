/**
 * Live content added to a board of parts - the one place it is done, in the
 * layout tab and in the list of parts alike:
 *
 *   in a frame of its own   a copy of the board's own frame (styledBox)
 *   instead of a frame's    that frame shows it now (setContent)
 *   into a frame, beside    under what the frame shows (addIntoFrame)
 *
 * Always in the kit's own letters and with nothing behind it; a panel behind,
 * another colour, are chosen afterwards.
 */
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  BINDING_LABELS, ELEMENT_BINDINGS, MAX_ELEMENTS, addContent, addIntoFrame, liveFrames, setContent,
  type BoardElement, type ElementBinding,
} from '@/tv/elements';

type Where = 'new' | 'replace' | 'into';
const SIDE_NAME = { right: 'ימין', center: 'אמצע', left: 'שמאל' } as const;

export function AddContent({ elements, onCommit }: {
  elements: BoardElement[];
  /** The board's parts after the addition, and the parts to select. */
  onCommit: (next: BoardElement[], key: string, select: string[]) => void;
}) {
  const [binding, setBinding] = useState<ElementBinding>('dafYomi');
  const [where, setWhere] = useState<Where>('new');
  const frames = liveFrames(elements).filter(f => !f.e.hidden);
  const [target, setTarget] = useState<string>('');
  const chosen = frames.find(f => f.e.id === target) ?? frames[0];
  const onBoard = new Set(frames.map(f => f.binding));
  const label = (f: (typeof frames)[number]) => `${f.title} (${SIDE_NAME[f.side]})`;

  const add = () => {
    const what = BINDING_LABELS[binding];
    if (where === 'new') {
      const added = addContent(elements, binding);
      if (elements.length + added.length > MAX_ELEMENTS) return void toast.error('עד 80 חלקים בלוח');
      onCommit([...elements, ...added], `add-content:new:${binding}`, added.map(e => e.id));
      return void toast.success(`נוספה מסגרת "${what}" באמצע הלוח, בסגנון של הלוח. בחרו לה צד ברשימה.`);
    }
    if (!chosen) return void toast.error('אין עדיין מסגרות על הלוח - בחרו "מסגרת חדשה".');
    if (where === 'replace') {
      onCommit(setContent(elements, chosen.e.id, binding), `add-content:replace:${chosen.e.id}`, chosen.ids);
      return void toast.success(`המסגרת "${chosen.title}" מציגה עכשיו ${what}.`);
    }
    if (elements.length + 1 > MAX_ELEMENTS) return void toast.error('עד 80 חלקים בלוח');
    if (chosen.e.locked) return void toast.error(`"${chosen.title}" נעול. שחררו אותו קודם.`);
    const next = addIntoFrame(elements, chosen.e.id, binding);
    const added = next.find(e => !elements.some(x => x.id === e.id));
    onCommit(next, `add-content:into:${chosen.e.id}`, added ? [added.id] : []);
    toast.success(`${what} נוסף בתוך "${chosen.title}", מתחת למה שהיה בה.`);
  };

  return (
    <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3" data-testid="add-content">
      <p className="text-sm font-semibold">הוספת תוכן</p>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="איזה תוכן להוסיף" value={binding} onChange={e => setBinding(e.target.value as ElementBinding)}
          className="h-9 min-w-0 flex-1 basis-40 rounded border bg-background px-2 text-sm">
          {ELEMENT_BINDINGS.map(b => <option key={b} value={b}>{BINDING_LABELS[b]}{onBoard.has(b) ? ' (כבר על הלוח)' : ''}</option>)}
        </select>
      </div>
      <div className="space-y-1.5 text-sm" role="radiogroup" aria-label="איפה להוסיף">
        {([
          ['new', 'במסגרת חדשה', 'העתק של המסגרות שעל הלוח, באמצע - ואז בוחרים לה צד'],
          ['replace', 'במקום התוכן של מסגרת קיימת', 'המסגרת נשארת, והתוכן שלה מתחלף'],
          ['into', 'בתוך מסגרת קיימת, בנוסף למה שיש בה', 'למשל הדף היומי מתחת לפרשת השבוע, באותה מסגרת'],
        ] as const).map(([id, name, hint]) => (
          <label key={id} className="flex cursor-pointer items-start gap-2">
            <input type="radio" name="add-content-where" className="mt-1" checked={where === id} onChange={() => setWhere(id)} />
            <span><span className="font-medium">{name}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
          </label>
        ))}
      </div>
      {where !== 'new' && (
        frames.length ? (
          <select aria-label="איזו מסגרת" value={chosen?.e.id ?? ''} onChange={e => setTarget(e.target.value)}
            className="h-9 w-full rounded border bg-background px-2 text-sm">
            {frames.map(f => <option key={f.e.id} value={f.e.id}>{label(f)}</option>)}
          </select>
        ) : <p className="text-xs text-muted-foreground">אין עדיין מסגרות עם תוכן על הלוח.</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={add} disabled={where !== 'new' && !frames.length}>הוספה</Button>
        <span className="text-xs text-muted-foreground">מגיע בסגנון של הלוח ובלי רקע. צבע, גופן ורקע - משנים אחר כך.</span>
      </div>
    </div>
  );
}
