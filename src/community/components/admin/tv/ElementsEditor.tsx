import { useMemo, useState } from 'react';
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
import { ZMAN_DISPLAY_KEYS, ZMAN_DISPLAY_LABELS } from '@/community/lib/zmanim';
import { SubPart } from './Parts';
import { Notice } from './Notice';
import { KindPicker, kindName, ofKind } from './KindPicker';
import { ContainerLayers, type Board } from './ContainerLayers';
import { useTvLibraryItems } from './useTvLibrary';
import { FileButton, useFileTask, useUpload } from './Upload';
import { ColourRow, FIT_CHOICES, HideToggle, INPUT_CLASS, LockToggle, Range, ResetButton, SELECT_CLASS, SIDE_BUTTON, SIDE_CHOICES, Segments, Stepper, SwitchRow, sideButtonClass } from './editorParts';

/** A field of the chosen part: the editor's one height and border. */
const FIELD = `mt-1 block w-full ${INPUT_CLASS}`;
/** Where it stands and how big it is, in shares of the board; the turn in degrees. Typed or stepped. */
const PLACE = [['x', 'מיקום אופקי', 0, 100, 0.5], ['y', 'מיקום אנכי', 0, 100, 0.5], ['width', 'רוחב החלק', 1, 100, 0.5], ['height', 'גובה החלק', 1, 100, 0.5], ['rotation', 'סיבוב', -180, 180, 1]] as const;
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
  const { selected, select, alone, selectAlone, snap, setSnap, gridStep, setGridStep, showGrid, setShowGrid, linkSection, setLinkSection } = useElementEditing()!;
  const first = elements.find(e => e.id === selected[0]);
  /** A picture (or a frame drawn from one): its colours are tuned, not painted. */
  const pictured = !!first && (first.kind === 'image' || (first.kind === 'frame' && !!first.image));
  /** The list of parts shows one kind (an index of KIND_GROUPS) or all of them. */
  const [listKind, setListKind] = useState<number | null>(null);
  const listed = ofKind(elements, listKind);
  const lockedInSelection = elements.some(e => selected.includes(e.id) && e.locked);
  const commit = (next: BoardElement[], key = `elements:${crypto.randomUUID()}`) => onEdit(key, c => ({ ...c, elements: normalizeElements(next) }));
  const patch = (p: Partial<BoardElement>) => {
    // A frame, its box and its text, linked: a size or a turn is the whole section's, kept fitting together.
    // A part chosen alone (one of a section) changes alone; the section chosen whole changes together.
    const together = linkSection && !alone;
    if (first && together) { for (const key of ['width', 'height', 'rotation'] as const) if (key in p) { commit(sectionGeometry(elements, first.id, key, p[key]!)); return; } }
    if (first && ('x' in p || 'y' in p)) { commit(moveElements(elements, together ? linkedSection(elements, first.id) : selected, (p.x ?? first.x) - first.x, (p.y ?? first.y) - first.y)); return; }
    // A picture alone with "שמירת יחס": its other side follows the one typed.
    if (first?.ratio && selected.length === 1) {
      if ('width' in p && !('height' in p)) p = { ...p, height: Math.min(100, first.height * p.width! / first.width) };
      else if ('height' in p && !('width' in p)) p = { ...p, width: Math.min(100, first.width * p.height! / first.height) };
    }
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
  const { uploading, upload } = useUpload();
  const files = useFileTask('ייבוא החלקים נכשל');
  /** A picture as a part of its own: into the synagogue's picture storage, transparency kept - the board keeps only its address. */
  const sharedLibrary = useTvLibraryItems();
  const addPicture = (f: File) => {
    if (elements.length >= MAX_ELEMENTS || f.size > 15_000_000 || !['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) return void toast.error(`בחרו קובץ תמונה רגיל (עד 15 מגה), ועד ${MAX_ELEMENTS} חלקים בלוח`);
    void upload([f], ([image]) => {
      const e = { ...newElement('image'), image, name: f.name.replace(/\.[a-z0-9]{2,5}$/i, ''), x: 30, y: 25, width: 40, height: 50 };
      commit([...elements, e]); select([e.id]);
      // Kept in "התמונות שלי" too, to be put on any board again.
      sharedLibrary.keepImage(image, f.name);
    });
  };
  const importParts = (f: File) => files.run(async () => {
    if (f.size > 15_000_000) throw new Error('הקובץ גדול מדי');
    const added = importElementSet(await f.text());
    if (elements.length + added.length > MAX_ELEMENTS) throw new Error(`עד ${MAX_ELEMENTS} חלקים בלוח`);
    commit([...elements, ...added]); select(added.map(e => e.id));
  });
  const manual = (e: BoardElement) => {
    const ids = sections.get(e.id)?.ids ?? [e.id];
    select([...ids]);
    toast(ids.length > 1 ? `"${e.name}" נבחר יחד עם ${ids.length - 1} החלקים שזזים איתו. גררו אותו על הלוח, או הזיזו בחצים של המקלדת.` : `"${e.name}" נבחר. גררו אותו על הלוח, או הזיזו בחצים של המקלדת.`);
  };

  /** A part's row of the list: the same in the flat list and inside a container. */
  const partRow = (e: BoardElement, inContainer = false) => {
        const sec = sections.get(e.id);
        const mates = sec ? elements.filter(x => sec.ids.includes(x.id) && x.id !== e.id).map(x => x.name) : [];
        const tip = mates.length ? ` - זז יחד עם: ${mates.join(', ')}` : '';
        return <div key={e.id} className={`flex items-center gap-2 rounded-md border px-2 py-1 ${selected.includes(e.id) ? 'border-primary bg-primary/10' : ''}`}>
          <input type="checkbox" aria-label={`בחירת ${e.name}`} className="size-4 shrink-0" checked={selected.includes(e.id)}
            onChange={ev => select(s => ev.target.checked ? [...new Set([...s, e.id])] : s.filter(id => id !== e.id))} />
          <button type="button" className={`min-w-0 flex-1 truncate text-right text-sm ${e.hidden ? 'text-muted-foreground line-through' : ''}`} onClick={ev => choose(e, ev.shiftKey)}>{e.name}{e.group && !inContainer ? ' · קבוצה' : ''}</button>
          <div className="flex shrink-0 items-center gap-0.5" role="group" aria-label={`מיקום של ${e.name}`} data-testid="element-side">
            {!inLayoutTab.has(e.id) && SIDE_CHOICES.map(([side, label, Icon]) => <button key={side} type="button" aria-label={`${e.name} ל${label}`} aria-pressed={sec?.side === side} title={`להעביר ל${label}${tip}`} disabled={e.locked} onClick={() => place(e, side)} className={sideButtonClass(sec?.side === side)}><Icon className="size-4" aria-hidden /></button>)}
            <button type="button" aria-label={`הזזה ידנית של ${e.name}`} title={`הזזה ידנית: בוחר את החלק${mates.length ? ' ואת מה שזז איתו' : ''}, ואז גוררים על הלוח`} disabled={e.locked} onClick={() => manual(e)} className={SIDE_BUTTON}><Move className="size-4" aria-hidden /></button>
          </div>
          <span className="flex shrink-0 items-center gap-0.5">
            <HideToggle hidden={e.hidden} name={e.name} onToggle={() => commit(elements.map(x => x.id === e.id ? { ...x, hidden: !x.hidden } : x))} />
            <LockToggle locked={e.locked} name={e.name} onToggle={() => commit(elements.map(x => x.id === e.id ? { ...x, locked: !x.locked } : x))} />
          </span>
        </div>;
  };
  /** A change to the parts and the containers together, as one step of the history. */
  const editBoard = (key: string, change: (b: Board) => Board) =>
    onEdit(key, c => { const b = change({ elements: c.elements, containers: c.containers ?? [] }); return { ...c, elements: normalizeElements(b.elements), containers: b.containers }; });

  return <div className="space-y-5" data-testid="elements-editor">
    {elements.some(e => e.sourceMask)
      ? <Notice variant="neutral" data-testid="artwork-mask-disclosure">פרטי הציור המקורי מופרדים במסכות: מסגרות, מילויים, עמודים וקישוטים. אפשר להזיז ולהסתיר כל חלק בנפרד; הטקסט והשעון חיים. הקישוט של הפמוטים, הספר והענף נשמר כקבוצה אחת. רקע משלים ייחשף כאשר תזיזו חלק.</Notice>
      : elements.some(e => e.crop) && <Notice variant="warning" data-testid="artwork-layer-disclosure">בערכה זו יש תמונות חתוכות. חיתוך מלבני לבדו אינו מפריד מסגרת מהרקע שסביבה; בערכות הציור הוותיקות הם נשארים יחד. הטקסט והשעון נפרדים.</Notice>}

    <SubPart title="הוספת חלק" hint={parts ? 'גררו חלק למקומו. Shift + לחיצה לבחירה משותפת. המסגרות, המילויים והתוכן החי של הערכה נמצאים ברשימת החלקים למטה.' : 'גררו חלק למקומו. Shift + לחיצה לבחירה משותפת. החלקים עומדים מעל תוכן הלוח; הרקע והתיבות נשארים בכלים שלמעלה.'}>
      <div className="flex flex-wrap gap-2">
        {ELEMENT_KINDS.filter(k => k !== 'image').map(kind => <Button size="sm" variant="outline" className="h-8" key={kind} disabled={elements.length >= MAX_ELEMENTS} onClick={() => { const e = newElement(kind); commit([...elements, e]); select([e.id]); }}>הוספת {ELEMENT_NAMES[kind]}</Button>)}
        <FileButton label="הוספת תמונה" ariaLabel="הוספת תמונה כחלק" accept="image/png,image/jpeg,image/webp" busy={uploading} onFiles={([f]) => addPicture(f)} />
      </div>
    </SubPart>

    <SubPart title="משטח העבודה" hint="בעריכה ישירה בלוח אפשר לגרור גם על התצוגה האמיתית. כשהלוח ממוקד: חצים להזזה עדינה, Shift לתזוזה גדולה, Delete למחיקה, Ctrl+D לשכפול ו־Esc לביטול בחירה. לחיצה עם Alt או לחיצה כפולה - החלק לבדו. לחיצה נוספת באותו מקום - החלק שמתחת. לחיצה ימנית - רשימת כל החלקים במקום.">
      <SwitchRow label="הצמדה לרשת" ariaLabel="הצמדה לרשת" checked={snap} onChange={setSnap} />
      <SwitchRow label="מסגרת, תיבה וטקסט יחד" ariaLabel="מסגרת, תיבה וטקסט יחד" hint="גרירה, גודל וסיבוב חלים על כל החלקים של אותה מסגרת" checked={linkSection} onChange={(on) => { setLinkSection(on); if (!on && first) select([first.id]); }} />
      <SwitchRow label="הצגת רשת ומידות" ariaLabel="הצגת רשת ומידות" checked={showGrid} onChange={setShowGrid} />
      <label className="flex flex-wrap items-center gap-2 text-sm">
        מרווח הרשת:
        <select aria-label="מרווח הרשת" className={SELECT_CLASS} value={gridStep} onChange={e => setGridStep(Number(e.target.value))}>
          {[1, 2, 5, 10].map(v => <option key={v} value={v}>{v}% - {Math.round(19.2 * v)} על {Math.round(10.8 * v)} נקודות במסך מלא</option>)}
        </select>
      </label>
      {/* Its line is always there (empty with nothing chosen): choosing a part must not push the board down under the mouse. */}
      {!first && <p className="min-h-[3.75em] text-[11px]" aria-hidden />}
      {first && <p className="min-h-[3.75em] text-[11px] text-muted-foreground" data-testid="element-measurements"><span dir="ltr">{first.width.toFixed(1)}% × {first.height.toFixed(1)}%</span> - מידות החלק. שוליים: שמאל <span dir="ltr">{first.x.toFixed(1)}%</span>, ימין <span dir="ltr">{(100 - first.x - first.width).toFixed(1)}%</span>, למעלה <span dir="ltr">{first.y.toFixed(1)}%</span>, למטה <span dir="ltr">{(100 - first.y - first.height).toFixed(1)}%</span>. המידות יחסיות ללוח; במסך מלא (<span dir="ltr">1920×1080</span>) זה <span dir="ltr">{Math.round(first.width * 19.2)}×{Math.round(first.height * 10.8)}</span> נקודות.</p>}
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
        {/* Over and under the others: the layers, not an order of turns. */}
        <Button size="sm" variant="outline" className="h-8" disabled={!first} title="מעל שאר החלקים" onClick={() => commit([...elements.filter(e => !selected.includes(e.id)), ...elements.filter(e => selected.includes(e.id))])}>שכבה למעלה</Button>
        <Button size="sm" variant="outline" className="h-8" disabled={!first} title="מתחת לשאר החלקים" onClick={() => commit([...elements.filter(e => selected.includes(e.id)), ...elements.filter(e => !selected.includes(e.id))])}>שכבה למטה</Button>
        {/* In and out in a file, in the words of "ייבוא וייצוא" in the tools tab: these are the parts alone. */}
        <Button size="sm" variant="outline" className="h-8" disabled={!first} onClick={() => downloadFile(new Blob([exportElementSet(elements.filter(e => selected.includes(e.id)))], { type: 'application/json' }), 'חלקים.json')}>ייצוא הבחירה לקובץ</Button>
        <FileButton label="ייבוא חלקים מקובץ" ariaLabel="ייבוא חלקים מקובץ" accept=".json" icon={null} busy={files.busy} onFiles={([f]) => void importParts(f)} />
        <Button size="sm" variant="outline" className="h-8 text-destructive" disabled={!first || lockedInSelection} onClick={() => void removeSelection()}>מחיקת הבחירה</Button>
      </div>
    </SubPart>

    {first && <SubPart title="החלק שנבחר">
      <fieldset disabled={first.locked} className="grid grid-cols-2 gap-2 rounded-lg border p-3 sm:grid-cols-3">
        <p className="col-span-full text-[11px] text-muted-foreground" data-testid="selected-layer-type">סוג החלק: {first.sourceMask ? 'חלק מהציור עם מסכה שקופה' : first.crop ? 'אזור מתוך תמונה' : first.binding ? 'תוכן חי נפרד' : ELEMENT_NAMES[first.kind]}</p>
        {['prayers', 'lessons', 'zmanim'].includes(first.binding ?? '') && <div className="text-xs">שורות בכל עמוד<div className="mt-1"><Stepper label="שורות בכל עמוד בחלק" value={first.rowsPerPage ?? 3} min={1} max={30} step={1} onChange={v => patch({ rowsPerPage: v })} /></div><p className="mt-1 text-[11px] text-muted-foreground">לחלק הזה בלבד. בלוח הרגיל, כמה מניינים בכל מסך נקבע בלשונית "פריסה", תחת "זמני התפילות בלוח".</p></div>}
        {SCROLLABLE.includes(first.binding as ElementBinding) && <div className="col-span-full space-y-1 text-xs">כשהתוכן לא נכנס<Segments label="כשהתוכן לא נכנס בחלק" value={first.scroll ?? ''} onChange={v => patch({ scroll: (v || undefined) as BoardElement['scroll'] })} options={FIT_CHOICES(first.binding as ElementBinding)} /><p className="text-[11px] text-muted-foreground">לחלק הזה בלבד. לתיבות של הלוח הרגיל - בלשונית "פריסה", תחת "כשהתוכן לא נכנס לתיבה".</p></div>}
        {first.binding === 'zmanim' && <div className="col-span-full space-y-2" data-testid="element-zmanim-picker">
          <p className="text-[11px] text-muted-foreground">מג״א מחושב לפי 72 דקות קבועות לפני הנץ ואחרי השקיעה. הגר״א מחושב מהנץ לשקיעה. ברירת המחדל: הזמנים שלא הוסתרו בלוח (בעריכה ישירה בלוח).</p>
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => patch({ zmanKeys: [...ZMAN_DISPLAY_KEYS], rowsPerPage: ZMAN_DISPLAY_KEYS.length, fontSize: Math.min(first.fontSize, first.height / (ZMAN_DISPLAY_KEYS.length * 2.2)) })}>הצגת כל זמני היום יחד</Button>
          {/* Several to pick: tick boxes. */}
          <div className="grid gap-2 sm:grid-cols-2">{ZMAN_DISPLAY_KEYS.map(key => <label key={key} className="flex gap-2 text-xs"><input type="checkbox" checked={(first.zmanKeys ?? ZMAN_DISPLAY_KEYS.filter(k => !config.hidden.includes(`zman.${k}`))).includes(key)} onChange={ev => { const keys = first.zmanKeys ?? ZMAN_DISPLAY_KEYS.filter(k => !config.hidden.includes(`zman.${k}`)); patch({ zmanKeys: ev.target.checked ? [...keys, key] : keys.filter(k => k !== key) }); }} />{ZMAN_DISPLAY_LABELS[key]}</label>)}</div>
        </div>}
        <label className="text-xs">שם החלק<input className={FIELD} aria-label="שם החלק" value={first.name} onChange={e => patch({ name: e.target.value })} /></label>
        {PLACE.map(([key, label, min, max, step]) => <div className="space-y-1 text-xs" key={key}>{label}<Stepper label={label} value={Number(first[key].toFixed(2))} min={min} max={max} step={step} format={(v) => key === 'rotation' ? `${v}°` : `${v}%`} onChange={v => patch({ [key]: v })} /></div>)}
        {/* See-through, as everywhere in the editor: a share, 100% hides what is under it. */}
        <div className="col-span-full"><Range label="אטימות" value={Math.round(first.opacity * 100)} min={0} max={100} step={5} show={(v) => `${v}%`} onChange={v => patch({ opacity: v / 100 })} /></div>
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
        {/* A picture of one's own (not a piece of a kit's painting): its shape, how it fills it, its proportions. */}
        {first.kind === 'image' && first.image && !first.crop && !first.sourceMask && (
          <div className="col-span-full space-y-2 rounded-md border p-3" data-testid="own-image-tools">
            <p className="text-sm font-medium">התמונה</p>
            <label className="flex flex-wrap items-center gap-2 text-sm">
              צורת התמונה:
              <select aria-label="צורת התמונה" className={SELECT_CLASS} value={first.shape ?? ''} onChange={ev => patch({ shape: (ev.target.value || undefined) as BoardElement['shape'] })}>
                <option value="">מלבן, בלי צורה</option>
                {Object.entries(SECTION_SHAPES).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">התאמה:</span>
              <Segments label="התאמת התמונה" value={first.fit ?? 'contain'} onChange={(v) => patch({ fit: v === 'cover' ? 'cover' : undefined })}
                options={[{ id: 'contain', name: 'כל התמונה', hint: 'כל התמונה נראית, ואם צריך נשאר מקום ריק סביבה' }, { id: 'cover', name: 'מילוי התבנית', hint: 'התמונה ממלאת את כל הצורה, והשוליים שלה נחתכים' }]} />
            </div>
            <SwitchRow label="שמירת יחס" ariaLabel="שמירת יחס" hint="גרירת ידית או שינוי רוחב משנים גם את הגובה - התמונה לא נמתחת" checked={first.ratio ?? false} onChange={(on) => patch({ ratio: on || undefined })} />
          </div>
        )}
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
        {/* What a text shows is each text's own: not offered for several at once, where one choice would make them all show it. */}
        {first.kind === 'text' && selected.length > 1 && <p className="text-[11px] text-muted-foreground" data-testid="content-source-one">מקור התוכן (מה הטקסט מציג) נבחר לכל טקסט לבד - בחרו טקסט אחד כדי לשנות אותו.</p>}
        {first.kind === 'text' && selected.length === 1 && <label className="text-xs">מקור התוכן<select className={`${SELECT_CLASS} mt-1 block w-full`} aria-label="מקור התוכן של החלק" value={first.binding ?? ''} onChange={e => patch({ binding: (e.target.value || undefined) as BoardElement['binding'] })}><option value="">טקסט חופשי</option>{ELEMENT_BINDINGS.map(b => <option key={b} value={b}>{BINDING_LABELS[b]}</option>)}</select></label>}
        {/* The letters - size, font, bold, wrapping, the words - in the same bar as under the board's preview. */}
        {first.kind === 'text' && <div className="col-span-full">{textToolsElsewhere
          ? <Notice variant="neutral" data-testid="text-tools-elsewhere">עיצוב הטקסט (גודל, גופן, מודגש, גלישת שורות, מה כתוב) נמצא בלשונית "טקסט" בחלון של החלק הנבחר, ליד הלוח.</Notice>
          : <ElementTextTools elements={elements} ids={selected} withColor={false} onPatch={textPatch} />}</div>}
      </fieldset>
    </SubPart>}

    {/* Adding content: a new frame, instead of a frame's content, or into a frame - beside adding a part, on every board. */}
    <SubPart title="הוספת תוכן" hint={parts ? 'תוכן חי - פרשת השבוע, הדף היומי, זמני היום ועוד - במסגרת חדשה, במקום תוכן של מסגרת, או בתוכה. הצד של כל תוכן ומה כל מסגרת מציגה - בלשונית פריסה.' : 'תוכן חי - פרשת השבוע, הדף היומי, זמני היום ועוד - במסגרת חדשה, במקום תוכן של מסגרת, או בתוכה.'}>
      <AddContent elements={elements} onCommit={(next, key, ids) => { commit(next, key); select(ids); }}
        library={config.elementLibrary}
        defaults={config.elementDefaults}
        onDefaults={(next) => onEdit('element-defaults', (c) => ({ ...c, elementDefaults: next }))} />
    </SubPart>

    <SubPart title="רשימת החלקים" hint={`${parts ? 'לחלקים שאינם תוכן (עיטורים, עמודים, תמונות): ' : ''}בכל שורה: ימין, אמצע או שמאל מזיזים את החלק יחד עם המסגרת שלו. אם בצד הזה כבר עומד חלק אחר, השניים מתחלפים. הסמל האחרון בוחר את החלק לגרירה ידנית על הלוח.`}>
      {/* Several parts at once: tick them (or Shift + click), then show, hide, lock or free them all. */}
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-xs" role="group" aria-label="פעולות על כמה חלקים" data-testid="elements-bulk">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" aria-label="בחירת כל החלקים" className="size-4"
            checked={listed.length > 0 && listed.every(x => selected.includes(x.id))}
            ref={el => { if (el) el.indeterminate = listed.some(x => selected.includes(x.id)) && !listed.every(x => selected.includes(x.id)); }}
            onChange={ev => { const ids = listed.map(x => x.id); select(s => ev.target.checked ? [...new Set([...s, ...ids])] : s.filter(id => !ids.includes(id))); }} />
          {selected.length ? `נבחרו ${selected.length}` : listKind === null ? 'בחירת הכול' : `בחירת כל ה${kindName(listKind)}`}
        </label>
        {selected.length > 0 && <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => select([])}>ניקוי הבחירה</Button>}
        {selected.length > 0 && ([['הסתרה', { hidden: true }], ['הצגה', { hidden: false }], ['נעילה', { locked: true }], ['שחרור', { locked: false }]] as const).map(([label, p]) => (
          <Button key={label} type="button" size="sm" variant="outline" className="h-7"
            onClick={() => commit(elements.map(x => selected.includes(x.id) ? { ...x, ...p } : x), `elements-bulk:${label}:${selected.join(',')}`)}>
            {label} לנבחרים
          </Button>
        ))}
      </div>
      {/* All of one kind at once; the list then shows that kind alone, to take some of them off. */}
      <KindPicker elements={elements} selected={selected} select={select} onKind={setListKind} />
      {listKind !== null && <p className="flex flex-wrap items-center gap-2 text-xs" data-testid="elements-list-kind">
        <span>ברשימה: {kindName(listKind)} בלבד ({listed.length}). מסמנים או מורידים סימון מכל אחד.</span>
        <button type="button" className="font-medium text-primary underline underline-offset-2" onClick={() => setListKind(null)}>הצגת כל החלקים</button>
      </p>}
      <div className="space-y-1" aria-label="שכבות החלקים">
        {/* A board of parts, all of it shown: its containers, as a tree. One kind chosen above: those parts, in a flat list. */}
        {parts && listKind === null
          ? <ContainerLayers elements={elements} containers={config.containers ?? []} selected={selected} select={select} selectAlone={selectAlone} edit={editBoard} row={partRow} />
          : [...listed].reverse().map(e => partRow(e))}
      </div>
    </SubPart>

    <ElementLibrary config={config} selected={selected} onEdit={onEdit} onSelect={select} />
    <p className="text-[11px] text-muted-foreground">השינויים מופיעים גם בתצוגת הלוח. שמירה וביטול משתמשים בכפתורי העורך הראשיים.</p>
  </div>;
}
