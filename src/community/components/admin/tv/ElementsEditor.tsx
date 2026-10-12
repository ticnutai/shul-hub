import { useMemo } from 'react';
import { toast } from 'sonner';
import { Move } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { confirmAction } from '@/components/ConfirmDialog';
import type { TvConfig } from '@/tv/config';
import { SECTION_SHAPES, setSectionShape, sectionGeometry, linkedSection } from '@/tv/sectionGeometry';
import { BINDING_LABELS, ELEMENT_BINDINGS, SCROLLABLE, ELEMENT_KINDS, ELEMENT_NAMES, MAX_ELEMENTS, alignElements, boundsOf, elementId, liveFrames, moveElements, newElement, normalizeElements, placeSection, sectionOf, sideOf, type BoardElement, type ElementBinding, type ElementSide } from '@/tv/elements';
import { announcePlace } from './announcePlace';
import { ElementTextTools } from './ElementTextTools';
import { AddContent } from './AddContent';
import { BoardElements } from '@/tv/BoardElements';
import { useElementEditing } from '@/tv/elementEditing';
import { ElementLibrary } from './ElementLibrary';
import { exportElementSet, importElementSet } from '@/tv/elements';
import { downloadFile } from '@/tv/workspaceTransfer';
import { uploadImages } from './uploadImages';
import { ZMAN_DISPLAY_KEYS, ZMAN_DISPLAY_LABELS } from '@/community/lib/zmanim';
import { SubPart } from './Parts';
import { ColourRow, FIT_CHOICES, Range, ResetButton, SELECT_CLASS, SIDE_BUTTON, SIDE_CHOICES, Stepper, SwitchRow, sideButtonClass } from './editorParts';

/** A field of the chosen part: the editor's one height and border. */
const FIELD = 'mt-1 block h-8 w-full rounded-md border bg-background px-2 text-sm';
/** Alignment, right to left as the page reads. */
const ALIGNMENTS = [['right', 'לימין'], ['center-x', 'מרכוז אופקי'], ['left', 'לשמאל'], ['top', 'למעלה'], ['center-y', 'מרכוז אנכי'], ['bottom', 'למטה']] as const;

type Props = {
  config: TvConfig;
  onEdit: (key: string, update: (c: TvConfig) => TvConfig) => void;
  /** The text bar is under the board's preview just now (editing on the board): not here as well. */
  textToolsElsewhere?: boolean;
};
export function ElementsEditor({ config, onEdit, textToolsElsewhere = false }: Props) {
  const elements = config.elements;
  const { selected, select, snap, setSnap, gridStep, setGridStep, showGrid, setShowGrid, linkSection, setLinkSection } = useElementEditing()!;
  const first = elements.find(e => e.id === selected[0]);
  /** A picture (or a frame drawn from one): its colours are tuned, not painted. */
  const pictured = !!first && (first.kind === 'image' || (first.kind === 'frame' && !!first.image));
  const lockedInSelection = elements.some(e => selected.includes(e.id) && e.locked);
  const commit = (next: BoardElement[], key = `elements:${crypto.randomUUID()}`) => onEdit(key, c => ({ ...c, elements: normalizeElements(next) }));
  const patch = (p: Partial<BoardElement>) => {
    // A frame, its box and its text, linked: a size or a turn is the whole section's, kept fitting together.
    if (first && linkSection) { for (const key of ['width', 'height', 'rotation'] as const) if (key in p) { commit(sectionGeometry(elements, first.id, key, p[key]!)); return; } }
    if (first && ('x' in p || 'y' in p)) { commit(moveElements(elements, linkSection ? linkedSection(elements, first.id) : selected, (p.x ?? first.x) - first.x, (p.y ?? first.y) - first.y)); return; }
    commit(elements.map(e => selected.includes(e.id) && !e.locked ? { ...e, ...p } : e), `element-property:${selected.join(',')}:${Object.keys(p).join(',')}`);
  };
  const choose = (e: BoardElement, multi: boolean) => {
    const ids = linkSection && e.group ? elements.filter(x => x.group === e.group).map(x => x.id) : [e.id];
    const ordered = [e.id, ...ids.filter(id => id !== e.id)]; const next = multi ? [...new Set([...selected, ...ordered])] : ordered; select(next); return next;
  };
  const duplicate = () => {
    const copies = elements.filter(e => selected.includes(e.id));
    if (copies.length + elements.length > MAX_ELEMENTS) return toast.error(`עד ${MAX_ELEMENTS} חלקים בלוח`);
    const groups = new Map<string, string>();
    const added = copies.map(e => {
      if (e.group && !groups.has(e.group)) groups.set(e.group, elementId());
      return { ...e, id: elementId(), name: `${e.name} (עותק)`, x: Math.min(100 - e.width, e.x + 2), y: Math.min(100 - e.height, e.y + 2), locked: false, group: e.group ? groups.get(e.group)! : null };
    }); commit([...elements, ...added]); select(added.map(e => e.id));
  };
  const removeSelection = async () => {
    const n = selected.length;
    const ok = await confirmAction({
      title: n > 1 ? `למחוק ${n} חלקים מהלוח?` : `למחוק את „${first?.name ?? 'החלק'}” מהלוח?`,
      description: 'אפשר להחזיר בצעד אחורה, עד השמירה.',
      confirmLabel: 'מחיקה',
    });
    if (!ok) return;
    commit(elements.filter(e => !selected.includes(e.id))); select([]);
  };
  /**
   * On a board of parts, the content and the side of each frame of content are
   * the layout tab's ("מה יופיע על הלוח, ובאיזה צד"): here only the rest - the
   * decorations, the pillars, a picture - has its side.
   */
  const parts = config.screenLayout === 'composition';
  const inLayoutTab = useMemo(() => new Set(parts ? liveFrames(elements).flatMap(f => f.ids) : []), [parts, elements]);
  /** Each part with the section it moves with, and where that section stands now. */
  const sections = useMemo(() => new Map(elements.map(e => { const ids = sectionOf(elements, e.id); return [e.id, { ids, side: sideOf(boundsOf(elements, ids)) }] as const; })), [elements]);
  const textPatch = (ids: string[], p: Partial<BoardElement>, what: string) =>
    commit(elements.map(x => ids.includes(x.id) && !x.locked ? { ...x, ...p } : x), `element-text:${ids.join(',')}:${what}`);
  /** "Replace" from the message: the parts below are hidden, read from the board as it is then. */
  const hideParts = (ids: string[]) =>
    onEdit(`elements-replace:${ids.join(',')}`, c => ({ ...c, elements: c.elements.map(x => ids.includes(x.id) ? { ...x, hidden: true } : x) }));
  const place = (e: BoardElement, side: ElementSide) => {
    const r = placeSection(elements, e.id, side);
    if (announcePlace(r, e.name, side, hideParts)) { commit(r.elements, `element-side:${e.id}:${side}`); select(r.ids); }
  };
  const manual = (e: BoardElement) => {
    const ids = sections.get(e.id)?.ids ?? [e.id];
    select([...ids]);
    toast(ids.length > 1 ? `"${e.name}" נבחר יחד עם ${ids.length - 1} החלקים שזזים איתו. גררו אותו על הלוח, או הזיזו בחצים של המקלדת.` : `"${e.name}" נבחר. גררו אותו על הלוח, או הזיזו בחצים של המקלדת.`);
  };

  return <div className="space-y-5" data-testid="elements-editor">
    {elements.some(e => e.sourceMask)
      ? <p className="rounded-md border p-3 text-sm" data-testid="artwork-mask-disclosure">פרטי הציור המקורי מופרדים במסכות: מסגרות, מילויים, עמודים וקישוטים. אפשר להזיז ולהסתיר כל חלק בנפרד; הטקסט והשעון חיים. הקישוט של הפמוטים, הספר והענף נשמר כקבוצה אחת. רקע משלים ייחשף כאשר תזיזו חלק.</p>
      : elements.some(e => e.crop) && <p className="rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950" data-testid="artwork-layer-disclosure">בערכה זו יש תמונות חתוכות. חיתוך מלבני לבדו אינו מפריד מסגרת מהרקע שסביבה; בערכות הציור הוותיקות הם נשארים יחד. הטקסט והשעון נפרדים.</p>}

    <SubPart title="הוספת חלק" hint={parts ? 'גררו חלק למקומו. Shift + לחיצה לבחירה משותפת. המסגרות, המילויים והתוכן החי של הערכה נמצאים ברשימת החלקים למטה.' : 'גררו חלק למקומו. Shift + לחיצה לבחירה משותפת. החלקים עומדים מעל תוכן הלוח; הרקע והתיבות נשארים בכלים שלמעלה.'}>
      <div className="flex flex-wrap gap-2">
        {ELEMENT_KINDS.filter(k => k !== 'image').map(kind => <Button size="sm" variant="outline" className="h-8" key={kind} disabled={elements.length >= MAX_ELEMENTS} onClick={() => { const e = newElement(kind); commit([...elements, e]); select([e.id]); }}>הוספת {ELEMENT_NAMES[kind]}</Button>)}
        <Button asChild size="sm" variant="outline" className="h-8 cursor-pointer">
          <label>הוספת תמונה<input className="sr-only" aria-label="הוספת תמונה כחלק" type="file" accept="image/png,image/jpeg,image/webp" onChange={async ev => {
            const f = ev.target.files?.[0]; ev.target.value = ''; if (!f) return;
            if (elements.length >= MAX_ELEMENTS || f.size > 15_000_000 || !['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) return toast.error(`בחרו קובץ תמונה רגיל (עד 15 מגה), ועד ${MAX_ELEMENTS} חלקים בלוח`);
            // Into the synagogue's picture storage, transparency kept: the board keeps only its address.
            const [image] = await uploadImages([f]).catch((e) => { toast.error(e instanceof Error ? e.message : 'העלאת התמונה נכשלה'); return [] as string[]; });
            if (!image) return;
            const e = { ...newElement('image'), image, name: f.name }; commit([...elements, e]); select([e.id]);
          }} /></label>
        </Button>
      </div>
    </SubPart>

    <SubPart title="משטח העבודה" hint="בעריכה ישירה בלוח אפשר לגרור גם על התצוגה האמיתית. כשהלוח ממוקד: חצים להזזה עדינה, Shift לתזוזה גדולה, Delete למחיקה, Ctrl+D לשכפול ו־Esc לביטול בחירה. Alt + לחיצה משאיר את פעולת הלוח הרגילה.">
      <SwitchRow label="הצמדה לרשת" checked={snap} onChange={setSnap} />
      <SwitchRow label="מסגרת, תיבה וטקסט יחד" hint="גרירה, גודל וסיבוב חלים על כל החלקים של אותה מסגרת" checked={linkSection} onChange={(on) => { setLinkSection(on); if (!on && first) select([first.id]); }} />
      <SwitchRow label="הצגת רשת ומידות" checked={showGrid} onChange={setShowGrid} />
      <label className="flex flex-wrap items-center gap-2 text-sm">
        מרווח הרשת:
        <select aria-label="מרווח הרשת" className={SELECT_CLASS} value={gridStep} onChange={e => setGridStep(Number(e.target.value))}>
          {[1, 2, 5, 10].map(v => <option key={v} value={v}>{v}% - {Math.round(19.2 * v)} על {Math.round(10.8 * v)} נקודות במסך מלא</option>)}
        </select>
      </label>
      {first && <p className="text-[11px] text-muted-foreground" data-testid="element-measurements"><span dir="ltr">{first.width.toFixed(1)}% × {first.height.toFixed(1)}%</span> - מידות החלק. שוליים: שמאל <span dir="ltr">{first.x.toFixed(1)}%</span>, ימין <span dir="ltr">{(100 - first.x - first.width).toFixed(1)}%</span>, למעלה <span dir="ltr">{first.y.toFixed(1)}%</span>, למטה <span dir="ltr">{(100 - first.y - first.height).toFixed(1)}%</span>. המידות יחסיות ללוח.</p>}
      <div data-testid="elements-canvas" dir="ltr" className="relative isolate aspect-video w-full overflow-hidden rounded-lg border border-amber-700/50 bg-[#0b1628]" style={{ containerType: 'size', backgroundImage: undefined }}>
        <BoardElements elements={elements} surface />
      </div>
    </SubPart>

    <SubPart title="פעולות על הבחירה" hint="יישור, שכפול, קיבוץ, סדר השכבות, ייצוא וייבוא בקובץ.">
      <div className="flex flex-wrap gap-2" role="group" aria-label="יישור הבחירה">
        {ALIGNMENTS.map(([alignment, label]) => <Button key={alignment} size="sm" variant="outline" className="h-8" disabled={!first || lockedInSelection} onClick={() => commit(alignElements(elements, selected, alignment))}>{label}</Button>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="h-8" disabled={!first} onClick={duplicate}>שכפול החלק</Button>
        <Button size="sm" variant="outline" className="h-8" disabled={selected.length < 2 || lockedInSelection} onClick={() => patch({ group: elementId() })}>קיבוץ</Button>
        <Button size="sm" variant="outline" className="h-8" disabled={!first?.group} onClick={() => patch({ group: null })}>פירוק קבוצה</Button>
        <Button size="sm" variant="outline" className="h-8" disabled={!first} onClick={() => commit([...elements.filter(e => !selected.includes(e.id)), ...elements.filter(e => selected.includes(e.id))])}>קדימה</Button>
        <Button size="sm" variant="outline" className="h-8" disabled={!first} onClick={() => commit([...elements.filter(e => selected.includes(e.id)), ...elements.filter(e => !selected.includes(e.id))])}>אחורה</Button>
        <Button size="sm" variant="outline" className="h-8" disabled={!first} onClick={() => downloadFile(new Blob([exportElementSet(elements.filter(e => selected.includes(e.id)))], { type: 'application/json' }), 'חלקים.json')}>ייצוא הבחירה</Button>
        <Button asChild size="sm" variant="outline" className="h-8 cursor-pointer">
          <label>ייבוא חלקים<input className="sr-only" type="file" aria-label="ייבוא חלקים מקובץ" accept=".json" onChange={async ev => {
            const f = ev.target.files?.[0]; ev.target.value = ''; if (!f) return;
            try {
              if (f.size > 15_000_000) throw new Error('הקובץ גדול מדי');
              const added = importElementSet(await f.text());
              if (elements.length + added.length > MAX_ELEMENTS) throw new Error(`עד ${MAX_ELEMENTS} חלקים בלוח`);
              commit([...elements, ...added]); select(added.map(e => e.id));
            } catch (e) { toast.error(e instanceof Error ? e.message : 'ייבוא החלקים נכשל'); }
          }} /></label>
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-destructive" disabled={!first || lockedInSelection} onClick={() => void removeSelection()}>מחיקת הבחירה</Button>
      </div>
    </SubPart>

    {first && <SubPart title="החלק שנבחר">
      <fieldset disabled={first.locked} className="grid grid-cols-2 gap-2 rounded-lg border p-3 sm:grid-cols-3">
        <p className="col-span-full text-[11px] text-muted-foreground" data-testid="selected-layer-type">סוג החלק: {first.sourceMask ? 'חלק מהציור עם מסכה שקופה' : first.crop ? 'אזור מתוך תמונה' : first.binding ? 'תוכן חי נפרד' : ELEMENT_NAMES[first.kind]}</p>
        {['prayers', 'lessons', 'zmanim'].includes(first.binding ?? '') && <div className="text-xs">שורות בכל עמוד<div className="mt-1"><Stepper label="שורות בכל עמוד בחלק" value={first.rowsPerPage ?? 3} min={1} max={30} step={1} onChange={v => patch({ rowsPerPage: v })} /></div></div>}
        {SCROLLABLE.includes(first.binding as ElementBinding) && <label className="text-xs">כשהתוכן לא נכנס<select className={`${SELECT_CLASS} mt-1 block w-full`} aria-label="כשהתוכן לא נכנס בחלק" value={first.scroll ?? ''} onChange={ev => patch({ scroll: (ev.target.value || undefined) as BoardElement['scroll'] })}>{FIT_CHOICES(first.binding as ElementBinding).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>}
        {first.binding === 'zmanim' && <div className="col-span-full space-y-2" data-testid="element-zmanim-picker">
          <p className="text-[11px] text-muted-foreground">מג״א מחושב לפי 72 דקות קבועות לפני הנץ ואחרי השקיעה. הגר״א מחושב מהנץ לשקיעה.</p>
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => patch({ zmanKeys: [...ZMAN_DISPLAY_KEYS], rowsPerPage: ZMAN_DISPLAY_KEYS.length, fontSize: Math.min(first.fontSize, first.height / (ZMAN_DISPLAY_KEYS.length * 2.2)) })}>הצגת כל זמני היום יחד</Button>
          {/* Several to pick: tick boxes. */}
          <div className="grid gap-2 sm:grid-cols-2">{ZMAN_DISPLAY_KEYS.map(key => <label key={key} className="flex gap-2 text-xs"><input type="checkbox" checked={(first.zmanKeys ?? ZMAN_DISPLAY_KEYS.filter(k => !config.hidden.includes(`zman.${k}`))).includes(key)} onChange={ev => { const keys = first.zmanKeys ?? ZMAN_DISPLAY_KEYS.filter(k => !config.hidden.includes(`zman.${k}`)); patch({ zmanKeys: ev.target.checked ? [...keys, key] : keys.filter(k => k !== key) }); }} />{ZMAN_DISPLAY_LABELS[key]}</label>)}</div>
        </div>}
        <label className="text-xs">שם החלק<input className={FIELD} aria-label="שם החלק" value={first.name} onChange={e => patch({ name: e.target.value })} /></label>
        {([['x', 'מיקום אופקי', 0, 100], ['y', 'מיקום אנכי', 0, 100], ['width', 'רוחב החלק', 1, 100], ['height', 'גובה החלק', 1, 100], ['rotation', 'סיבוב', -180, 180], ['opacity', 'אטימות', 0, 1]] as const).map(([key, label, min, max]) => <label className="text-xs" key={key}>{label}<input type="number" className={FIELD} aria-label={label} min={min} max={max} step={key === 'opacity' ? .1 : .5} value={Number(first[key].toFixed(2))} onChange={ev => { if (ev.target.value !== '') patch({ [key]: Number(ev.target.value) }); }} /></label>)}
        {/* A picture's colour is its own (tuned below), and a text's is in the text bar when that is open:
            a colour row there changed nothing that could be seen. */}
        {!pictured && !(first.kind === 'text' && textToolsElsewhere) && <div className="col-span-full"><ColourRow label="צבע החלק" value={first.color} onChange={v => patch({ color: v })} /></div>}
        {(first.kind === 'box' || (first.kind === 'frame' && !first.image)) && <div className="col-span-full"><ColourRow label="מילוי החלק" value={first.fill === 'transparent' ? '#ffffff' : first.fill} onChange={v => patch({ fill: v })} reset={{ label: 'בלי מילוי', onClick: () => patch({ fill: 'transparent' }), disabled: first.fill === 'transparent' }} /></div>}
        {sectionOf(elements, first.id).some(id => { const x = elements.find(e => e.id === id)!; return x.kind === 'frame' || x.kind === 'box' || x.name.startsWith('מסגרת'); }) && (
          <div className="col-span-full space-y-1">
            <label className="flex flex-wrap items-center gap-2 text-sm">
              צורת התיבה והמסגרת:
              <select aria-label="צורת התיבה והמסגרת" className={SELECT_CLASS} value={elements.find(e => sectionOf(elements, first.id).includes(e.id) && e.shape)?.shape ?? ''} onChange={ev => { if (ev.target.value) commit(setSectionShape(elements, first.id, ev.target.value as NonNullable<BoardElement['shape']>)); }}>
                <option value="" disabled>בחירת צורה</option>
                {Object.entries(SECTION_SHAPES).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
              </select>
            </label>
            <p className="text-[11px] text-muted-foreground">הצורה חלה על המסגרת, המילוי ומקום התוכן יחד. מסגרת מצולמת מתחלפת במסגרת מצוירת; אפשר לחזור בצעד אחורה.</p>
          </div>
        )}
        {first.kind === 'box' && !first.shape && <div className="col-span-full"><SwitchRow label="מילוי בצורת קשת" ariaLabel="מילוי בצורת קשת" checked={first.archFill ?? false} onChange={(on) => patch({ archFill: on })} /></div>}
        {pictured && (
          // The whole picture's colours - a background, a frame or an ornament - not one carving in it.
          <div className="col-span-full space-y-2 rounded-md border p-3" data-testid="image-colour-tools">
            <p className="text-sm font-medium">צבעוניות התמונה</p>
            <p className="text-[11px] text-muted-foreground">משנה את כל התמונה שנבחרה - רקע, מסגרת או קישוט. לא צובע גילוף מסוים בתוך התמונה.</p>
            {([['hue', 'גוון התמונה', -180, 180, 1, 0], ['saturation', 'רוויה בתמונה', 0, 2, 0.05, 1], ['brightness', 'בהירות התמונה', 0.2, 2, 0.05, 1]] as const).map(([key, label, min, max, step, base]) => (
              <Range key={key} label={label} min={min} max={max} step={step} value={first.imageTune?.[key] ?? base}
                show={(v) => (key === 'hue' ? `${Math.round(v)}°` : `${Math.round(v * 100)}%`)}
                onChange={(v) => patch({ imageTune: { hue: 0, saturation: 1, brightness: 1, ...first.imageTune, [key]: v } })} />
            ))}
            <ResetButton onClick={() => patch({ imageTune: undefined })}>חזרה לצבעוניות המקורית</ResetButton>
          </div>
        )}
        {first.kind === 'text' && <label className="text-xs">מקור התוכן<select className={`${SELECT_CLASS} mt-1 block w-full`} aria-label="מקור התוכן של החלק" value={first.binding ?? ''} onChange={e => patch({ binding: (e.target.value || undefined) as BoardElement['binding'] })}><option value="">טקסט חופשי</option>{ELEMENT_BINDINGS.map(b => <option key={b} value={b}>{BINDING_LABELS[b]}</option>)}</select></label>}
        {/* The letters - size, font, bold, wrapping, the words - in the same bar as under the board's preview. */}
        {first.kind === 'text' && <div className="col-span-full">{textToolsElsewhere
          ? <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground" data-testid="text-tools-elsewhere">עיצוב הטקסט (גודל, גופן, מודגש, גלישת שורות) נמצא מתחת לתצוגה המקדימה של הלוח.</p>
          : <ElementTextTools elements={elements} ids={selected} withColor={false} onPatch={textPatch} />}</div>}
      </fieldset>
    </SubPart>}

    {/* Adding content: a new frame, instead of a frame's content, or into a frame. On a board of parts - in the layout tab. */}
    <SubPart title="הוספת תוכן" hint={parts ? undefined : 'תוכן חי - פרשת השבוע, הדף היומי, זמני היום ועוד - במסגרת חדשה, במקום תוכן של מסגרת, או בתוכה.'}>
      {parts ? <p className="rounded-md border border-dashed p-3 text-sm" data-testid="add-content-elsewhere">הוספת תוכן (פרשת השבוע, הדף היומי, זמני היום ועוד), והצד של כל תוכן - בלשונית <b>פריסה</b>, תחת "מה יופיע על הלוח, ובאיזה צד".</p> : <AddContent elements={elements} onCommit={(next, key, ids) => { commit(next, key); select(ids); }}
        library={config.elementLibrary}
        defaults={config.elementDefaults}
        onDefaults={(next) => onEdit('element-defaults', (c) => ({ ...c, elementDefaults: next }))}
        onLibrary={(next) => onEdit('element-library', (c) => ({ ...c, elementLibrary: next }))} />}
    </SubPart>

    <SubPart title="רשימת החלקים" hint={`${parts ? 'לחלקים שאינם תוכן (עיטורים, עמודים, תמונות): ' : ''}בכל שורה: ימין, אמצע או שמאל מזיזים את החלק יחד עם המסגרת שלו. אם בצד הזה כבר עומד חלק אחר, השניים מתחלפים. הסמל האחרון בוחר את החלק לגרירה ידנית על הלוח.`}>
      {/* Several parts at once: tick them (or Shift + click), then show, hide, lock or free them all. */}
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-xs" role="group" aria-label="פעולות על כמה חלקים" data-testid="elements-bulk">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" aria-label="בחירת כל החלקים" className="size-4"
            checked={elements.length > 0 && selected.length === elements.length}
            ref={el => { if (el) el.indeterminate = selected.length > 0 && selected.length < elements.length; }}
            onChange={ev => select(ev.target.checked ? elements.map(x => x.id) : [])} />
          {selected.length ? `נבחרו ${selected.length}` : 'בחירת הכול'}
        </label>
        {selected.length > 0 && ([['הסתרה', { hidden: true }], ['הצגה', { hidden: false }], ['נעילה', { locked: true }], ['שחרור', { locked: false }]] as const).map(([label, p]) => (
          <Button key={label} type="button" size="sm" variant="outline" className="h-7"
            onClick={() => commit(elements.map(x => selected.includes(x.id) ? { ...x, ...p } : x), `elements-bulk:${label}:${selected.join(',')}`)}>
            {label} לנבחרים
          </Button>
        ))}
      </div>
      <div className="space-y-1" aria-label="שכבות החלקים">{[...elements].reverse().map(e => {
        const sec = sections.get(e.id);
        const mates = sec ? elements.filter(x => sec.ids.includes(x.id) && x.id !== e.id).map(x => x.name) : [];
        const tip = mates.length ? ` - זז יחד עם: ${mates.join(', ')}` : '';
        return <div key={e.id} className={`flex items-center gap-2 rounded-md border px-2 py-1 ${selected.includes(e.id) ? 'border-primary bg-primary/10' : ''}`}>
          <input type="checkbox" aria-label={`בחירת ${e.name}`} className="size-4 shrink-0" checked={selected.includes(e.id)}
            onChange={ev => select(s => ev.target.checked ? [...new Set([...s, e.id])] : s.filter(id => id !== e.id))} />
          <button type="button" className={`min-w-0 flex-1 truncate text-right text-sm ${e.hidden ? 'text-muted-foreground line-through' : ''}`} onClick={ev => choose(e, ev.shiftKey)}>{e.name}{e.group ? ' · קבוצה' : ''}</button>
          <div className="flex shrink-0 items-center gap-0.5" role="group" aria-label={`מיקום של ${e.name}`} data-testid="element-side">
            {!inLayoutTab.has(e.id) && SIDE_CHOICES.map(([side, label, Icon]) => <button key={side} type="button" aria-label={`${e.name} ל${label}`} aria-pressed={sec?.side === side} title={`להעביר ל${label}${tip}`} disabled={e.locked} onClick={() => place(e, side)} className={sideButtonClass(sec?.side === side)}><Icon className="size-4" aria-hidden /></button>)}
            <button type="button" aria-label={`הזזה ידנית של ${e.name}`} title={`הזזה ידנית: בוחר את החלק${mates.length ? ' ואת מה שזז איתו' : ''}, ואז גוררים על הלוח`} disabled={e.locked} onClick={() => manual(e)} className={SIDE_BUTTON}><Move className="size-4" aria-hidden /></button>
          </div>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" aria-label={`${e.hidden ? 'הצגת' : 'הסתרת'} ${e.name}`} onClick={() => commit(elements.map(x => x.id === e.id ? { ...x, hidden: !x.hidden } : x))}>{e.hidden ? 'הצגה' : 'הסתרה'}</Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" aria-label={`${e.locked ? 'שחרור' : 'נעילת'} ${e.name}`} onClick={() => commit(elements.map(x => x.id === e.id ? { ...x, locked: !x.locked } : x))}>{e.locked ? 'שחרור' : 'נעילה'}</Button>
        </div>;
      })}</div>
    </SubPart>

    <ElementLibrary config={config} selected={selected} onEdit={onEdit} onSelect={select} />
    <p className="text-[11px] text-muted-foreground">השינויים מופיעים גם בתצוגת הלוח. שמירה וביטול משתמשים בכפתורי העורך הראשיים.</p>
  </div>;
}
