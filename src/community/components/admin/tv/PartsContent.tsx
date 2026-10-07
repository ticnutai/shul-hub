/**
 * What a board of parts shows, and on which side - the question the
 * ordinary board answers in "מה יופיע במסך הזה", asked here of the parts.
 *
 * One card for each frame of live content on the board: what it shows (the
 * arch of the prayers can show the day's times instead - same arch, same
 * look, its heading changed with it), which side it stands on, and whether it
 * shows at all; opened, the rest of it - what else it takes turns with, which
 * of the day's times, the symbol over its arch, the plain panel behind it.
 * Below them, a new frame of any content, in the board's own look. Nothing is
 * deleted: a hidden frame waits in its own list, where it was.
 *
 * Laid out for a phone as much as for a desktop: the name and the side on
 * one line, the choices under them, each wrapping on its own.
 */
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, Move, PanelLeft, PanelRight, PanelsLeftRight, RotateCcw, Save, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ZMAN_DISPLAY_KEYS, ZMAN_DISPLAY_LABELS } from '@/community/lib/zmanim';
import { setSymbol, symbolChoices } from '@/tv/artSymbols';
import { kitOf, resetToKit } from '@/tv/kitReset';
import type { TvConfig } from '@/tv/config';
import { useElementEditing } from '@/tv/elementEditing';
import {
  BINDING_LABELS, ELEMENT_BINDINGS, SCROLLABLE, liveFrames, normalizeElements, placeSection,
  setAlternates, setContent, type BoardElement, type ElementBinding, type ElementScroll, type ElementSide,
} from '@/tv/elements';
import { announcePlace } from './announcePlace';
import { AddContent } from './AddContent';
import { MAX_ELEMENT_SETS, elementId, swapContent } from '@/tv/elements';
import { DESIGN_PARTS, MAX_DESIGNS, captureDesign } from '@/tv/designs';

/** When the content is longer than its frame. A notice shrinks, a list turns its pages - or either moves. */
const FIT_LABELS = (binding: ElementBinding) => [
  ['', binding === 'announcements' || binding === 'footer' ? 'הקטנה כדי שייכנס' : 'דפדוף בין עמודים'],
  ['pause', 'גלילה עם עצירות'],
  ['loop', 'וילון רציף'],
] as const;
const SIDES = [['right', 'ימין', PanelRight], ['center', 'אמצע', PanelsLeftRight], ['left', 'שמאל', PanelLeft]] as const;
const SELECT = 'h-8 rounded border bg-background px-1 text-sm text-foreground';

export function PartsContent({ config, onEdit, onManual }: {
  config: TvConfig;
  onEdit: (key: string, update: (c: TvConfig) => TvConfig) => void;
  /** The parts chosen for moving by hand: the list of parts opens, with them selected. */
  onManual: () => void;
}) {
  const elements = config.elements;
  const editing = useElementEditing();
  /** Frames ticked for showing or hiding together (by the id of their content). */
  const [picked, setPicked] = useState<string[]>([]);
  const kit = useMemo(() => kitOf(config), [config]);
  const commit = (next: BoardElement[], key: string) => onEdit(key, c => ({ ...c, elements: normalizeElements(next) }));

  /** Every piece of live content, with the frame it stands in and where that stands. */
  const frames = useMemo(() => liveFrames(elements), [elements]);
  type Frame = (typeof frames)[number];
  const shown = frames.filter(f => !f.e.hidden);
  const hidden = frames.filter(f => f.e.hidden);

  /** Hiding a frame hides it whole when it is the content's own; a shared one (the parasha beside the date) keeps standing. */
  const partsOf = (f: Frame) =>
    elements.filter(x => f.ids.includes(x.id) && x.binding && x.id !== f.e.id).length ? [f.e.id] : f.ids;
  const setHidden = (f: Frame, hide: boolean) => setManyHidden([f], hide);
  /** Several frames shown or hidden at once: one step to undo. */
  const setManyHidden = (fs: Frame[], hide: boolean) => {
    const ids = fs.flatMap(partsOf);
    commit(elements.map(e => ids.includes(e.id) ? { ...e, hidden: hide } : e), `parts-content:${fs.map(f => f.e.id).join(',')}:${hide ? 'hide' : 'show'}`);
  };
  const pickedFrames = frames.filter(f => picked.includes(f.e.id));
  const toggle = (f: Frame, on: boolean) => setPicked(p => on ? [...new Set([...p, f.e.id])] : p.filter(id => id !== f.e.id));
  const pickBox = (f: Frame) => (
    <input type="checkbox" aria-label={`בחירת ${f.title}`} checked={picked.includes(f.e.id)} onChange={ev => toggle(f, ev.target.checked)} className="size-4 shrink-0" />
  );

  const reset = () => {
    if (!kit) return;
    if (!window.confirm(`להחזיר את הלוח לברירת המחדל של «${kit.name}»? כל החלקים יחזרו למקום ולתוכן המקוריים. אפשר לבטל עם Ctrl+Z.`)) return;
    onEdit(`parts-content:reset:${kit.id}`, c => resetToKit(c, kit));
    setPicked([]);
    editing?.select([]);
    toast.success(`הלוח חזר לברירת המחדל של «${kit.name}».`);
  };
  /** "Replace" from the message of a frame sent over another: the one below is hidden. */
  const hideParts = (ids: string[]) =>
    onEdit(`parts-content:replace:${ids.join(',')}`, c => ({ ...c, elements: c.elements.map(x => ids.includes(x.id) ? { ...x, hidden: true } : x) }));

  /** Two frames exchange what they show: each content takes the other frame's shape. */
  const swap = (f: Frame, otherId: string) => {
    const other = frames.find(x => x.e.id === otherId);
    if (!other) return;
    commit(swapContent(elements, f.e.id, otherId), `parts-content:swap:${f.e.id}:${otherId}`);
    toast.success(`"${f.title}" ו"${other.title}" החליפו תוכן: כל אחד מקבל את הצורה של המסגרת שאליה עבר.`);
  };
  /** A frame kept as "my box": its picture, heading and content, to be added again from the list. */
  const [boxName, setBoxName] = useState<Record<string, string>>({});
  const saveBox = (f: Frame) => {
    const name = (boxName[f.e.id] ?? f.title).trim().slice(0, 80);
    if (!name) return;
    const kept = elements.filter(e => f.ids.includes(e.id)).map(e => structuredClone(e));
    const existing = config.elementLibrary.find(l => l.name === name);
    if (existing && !window.confirm(`כבר יש תיבה בשם «${name}». להחליף אותה?`)) return;
    if (!existing && config.elementLibrary.length >= MAX_ELEMENT_SETS) { toast.error(`הגעתם למספר התיבות המרבי (${MAX_ELEMENT_SETS}).`); return; }
    onEdit(`element-library:save:${name}`, c => ({
      ...c,
      elementLibrary: existing
        ? c.elementLibrary.map(l => (l.id === existing.id ? { ...l, elements: kept } : l))
        : [...c.elementLibrary, { id: `box_${elementId().slice(3, 15)}`, name, elements: kept }],
    }));
    setBoxName(b => ({ ...b, [f.e.id]: '' }));
    toast.success(`"${name}" נשמרה ב"החלקים והתיבות שלי" - היא ברשימת "הוספת תוכן".`);
  };

  const change = (f: Frame, binding: ElementBinding) => {
    commit(setContent(elements, f.e.id, binding), `parts-content:${f.e.id}:binding`);
    toast.success(`המסגרת "${f.title}" מציגה עכשיו ${BINDING_LABELS[binding]}.`);
  };
  const patch = (f: Frame, p: Partial<BoardElement>, what: string) =>
    commit(elements.map(e => e.id === f.e.id ? { ...e, ...p } : e), `parts-content:${f.e.id}:${what}`);
  const anyScrolls = shown.some(f => f.e.scroll);

  const place = (f: Frame, side: ElementSide) => {
    const r = placeSection(elements, f.e.id, side);
    if (announcePlace(r, f.title, side, hideParts)) {
      commit(r.elements, `element-side:${f.e.id}:${side}`);
      editing?.select(r.ids);
    }
  };

  /**
   * The board as it stands now, kept as a kit of one's own: in "הערכות שלי"
   * in the design tab, put back on this page or any other with a click, and
   * the kit "איפוס הכול" goes back to. Everything a kit carries, its layout
   * too - without it a kit of parts came back as an ordinary board.
   */
  const [kitName, setKitName] = useState<string | null>(null);
  const saveKit = () => {
    const name = (kitName ?? '').trim().slice(0, 40);
    if (!name) { toast.error('צריך לתת שם לערכה'); return; }
    const existing = config.designs.find(d => d.name === name);
    if (existing && !window.confirm(`כבר יש ערכה בשם «${name}». להחליף אותה במה שעל הלוח עכשיו?`)) return;
    if (!existing && config.designs.length >= MAX_DESIGNS) { toast.error(`הגעתם למספר הערכות המרבי (${MAX_DESIGNS}). מחקו ערכה ב"הערכות שלי".`); return; }
    onEdit(`parts-content:save-kit:${name}`, c => {
      const kit = captureDesign(c, name, [...DESIGN_PARTS], existing?.id);
      return { ...c, designs: existing ? c.designs.map(d => (d.id === existing.id ? kit : d)) : [...c.designs, kit] };
    });
    setKitName(null);
    toast.success(`הערכה «${name}» נשמרה. היא ב"הערכות שלי" בלשונית "עיצוב", ותגיע למסכים ב"שמור ושדר".`);
  };

  return (
    <div className="space-y-4" data-testid="parts-content">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">המסגרות שעל הלוח</p>
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setKitName(kitName === null ? '' : null)} data-testid="parts-save-kit"
            title="שומר את הלוח כמו שהוא עכשיו כערכה משלכם - תופיע ב'הערכות שלי'">
            <Save className="size-4" aria-hidden /> שמירה כערכה
          </Button>
          {kit && (
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={reset} title={`כל החלקים חוזרים למקום, לגודל ולתוכן של «${kit.name}»`} data-testid="parts-reset">
              <RotateCcw className="size-4" aria-hidden /> איפוס הכול לברירת המחדל
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          בכל מסגרת בוחרים מה היא מציגה - המסגרת והסגנון נשארים, והכותרת מתחלפת. ימין, אמצע או שמאל מזיזים אותה, ואם בצד הזה כבר עומדת מסגרת אחרת, השתיים מתחלפות.
        </p>
        {kitName !== null && (
          <form className="flex flex-wrap items-center gap-2 rounded-md border p-2" onSubmit={e => { e.preventDefault(); saveKit(); }} data-testid="parts-kit-form">
            <input autoFocus aria-label="שם הערכה החדשה" value={kitName} maxLength={40} placeholder="למשל: אבן ירושלים - ארבע קשתות"
              onChange={e => setKitName(e.target.value)} className="h-8 min-w-0 flex-1 basis-48 rounded border bg-background px-2 text-sm" />
            <Button type="submit" size="sm" className="h-8">שמירת הערכה</Button>
            <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setKitName(null)}>ביטול</Button>
            <p className="w-full text-[11px] text-muted-foreground">נשמר הכול: המסגרות, מה שהן מציגות, המיקום, הצבעים והרקע. עם אותו שם - מחליף את הערכה הקודמת.</p>
          </form>
        )}
        {/* Several at once: tick, then show or hide them all. */}
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-xs" role="group" aria-label="בחירה מרובה" data-testid="parts-bulk">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" aria-label="בחירת כל המסגרות" className="size-4"
              checked={frames.length > 0 && picked.length === frames.length}
              ref={el => { if (el) el.indeterminate = picked.length > 0 && picked.length < frames.length; }}
              onChange={ev => setPicked(ev.target.checked ? frames.map(f => f.e.id) : [])} />
            {picked.length ? `נבחרו ${picked.length}` : 'בחירת הכול'}
          </label>
          {picked.length > 0 && (
            <>
              <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setManyHidden(pickedFrames, true)}>
                <EyeOff className="size-3.5" aria-hidden /> הסתרת הנבחרות
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setManyHidden(pickedFrames, false)}>
                <Eye className="size-3.5" aria-hidden /> הצגת הנבחרות
              </Button>
              <button type="button" className="underline underline-offset-2" onClick={() => setPicked([])}>ניקוי הבחירה</button>
            </>
          )}
        </div>
        <div className="divide-y rounded-lg border">
          {shown.map(frameRow)}
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

      <AddContent elements={elements} onCommit={(next, key, ids) => { commit(next, key); editing?.select(ids); }}
      library={config.elementLibrary}
      defaults={config.elementDefaults}
      onDefaults={(next) => onEdit('element-defaults', (c) => ({ ...c, elementDefaults: next }))}
      onLibrary={(next) => onEdit('element-library', (c) => ({ ...c, elementLibrary: next }))} />

      {hidden.length > 0 && (
        <div className="space-y-1" data-testid="parts-hidden">
          <p className="text-sm font-semibold">מוסתרות</p>
          {hidden.map(f => (
            <div key={f.e.id} className="flex items-center gap-2 rounded border px-2 py-1 text-sm">
              {pickBox(f)}
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{f.title}</span>
              <Button size="sm" variant="outline" className="h-7" aria-label={`הצגת ${f.title}`} onClick={() => setHidden(f, false)}>הצגה</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // A plain function, not a component: one declared in here would be a new type on every
  // render, and React would rebuild each row - closing what was opened - on every change.
  function frameRow(f: Frame) {
    const symbols = symbolChoices(elements, f.e.id);
    const turns = f.e.alternates ?? [];
    const zmanim = f.binding === 'zmanim' || turns.includes('zmanim');
    const keys = f.e.zmanKeys ?? ZMAN_DISPLAY_KEYS.filter(k => !config.hidden.includes(`zman.${k}`));
    const more = [turns.length ? `מתחלפת עם ${turns.length}` : '', f.e.backdrop ? 'רקע חלק' : '', symbols?.current ? 'סמל' : ''].filter(Boolean).join(' · ');
    return (
      <div key={f.e.id} className="space-y-1.5 px-2 py-2" data-frame-of={f.binding}>
        {/* The name and the side: one line, also on a phone. */}
        <div className="flex items-center gap-2">
          {pickBox(f)}
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.title}</span>
          <div className="flex shrink-0 items-center gap-0.5" role="group" aria-label={`מיקום של ${f.title}`}>
            {SIDES.map(([s, name, Icon]) => (
              <button key={s} type="button" aria-label={`${f.title} ל${name}`} aria-pressed={f.side === s} title={`להעביר ל${name}`}
                onClick={() => place(f, s)}
                className={`grid size-8 place-items-center rounded border sm:size-7 ${f.side === s ? 'border-primary bg-primary/10 text-primary' : 'border-transparent text-muted-foreground'} hover:border-primary hover:text-foreground`}>
                <Icon className="size-4" aria-hidden />
              </button>
            ))}
            <button type="button" aria-label={`הזזה ידנית של ${f.title}`} title="הזזה ידנית: פותח את רשימת החלקים כשהמסגרת הזו בחורה, ואז גוררים אותה על הלוח"
              onClick={() => { editing?.select(f.ids); onManual(); }}
              className="grid size-8 place-items-center rounded border border-transparent text-muted-foreground hover:border-primary hover:text-foreground sm:size-7">
              <Move className="size-4" aria-hidden />
            </button>
            <button type="button" aria-label={`הסתרת ${f.title}`} title="הסתרה - לא נמחק, אפשר להחזיר"
              onClick={() => setHidden(f, true)}
              className="grid size-8 place-items-center rounded border border-transparent text-muted-foreground hover:border-destructive hover:text-destructive sm:size-7">
              <EyeOff className="size-4" aria-hidden />
            </button>
          </div>
        </div>
        {/* What it shows, and what when that is long. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            מציגה
            <select aria-label={`מה מציגה ${f.title}`} value={f.binding} onChange={ev => change(f, ev.target.value as ElementBinding)} className={SELECT}>
              {ELEMENT_BINDINGS.map(b => <option key={b} value={b}>{BINDING_LABELS[b]}</option>)}
            </select>
          </label>
          {frames.filter(x => !x.e.hidden).length > 1 && (
            <label className="flex items-center gap-1 text-xs text-muted-foreground" title="המסגרות נשארות במקומן, והתוכן עובר ביניהן - כל תוכן מקבל את הצורה של המסגרת שאליה עבר">
              להחליף תוכן עם
              <select aria-label={`להחליף תוכן של ${f.title} עם`} value="" onChange={ev => ev.target.value && swap(f, ev.target.value)} className={SELECT}>
                <option value="">…</option>
                {frames.filter(x => !x.e.hidden && x.e.id !== f.e.id).map(x => <option key={x.e.id} value={x.e.id}>{x.title}</option>)}
              </select>
            </label>
          )}
          {SCROLLABLE.includes(f.binding) && (
            <label className="flex items-center gap-1 text-xs text-muted-foreground" title="מה קורה כשהתוכן ארוך מהמסגרת. תוכן שנכנס לא זז.">
              כשלא נכנס
              <select aria-label={`כשלא נכנס - ${f.title}`} value={f.e.scroll ?? ''}
                onChange={ev => patch(f, { scroll: (ev.target.value || undefined) as ElementScroll | undefined }, 'scroll')} className={SELECT}>
                {FIT_LABELS(f.binding).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          )}
        </div>
        <details className="group text-xs" data-testid="frame-more">
          <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">
            עוד אפשרויות{more ? ` (${more})` : ''}
          </summary>
          <div className="mt-2 space-y-3 rounded-md bg-muted/40 p-2">
            {/* Taking turns: the notices, then the shiurim, in one frame. */}
            <div className="space-y-1">
              <p className="font-medium">מתחלפת עם תוכן נוסף</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-background px-1.5 py-0.5">{BINDING_LABELS[f.binding]}</span>
                {turns.map(b => (
                  <span key={b} className="flex items-center gap-1 rounded bg-background px-1.5 py-0.5">
                    {BINDING_LABELS[b]}
                    <button type="button" aria-label={`בלי ${BINDING_LABELS[b]} ב${f.title}`} onClick={() => commit(setAlternates(elements, f.e.id, turns.filter(x => x !== b), f.e.alternateSeconds ?? 20), `parts-content:${f.e.id}:turns`)}>
                      <X className="size-3" aria-hidden />
                    </button>
                  </span>
                ))}
                {turns.length < 5 && (
                  <select aria-label={`הוספת תוכן מתחלף ל${f.title}`} value="" className={SELECT}
                    onChange={ev => ev.target.value && commit(setAlternates(elements, f.e.id, [...turns, ev.target.value as ElementBinding], f.e.alternateSeconds ?? 20), `parts-content:${f.e.id}:turns`)}>
                    <option value="">+ להוסיף…</option>
                    {ELEMENT_BINDINGS.filter(b => b !== f.binding && !turns.includes(b)).map(b => <option key={b} value={b}>{BINDING_LABELS[b]}</option>)}
                  </select>
                )}
              </div>
              {turns.length > 0 && (
                <label className="flex items-center gap-1 text-muted-foreground">
                  כל תוכן מוצג
                  <input type="number" min={5} max={300} aria-label={`שניות לכל תוכן ב${f.title}`} value={f.e.alternateSeconds ?? 20}
                    onChange={ev => ev.target.value && commit(setAlternates(elements, f.e.id, turns, Number(ev.target.value)), `parts-content:${f.e.id}:turn-seconds`)}
                    className="h-7 w-16 rounded border bg-background px-1 text-foreground" />
                  שניות
                </label>
              )}
            </div>
            {zmanim && (
              <div className="space-y-1">
                <p className="font-medium">אילו זמנים להציג</p>
                <div className="grid grid-cols-1 gap-1 min-[420px]:grid-cols-2">
                  {ZMAN_DISPLAY_KEYS.map(key => (
                    <label key={key} className="flex items-center gap-1.5">
                      <input type="checkbox" checked={keys.includes(key)}
                        onChange={ev => patch(f, { zmanKeys: ev.target.checked ? [...keys, key] : keys.filter(k => k !== key) }, 'zman-keys')} />
                      {ZMAN_DISPLAY_LABELS[key]}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {symbols && (
              <label className="flex items-center gap-1">
                <span className="font-medium">הסמל בראש המסגרת</span>
                <select aria-label={`הסמל בראש ${f.title}`} value={symbols.current} className={SELECT}
                  onChange={ev => commit(setSymbol(elements, f.e.id, ev.target.value), `parts-content:${f.e.id}:symbol`)}>
                  <option value="">כמו בציור</option>
                  {symbols.choices.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </label>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium">שמירה בחלקים והתיבות שלי</span>
              <input aria-label={`שם לתיבה של ${f.title}`} value={boxName[f.e.id] ?? f.title} maxLength={80}
                onChange={ev => setBoxName(b => ({ ...b, [f.e.id]: ev.target.value }))} className="h-7 min-w-0 flex-1 basis-32 rounded border bg-background px-1 text-foreground" />
              <Button type="button" size="sm" variant="outline" className="h-7" aria-label={`שמירת ${f.title} בחלקים והתיבות שלי`} onClick={() => saveBox(f)}>שמירה</Button>
            </div>
            <label className="flex items-center gap-1.5" title="משטח חלק מאחורי התוכן, כדי שהקווים המצוירים במסגרת לא יעברו בתוך הטקסט">
              <input type="checkbox" aria-label={`רקע חלק מאחורי ${f.title}`} checked={Boolean(f.e.backdrop)} onChange={ev => patch(f, { backdrop: ev.target.checked || undefined }, 'backdrop')} />
              רקע חלק מאחורי התוכן (מסתיר את הקווים המצוירים במסגרת)
            </label>
          </div>
        </details>
      </div>
    );
  }
}
