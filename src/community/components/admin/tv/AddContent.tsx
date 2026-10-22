/**
 * Live content added to a board of parts - the one place it is done, in the
 * layout tab and in the list of parts alike:
 *
 *   in a frame of its own   a copy of one of the board's frames (styledBox) -
 *                            a side's arch, or the middle's wide frame
 *   instead of a frame's    that frame shows it now (setContent)
 *   into a frame, beside    under what the frame shows (addIntoFrame)
 *
 * and "התיבות שלי": frames the gabbai kept, put back as they were kept. New
 * content is written as the gabbai set once ("ברירת מחדל לתוכן חדש"), or in
 * the kit's own letters; never with a panel behind it unless asked. A kept
 * frame is deleted in one place, its tile's ✕ in "החלקים והתיבות שלי"
 * (ElementLibrary), not here as well.
 */
import { Hint } from "@/components/InfoTip";
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DEFAULT_ELEMENT_DEFAULTS, type ElementDefaults } from '@/tv/config';
import {
  BINDING_LABELS, ELEMENT_BINDINGS, ELEMENT_FONTS, MAX_ELEMENTS, addContent, withDefaults, readableInk, addIntoFrame, boundsOf, elementId, importElementSet,
  exportElementSet, liveFrames, setContent, styleSources, type BoardElement, type ElementBinding, type ElementFont, type SavedElementSet,
} from '@/tv/elements';
import { Folded } from './Parts';
import { ColourChoice, ResetButton, SELECT_CLASS } from './editorParts';

type Where = 'new' | 'replace' | 'into';
const SIDE_NAME = { right: 'ימין', center: 'אמצע', left: 'שמאל' } as const;
const SIZES = [[0.85, 'קטן'], [1, 'כמו בערכה'], [1.15, 'גדול'], [1.3, 'גדול מאוד']] as const;

export function AddContent({ elements, library, defaults, onCommit, onDefaults }: {
  elements: BoardElement[];
  /** "התיבות שלי": frames kept to be added again (the board's library of parts). */
  library: SavedElementSet[];
  defaults: ElementDefaults;
  /** The board's parts after the addition, and the parts to select. */
  onCommit: (next: BoardElement[], key: string, select: string[]) => void;
  onDefaults: (next: ElementDefaults) => void;
}) {
  const [what, setWhat] = useState<string>('dafYomi');
  const [where, setWhere] = useState<Where>('new');
  const frames = liveFrames(elements).filter(f => !f.e.hidden);
  const styles = styleSources(elements);
  const [target, setTarget] = useState<string>('');
  const [like, setLike] = useState<string>('');
  const chosen = frames.find(f => f.e.id === target) ?? frames[0];
  const onBoard = new Set(frames.map(f => f.binding));
  const label = (f: (typeof frames)[number]) => `${f.title} (${SIDE_NAME[f.side]})`;
  const box = what.startsWith('box:') ? library.find(l => `box:${l.id}` === what) : undefined;
  const binding = box ? null : (what as ElementBinding);

  const add = () => {
    if (box) {
      // One's own box, as it was kept: new ids, one group, in the middle of the board.
      const copies = importElementSet(exportElementSet(box.elements)).map(e => ({ ...e, locked: false, hidden: false }));
      if (elements.length + copies.length > MAX_ELEMENTS) return void toast.error('עד 80 חלקים בלוח');
      const b = boundsOf(copies, copies.map(e => e.id));
      const group = elementId();
      const moved = copies.map(e => ({ ...e, x: e.x + (50 - b.width / 2 - b.x), group }));
      // A box kept from a light board, put on a dark one: its letters made readable here.
      const placed = readableInk(moved, [...elements, ...moved]);
      onCommit([...elements, ...placed], `add-content:box:${box.id}`, placed.map(e => e.id));
      return void toast.success(`"${box.name}" נוספה באמצע הלוח. בחרו לה צד ברשימה.`);
    }
    if (!binding) return;
    const name = BINDING_LABELS[binding];
    if (where === 'new') {
      const made = withDefaults(addContent(elements, binding, like || undefined), defaults);
      const added = readableInk(made, [...elements, ...made]);
      if (elements.length + added.length > MAX_ELEMENTS) return void toast.error('עד 80 חלקים בלוח');
      onCommit([...elements, ...added], `add-content:new:${binding}`, added.map(e => e.id));
      return void toast.success(`נוספה מסגרת "${name}" באמצע הלוח, בסגנון של הלוח. בחרו לה צד ברשימה.`);
    }
    if (!chosen) return void toast.error('אין עדיין מסגרות על הלוח - בחרו "מסגרת חדשה".');
    if (where === 'replace') {
      onCommit(setContent(elements, chosen.e.id, binding), `add-content:replace:${chosen.e.id}`, chosen.ids);
      return void toast.success(`המסגרת "${chosen.title}" מציגה עכשיו ${name}.`);
    }
    if (elements.length + 1 > MAX_ELEMENTS) return void toast.error('עד 80 חלקים בלוח');
    if (chosen.e.locked) return void toast.error(`"${chosen.title}" נעול. שחררו אותו קודם.`);
    const before = new Set(elements.map(e => e.id));
    const placed = addIntoFrame(elements, chosen.e.id, binding);
    const next = placed.map(e => before.has(e.id) ? e : readableInk(withDefaults([e], defaults), placed)[0]);
    const added = next.find(e => !before.has(e.id));
    onCommit(next, `add-content:into:${chosen.e.id}`, added ? [added.id] : []);
    toast.success(`${name} נוסף בתוך "${chosen.title}", מתחת למה שהיה בה.`);
  };

  const setDefault = (patch: Partial<ElementDefaults>) => onDefaults({ ...defaults, ...patch });
  const customised = JSON.stringify(defaults) !== JSON.stringify(DEFAULT_ELEMENT_DEFAULTS);

  return (
    <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3" data-testid="add-content">
      <select aria-label="איזה תוכן להוסיף" value={what} onChange={e => setWhat(e.target.value)}
        className={`${SELECT_CLASS} w-full`}>
        <optgroup label="תוכן חי">
          {ELEMENT_BINDINGS.map(b => <option key={b} value={b}>{BINDING_LABELS[b]}{onBoard.has(b) ? ' (כבר על הלוח)' : ''}</option>)}
        </optgroup>
        {library.length > 0 && (
          <optgroup label="החלקים והתיבות שלי">
            {library.map(l => <option key={l.id} value={`box:${l.id}`}>{l.name}</option>)}
          </optgroup>
        )}
      </select>
      {box ? (
        <p className="text-xs text-muted-foreground">
          שמרתם אותה: נוספת כמו שנשמרה, באמצע הלוח. מחיקה - ב-✕ שלה ב"החלקים והתיבות שלי" (לשונית עיצוב, חלקים חופשיים).
        </p>
      ) : (
        <>
          <div className="space-y-1.5 text-sm" role="radiogroup" aria-label="איפה להוסיף">
            {([
              ['new', 'במסגרת חדשה', 'העתק של מסגרת מהלוח, באמצע - ואז בוחרים לה צד'],
              ['replace', 'במקום התוכן של מסגרת קיימת', 'המסגרת נשארת, והתוכן שלה מתחלף'],
              ['into', 'בתוך מסגרת קיימת, בנוסף למה שיש בה', 'למשל הדף היומי מתחת לפרשת השבוע, באותה מסגרת'],
            ] as const).map(([id, name, hint]) => (
              <label key={id} className="flex cursor-pointer items-start gap-2">
                <input type="radio" name="add-content-where" className="mt-1" checked={where === id} onChange={() => setWhere(id)} />
                <span><span className="font-medium">{name}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
              </label>
            ))}
          </div>
          {where === 'new' && styles.length > 0 && (
            <label className="flex flex-wrap items-center gap-2 text-sm">
              בסגנון של
              <select aria-label="בסגנון של" value={like} onChange={e => setLike(e.target.value)} className={`${SELECT_CLASS} min-w-0 flex-1`}>
                <option value="">הקשת הגדולה בלוח (אוטומטי)</option>
                {styles.map(f => <option key={f.e.id} value={f.e.id}>המסגרת של {label(f)}</option>)}
              </select>
            </label>
          )}
          {where !== 'new' && (
            frames.length ? (
              <select aria-label="איזו מסגרת" value={chosen?.e.id ?? ''} onChange={e => setTarget(e.target.value)}
                className={`${SELECT_CLASS} w-full`}>
                {frames.map(f => <option key={f.e.id} value={f.e.id}>{label(f)}</option>)}
              </select>
            ) : <p className="text-xs text-muted-foreground">אין עדיין מסגרות עם תוכן על הלוח.</p>
          )}
        </>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="h-8" onClick={add} disabled={!box && where !== 'new' && !frames.length}>הוספה</Button>
        <span className="text-[11px] text-muted-foreground">בלי רקע מאחורי הטקסט. צבע, גופן ורקע - משנים אחר כך, או קובעים למטה לכל תוכן חדש.</span>
      </div>

      {/* Once, for everything added from now on. */}
      <Folded label={`ברירת מחדל לתוכן חדש${customised ? ' (נקבעה)' : ' (כמו בערכה)'}`} testId="element-defaults">
        <div className="space-y-2 text-sm">
          <ColourChoice label="צבע לתוכן חדש" value={defaults.color} fallback="#3e2809" unsetLabel="כמו בערכה" onChange={c => setDefault({ color: c })} />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs">
              גופן
              <select aria-label="גופן לתוכן חדש" value={defaults.font ?? ''} onChange={e => setDefault({ font: (e.target.value || null) as ElementFont | null })} className={SELECT_CLASS}>
                <option value="">כמו בערכה</option>
                {(Object.keys(ELEMENT_FONTS) as ElementFont[]).map(f => <option key={f} value={f}>{ELEMENT_FONTS[f].name}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              עובי
              <select aria-label="עובי לתוכן חדש" value={defaults.weight ?? ''} onChange={e => setDefault({ weight: (e.target.value || null) as ElementDefaults['weight'] })} className={SELECT_CLASS}>
                <option value="">כמו בערכה</option>
                <option value="bold">מודגש</option>
                <option value="normal">רגיל</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs" title="גודל הטקסט, ביחס לגודל שבערכה">
              גודל
              <select aria-label="גודל לתוכן חדש" value={String(defaults.scale)} onChange={e => setDefault({ scale: Number(e.target.value) })} className={SELECT_CLASS}>
                {SIZES.map(([v, n]) => <option key={v} value={String(v)}>{n}</option>)}
              </select>
            </label>
          </div>
          {customised && <ResetButton onClick={() => onDefaults(DEFAULT_ELEMENT_DEFAULTS)}>חזרה להגדרות הערכה</ResetButton>}
          <Hint>חל על כל תוכן שמוסיפים מעכשיו - במסגרת חדשה ובתוך מסגרת. מה שכבר על הלוח לא משתנה.</Hint>
        </div>
      </Folded>
    </div>
  );
}
