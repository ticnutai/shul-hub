/**
 * What a board of parts shows, and on which side - the question the
 * ordinary board answers in "מה יופיע במסך הזה", asked here of the parts.
 *
 * One row for each frame of live content on the board: what it shows (the
 * arch of the prayers can show the day's times instead - same arch, same
 * look, its heading changed with it), which side it stands on, and whether it
 * shows at all. Below them, a new frame of any content, in the board's own
 * look - a copy of its finest frame - not a box from another board. Nothing
 * is deleted: a hidden frame waits in its own list, where it was.
 */
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EyeOff, Move, PanelLeft, PanelRight, PanelsLeftRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { TvConfig } from '@/tv/config';
import { useElementEditing } from '@/tv/elementEditing';
import {
  BINDING_LABELS, ELEMENT_BINDINGS, MAX_ELEMENTS, SCROLLABLE, addContent, boundsOf, normalizeElements, placeSection,
  sectionOf, setContent, sideOf, type BoardElement, type ElementBinding, type ElementScroll, type ElementSide,
} from '@/tv/elements';
import { announcePlace } from './announcePlace';

/** When the content is longer than its frame. A notice shrinks, a list turns its pages - or either moves. */
const FIT_LABELS = (binding: ElementBinding) => [
  ['', binding === 'announcements' || binding === 'footer' ? 'הקטנה כדי שייכנס' : 'דפדוף בין עמודים'],
  ['pause', 'גלילה עם עצירות'],
  ['loop', 'וילון רציף'],
] as const;
const SIDES = [['right', 'ימין', PanelRight], ['center', 'אמצע', PanelsLeftRight], ['left', 'שמאל', PanelLeft]] as const;

export function PartsContent({ config, onEdit, onManual }: {
  config: TvConfig;
  onEdit: (key: string, update: (c: TvConfig) => TvConfig) => void;
  /** The parts chosen for moving by hand: the list of parts opens, with them selected. */
  onManual: () => void;
}) {
  const elements = config.elements;
  const editing = useElementEditing();
  const [adding, setAdding] = useState<ElementBinding>('zmanim');
  const commit = (next: BoardElement[], key: string) => onEdit(key, c => ({ ...c, elements: normalizeElements(next) }));

  /** Every piece of live content, with the frame it stands in and where that stands. */
  const frames = useMemo(() => elements.filter(e => e.binding).map(e => {
    const ids = sectionOf(elements, e.id);
    const heading = elements.find(x => ids.includes(x.id) && x.kind === 'text' && !x.binding && x.text.trim());
    const shared = elements.filter(x => ids.includes(x.id) && x.binding).length > 1;
    return { e, ids, binding: e.binding!, title: !shared && heading ? heading.text : BINDING_LABELS[e.binding!], side: sideOf(boundsOf(elements, ids)) };
  }), [elements]);
  const shown = frames.filter(f => !f.e.hidden);
  const hidden = frames.filter(f => f.e.hidden);

  /** Hiding a frame hides it whole when it is the content's own; a shared one (the parasha beside the date) keeps standing. */
  const partsOf = (f: (typeof frames)[number]) =>
    elements.filter(x => f.ids.includes(x.id) && x.binding && x.id !== f.e.id).length ? [f.e.id] : f.ids;
  const setHidden = (f: (typeof frames)[number], hide: boolean) => {
    const ids = partsOf(f);
    commit(elements.map(e => ids.includes(e.id) ? { ...e, hidden: hide } : e), `parts-content:${f.e.id}:${hide ? 'hide' : 'show'}`);
  };

  const change = (f: (typeof frames)[number], binding: ElementBinding) => {
    commit(setContent(elements, f.e.id, binding), `parts-content:${f.e.id}:binding`);
    toast.success(`המסגרת "${f.title}" מציגה עכשיו ${BINDING_LABELS[binding]}.`);
  };

  const setScroll = (f: (typeof frames)[number], scroll: ElementScroll | '') => {
    commit(elements.map(e => e.id === f.e.id ? { ...e, scroll: scroll || undefined } : e), `parts-content:${f.e.id}:scroll`);
  };
  const anyScrolls = shown.some(f => f.e.scroll);

  const place = (f: (typeof frames)[number], side: ElementSide) => {
    const r = placeSection(elements, f.e.id, side);
    if (announcePlace(r, f.title, side)) {
      commit(r.elements, `element-side:${f.e.id}:${side}`);
      editing?.select(r.ids);
    }
  };

  const add = () => {
    const added = addContent(elements, adding);
    if (elements.length + added.length > MAX_ELEMENTS) { toast.error('עד 80 חלקים בלוח'); return; }
    commit([...elements, ...added], `parts-content:add:${adding}`);
    editing?.select(added.map(e => e.id));
    toast.success(`נוספה מסגרת "${BINDING_LABELS[adding]}" באמצע הלוח${added.some(x => x.crop || x.image) ? ', בסגנון של המסגרות שבלוח' : ''}. בחרו לה צד ברשימה.`);
  };

  return (
    <div className="space-y-4" data-testid="parts-content">
      <div className="space-y-2">
        <p className="text-sm font-semibold">המסגרות שעל הלוח</p>
        <p className="text-xs text-muted-foreground">
          בכל מסגרת בוחרים מה היא מציגה - המסגרת והסגנון נשארים, והכותרת מתחלפת. ימין, אמצע או שמאל מזיזים אותה, ואם בצד הזה כבר עומדת מסגרת אחרת, השתיים מתחלפות.
        </p>
        <div className="divide-y rounded-lg border">
          {shown.map(f => (
            <div key={f.e.id} className="flex flex-wrap items-center gap-2 px-2 py-1.5" data-frame-of={f.binding}>
              <span className="min-w-[6rem] flex-1 text-sm font-medium">{f.title}</span>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                מציגה
                <select
                  aria-label={`מה מציגה ${f.title}`}
                  value={f.binding}
                  onChange={ev => change(f, ev.target.value as ElementBinding)}
                  className="h-8 rounded border bg-background px-1 text-sm text-foreground"
                >
                  {ELEMENT_BINDINGS.map(b => <option key={b} value={b}>{BINDING_LABELS[b]}</option>)}
                </select>
              </label>
              {SCROLLABLE.includes(f.binding) && (
                <label className="flex items-center gap-1 text-xs text-muted-foreground" title="מה קורה כשהתוכן ארוך מהמסגרת. תוכן שנכנס לא זז.">
                  כשלא נכנס
                  <select
                    aria-label={`כשלא נכנס - ${f.title}`}
                    value={f.e.scroll ?? ''}
                    onChange={ev => setScroll(f, ev.target.value as ElementScroll | '')}
                    className="h-8 rounded border bg-background px-1 text-sm text-foreground"
                  >
                    {FIT_LABELS(f.binding).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
              )}
              <div className="flex items-center gap-0.5" role="group" aria-label={`מיקום של ${f.title}`}>
                {SIDES.map(([s, name, Icon]) => (
                  <button key={s} type="button" aria-label={`${f.title} ל${name}`} aria-pressed={f.side === s} title={`להעביר ל${name}`}
                    onClick={() => place(f, s)}
                    className={`grid size-7 place-items-center rounded border ${f.side === s ? 'border-primary bg-primary/10 text-primary' : 'border-transparent text-muted-foreground'} hover:border-primary hover:text-foreground`}>
                    <Icon className="size-4" aria-hidden />
                  </button>
                ))}
                <button type="button" aria-label={`הזזה ידנית של ${f.title}`} title="הזזה ידנית: פותח את רשימת החלקים כשהמסגרת הזו בחורה, ואז גוררים אותה על הלוח"
                  onClick={() => { editing?.select(f.ids); onManual(); }}
                  className="grid size-7 place-items-center rounded border border-transparent text-muted-foreground hover:border-primary hover:text-foreground">
                  <Move className="size-4" aria-hidden />
                </button>
                <button type="button" aria-label={`הסתרת ${f.title}`} title="הסתרה - לא נמחק, אפשר להחזיר"
                  onClick={() => setHidden(f, true)}
                  className="grid size-7 place-items-center rounded border border-transparent text-muted-foreground hover:border-destructive hover:text-destructive">
                  <EyeOff className="size-4" aria-hidden />
                </button>
              </div>
            </div>
          ))}
          {!shown.length && <p className="p-3 text-sm text-muted-foreground">אין על הלוח מסגרות עם תוכן. הוסיפו אחת למטה.</p>}
        </div>
        {anyScrolls && (
          <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="מהירות הגלילה">
            <span className="text-muted-foreground">מהירות הגלילה:</span>
            {([['slow', 'איטית'], ['normal', 'רגילה']] as const).map(([id, name]) => (
              <Button key={id} type="button" size="sm" className="h-7" variant={config.overflow.speed === id ? 'default' : 'outline'} aria-pressed={config.overflow.speed === id}
                onClick={() => onEdit('overflow-speed', c => ({ ...c, overflow: { ...c.overflow, speed: id } }))}>
                {name}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3" data-testid="parts-add">
        <p className="text-sm font-semibold">הוספת תצוגה</p>
        <p className="text-xs text-muted-foreground">מסגרת חדשה בסגנון של הלוח - העתק של המסגרות שכבר עליו - עם התוכן שבוחרים.</p>
        <div className="flex flex-wrap gap-2">
          <select aria-label="איזו תצוגה להוסיף" value={adding} onChange={e => setAdding(e.target.value as ElementBinding)}
            className="h-9 min-w-[10rem] flex-1 rounded border bg-background px-2 text-sm">
            {ELEMENT_BINDINGS.map(b => <option key={b} value={b}>{BINDING_LABELS[b]}{shown.some(f => f.binding === b) ? ' (כבר על הלוח)' : ''}</option>)}
          </select>
          <Button size="sm" onClick={add} disabled={elements.length >= MAX_ELEMENTS}>הוספה</Button>
        </div>
      </div>

      {hidden.length > 0 && (
        <div className="space-y-1" data-testid="parts-hidden">
          <p className="text-sm font-semibold">מוסתרות</p>
          {hidden.map(f => (
            <div key={f.e.id} className="flex items-center gap-2 rounded border px-2 py-1 text-sm">
              <span className="flex-1 text-muted-foreground">{f.title}</span>
              <Button size="sm" variant="outline" className="h-7" aria-label={`הצגת ${f.title}`} onClick={() => setHidden(f, false)}>הצגה</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
