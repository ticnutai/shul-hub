import { partShapePath } from './partShapes';
import { FRAME_PICTURES, FRAME_PICTURE_PREFIX, framePictureUrl } from './framePictures';
import { useEffect, useRef, useId, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useElementEditing } from './elementEditing';
import {gridDelta,linkedSection} from './sectionGeometry';
import { ElementDataProvider, BoundElement, PlainText, type ElementData } from './elementData';
import { partBelow, partsAt, pressKind, pressSelection, type Press } from './elementHits';
import { PartPickMenu } from './PartPickMenu';
import { MAX_ELEMENTS, RESIZE_HANDLES, boundsOf, textLook, exportElementSet, importElementSet, moveElements, normalizeElements, elementStyle, ratioResize, resizeElements, type BoardElement, type ResizeHandle } from './elements';

/** Where each handle stands on the selection's box, and the cursor it shows. */
const HANDLE_AT: Record<ResizeHandle, { left: string; top: string; cursor: string }> = {
  n: { left: '50%', top: '0%', cursor: 'ns-resize' }, s: { left: '50%', top: '100%', cursor: 'ns-resize' },
  e: { left: '100%', top: '50%', cursor: 'ew-resize' }, w: { left: '0%', top: '50%', cursor: 'ew-resize' },
  ne: { left: '100%', top: '0%', cursor: 'nesw-resize' }, sw: { left: '0%', top: '100%', cursor: 'nesw-resize' },
  nw: { left: '0%', top: '0%', cursor: 'nwse-resize' }, se: { left: '100%', top: '100%', cursor: 'nwse-resize' },
};
/**
 * Once in a visit: the first press where parts stand one over another tells
 * how to reach the ones underneath. The note is the editor's; the board on a
 * screen never loads it.
 */
let pileHintShown = false;
function showPileHint() {
  if (pileHintShown) return;
  pileHintShown = true;
  try { if (sessionStorage.getItem('tv-pile-hint')) return; sessionStorage.setItem('tv-pile-hint', '1'); } catch { /* without storage: once in this page */ }
  void import('sonner').then(({ toast }) => toast('לחיצה נוספת באותו מקום בוחרת את החלק שמתחת. לחיצה ימנית - רשימת כל החלקים במקום.'));
}
const HANDLE_NAMES: Record<ResizeHandle, string> = { n: 'למעלה', s: 'למטה', e: 'ימינה', w: 'שמאלה', ne: 'פינה ימנית עליונה', nw: 'פינה שמאלית עליונה', se: 'פינה ימנית תחתונה', sw: 'פינה שמאלית תחתונה' };

export function ElementArt({ element: e }: { element: BoardElement }) {
  // Before any early return: a hook is called on every render, in the same order.
  const maskId=useId().replace(/:/g,'');
  if((e.kind==='box'||e.kind==='frame')&&e.shape){
    // One path per shape (partShapes.ts), the same the editor's tile draws.
    return <svg data-geometric-shape={e.shape} viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" aria-hidden>
      <path d={partShapePath(e.shape)} fill={e.kind==='frame'?'none':e.fill} stroke={e.color} strokeWidth={e.kind==='frame'?1.2:.15} />
    </svg>;
  }
  if(e.kind==='image' && e.image && e.sourceMask){
    const m=e.sourceMask,c=e.crop??{x:0,y:0,width:100,height:100};
    return <svg data-source-mask viewBox={`${c.x*m.width/100} ${c.y*m.height/100} ${c.width*m.width/100} ${c.height*m.height/100}`} preserveAspectRatio="none" width="100%" height="100%" role="img" aria-label={e.name}>
      <defs><mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={m.width} height={m.height} style={{maskType:'luminance'}}>
        <path d={m.path} fill="white" shapeRendering="crispEdges" />{m.holes.map((hole,i)=><path key={i} d={hole} fill="black" shapeRendering="crispEdges" />)}
      </mask></defs>
      <image href={e.image} width={m.width} height={m.height} preserveAspectRatio="none" mask={`url(#${maskId})`} />
    </svg>;
  }
  if (e.kind === 'text' && e.binding) return <BoundElement element={e} />;
  if (e.kind === 'frame' && e.image) {
    // A ready frame of the gallery ("frame:<id>", as the boxes of an ordinary board wear it): its own edge and thickness.
    const ready = e.image.startsWith(FRAME_PICTURE_PREFIX) ? FRAME_PICTURES.find(f => FRAME_PICTURE_PREFIX + f.id === e.image) : undefined;
    const src = framePictureUrl(e.image), thick = ready ? `${(ready.width * .87).toFixed(2)}cqh` : '2.6cqh';
    return src ? <div data-art-frame style={{ width: '100%', height: '100%', boxSizing: 'border-box', border: `${thick} solid transparent`, borderImage: `url("${src}") ${ready?.slice ?? 20}% / ${thick} stretch`, background: 'transparent' }} /> : null;
  }
  // A symbol laid over an arch (artSymbols.ts) fades into the drawing at its edges.
  if (e.kind === 'image' && e.image && e.crop) return <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...(e.symbol ? { maskImage: 'radial-gradient(closest-side, #000 72%, transparent 100%)', WebkitMaskImage: 'radial-gradient(closest-side, #000 72%, transparent 100%)' } : {}) }}><img src={e.image} alt={e.name} draggable={false} style={{ position: 'absolute', maxWidth: 'none', width: `${10000 / e.crop.width}%`, height: `${10000 / e.crop.height}%`, left: `${-100 * e.crop.x / e.crop.width}%`, top: `${-100 * e.crop.y / e.crop.height}%` }} /></div>;
  if (e.kind === 'image' && e.image && e.shape) {
    // A picture of one's own cut to a shape: the shape's own path (in the picture's own box, so the picture keeps its proportions).
    return <div data-geometric-shape={e.shape} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden><defs>
        <clipPath id={maskId} clipPathUnits="objectBoundingBox"><path d={partShapePath(e.shape)} transform="scale(0.01)" /></clipPath>
      </defs></svg>
      <img src={e.image} alt={e.name} draggable={false} style={{ width: '100%', height: '100%', objectFit: e.fit === 'cover' ? 'cover' : 'contain', clipPath: `url(#${maskId})` }} />
    </div>;
  }
  if (e.kind === 'image') return e.image ? <img src={e.image} alt={e.name} draggable={false} style={{ width: '100%', height: '100%', objectFit: e.fit === 'cover' ? 'cover' : 'contain' }} /> : null;
  if (e.kind === 'text') return <PlainText e={e} />;
  if (e.kind === 'column') return <svg viewBox="0 0 100 600" preserveAspectRatio="none" width="100%" height="100%" aria-hidden>
    <path fill={e.color} d="M0 0H100V18H0ZM6 22H94V38H6ZM12 48H88L79 75H21ZM25 78H75V535H25ZM17 539H83V558H17ZM7 562H93V579H7ZM0 583H100V600H0Z" />
    <path stroke="#fff" opacity=".42" strokeWidth="4" d="M34 84V529M47 84V529M61 84V529" />
    <path fill="none" stroke={e.color} strokeWidth="6" d="M30 48C0 70 0 18 24 31C40 38 24 53 19 40M70 48C100 70 100 18 76 31C60 38 76 53 81 40" />
  </svg>;
  if (e.kind === 'ornament') return <svg viewBox="0 0 300 70" width="100%" height="100%" aria-hidden><g fill="none" stroke={e.color} strokeWidth="3"><path d="M10 40H115Q135 40 150 12Q165 40 185 40H290M25 40C55 0 110 0 105 30S65 35 83 18M275 40C245 0 190 0 195 30S235 35 217 18M115 40Q150 80 185 40"/><path d="M150 12L162 30L150 47L138 30Z"/></g></svg>;
  return <div style={{ width: '100%', height: '100%', border: `${e.kind === 'frame' ? '.6' : '.15'}cqh ${e.kind === 'frame' ? 'double' : 'solid'} ${e.color}`, background: e.fill, borderRadius: e.kind==='box'&&e.archFill?'50% 50% 0 0 / 22% 22% 0 0':'1.5cqh', boxShadow: '0 .3cqh 1cqh #0002', boxSizing: 'border-box' }} />;
}
export function BoardElements({ elements = [], surface = false, data }: { elements?: BoardElement[]; surface?: boolean; data?: ElementData }) {
  const editor = useElementEditing();
  const api = editor?.api.current;
  const enabled = !!editor && !!api && api.elements === elements && (surface || editor.enabled);
  const drag = useRef<{ x: number; y: number; all: BoardElement[]; ids: string[]; width: number; height: number; resize: ResizeHandle | null; last: BoardElement[] | null; pointer: number; click?: string[] } | null>(null);
  const setDraft = editor?.setDraft;
  useEffect(() => {
    // A changed scope, history step or editing mode invalidates an in-flight gesture.
    if (drag.current) { drag.current = null; setDraft?.(null); }
  }, [elements, enabled, setDraft]);
  const shown = enabled && editor.draft ? editor.draft : elements;
  const stop = () => { drag.current = null; editor?.setDraft(null); };
  /** A text of the gabbai's being written into, on the board itself (double click). */
  const [writing, setWriting] = useState<string | null>(null);
  useEffect(() => { if (!enabled) setWriting(null); }, [enabled]);
  const writable = (e: BoardElement) => e.kind === 'text' && !e.binding && !e.alternateTexts && !e.locked;
  /**
   * The press before this one: two on the same text in quick succession are a
   * double click. The browser's own dblclick cannot tell: the first press
   * captures the pointer for dragging, and the click is then the board's.
   */
  const lastDown = useRef<{ id: string; at: number } | null>(null);
  /**
   * The press before this one and the part it chose (elementHits.ts): a quick
   * second press there takes that part alone, a slower one the part under it.
   */
  const lastPress = useRef<Press | null>(null);
  /** The parts at the place of a right click, to choose one of them. */
  const [pickMenu, setPickMenu] = useState<{ x: number; y: number; ids: string[] } | null>(null);
  useEffect(() => { if (!enabled) setPickMenu(null); }, [enabled]);
  const boardRef = useRef<HTMLDivElement>(null);
  /** Where on the board (in its percent) the pointer stands. */
  const pointAt = (board: HTMLElement, clientX: number, clientY: number) => {
    const r = board.getBoundingClientRect();
    return { x: (clientX - r.left) / r.width * 100, y: (clientY - r.top) / r.height * 100 };
  };
  /** Takes one part alone - not the section it moves with - and holds it for dragging. */
  const takeAlone = (ev: ReactPointerEvent<HTMLDivElement>, id: string) => {
    editor!.selectAlone(id);
    if (elements.find(x => x.id === id)?.locked) return;
    const box = ev.currentTarget.getBoundingClientRect();
    ev.currentTarget.setPointerCapture(ev.pointerId);
    drag.current = { x: ev.clientX, y: ev.clientY, all: elements, ids: [id], width: box.width, height: box.height, pointer: ev.pointerId, last: null, resize: null };
  };
  return <ElementDataProvider value={data}><div ref={boardRef} data-testid="board-elements" data-free-edit={enabled ? 'true' : undefined}
    tabIndex={enabled ? 0 : undefined} aria-label={enabled ? 'עריכת חלקים על הלוח' : undefined}
    style={{ position: 'absolute', inset: 0, pointerEvents: surface ? 'auto' : 'none', zIndex: 15, outline: 'none' }}
    onClick={enabled ? e => { if (!e.altKey) e.stopPropagation(); } : undefined}
    onDoubleClick={enabled ? ev => {
      ev.stopPropagation();
      const node = (ev.target as Element).closest<HTMLElement>('[data-element-id]');
      const e = node && elements.find(x => x.id === node.dataset.elementId);
      if (e && writable(e)) { stop(); editor.select([e.id]); setWriting(e.id); }
    } : undefined}
    onKeyDown={enabled ? ev => {
      if (ev.target !== ev.currentTarget || ev.altKey) return;
      const ids = editor.selected;
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); if (drag.current) stop(); else editor.select([]); return; }
      if (!ids.length) return;
      if ((ev.ctrlKey || ev.metaKey) && (ev.code === 'KeyD' || ev.key.toLowerCase() === 'd')) {
        ev.preventDefault(); ev.stopPropagation();
        const picked = elements.filter(e => ids.includes(e.id));
        if (elements.length + picked.length > MAX_ELEMENTS) return;
        const added = importElementSet(exportElementSet(picked)).map(e => ({ ...e, locked: false }));
        api.commit([...elements, ...added]); editor.select(added.map(e => e.id)); return;
      }
      if (ev.ctrlKey || ev.metaKey) return; // Leave the editor's existing undo/redo alone.
      if (ev.key === 'Delete' || ev.key === 'Backspace') {
        ev.preventDefault(); ev.stopPropagation();
        if (elements.some(e => ids.includes(e.id) && e.locked)) return;
        api.commit(elements.filter(e => !ids.includes(e.id))); editor.select([]); return;
      }
      const step = ev.shiftKey ? 2.5 : .25;
      const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (delta[ev.key]) { ev.preventDefault(); ev.stopPropagation(); api.commit(moveElements(elements, ids, ...delta[ev.key]), `element-nudge:${ids.join(',')}`); }
    } : undefined}
    onPointerMove={enabled ? ev => {
      const d = drag.current; if (!d) return;
      ev.stopPropagation();
      if (d.all !== editor.api.current?.elements || !editor.enabled && !surface) { stop(); return; }
      const b=boundsOf(d.all,d.ids),rawX=(ev.clientX-d.x)/d.width*100,rawY=(ev.clientY-d.y)/d.height*100;
      const sx=d.resize?.includes('e')?b.x+b.width:b.x,sy=d.resize?.includes('s')?b.y+b.height:b.y;
      const dx=editor.snap?gridDelta(sx,rawX,editor.gridStep):rawX,dy=editor.snap?gridDelta(sy,rawY,editor.gridStep):rawY;
      // A picture alone with "שמירת יחס": the other side follows the one dragged.
      const lone = d.resize && d.ids.length === 1 ? d.all.find(x => x.id === d.ids[0]) : undefined;
      const r = d.resize && lone?.ratio ? ratioResize(d.resize, b, dx, dy) : null;
      d.last = d.resize ? normalizeElements(resizeElements(d.all, d.ids, r?.handle ?? d.resize, r?.dx ?? dx, r?.dy ?? dy)) : moveElements(d.all, d.ids, dx, dy);
      editor.setDraft(d.last);
    } : undefined}
    onPointerUp={enabled ? ev => {
      const d = drag.current; if (!d) return; ev.stopPropagation();
      // A part carried away: the next press there is a press of its own, not one part down.
      if (d.last) lastPress.current = null;
      if (d.last && d.all === editor.api.current?.elements) api.commit(d.last);
      // A part alone, clicked without being carried: its section is chosen again.
      else if (!d.last && d.click) editor.select(d.click);
      stop();
    } : undefined}
    onContextMenu={enabled ? ev => {
      // A right click: every part at that place, to choose one - also one covered by others.
      const ids = partsAt(elements, pointAt(ev.currentTarget, ev.clientX, ev.clientY));
      if (!ids.length) return;
      ev.preventDefault(); ev.stopPropagation(); stop();
      setPickMenu({ x: ev.clientX, y: ev.clientY, ids });
    } : undefined}
    onPointerCancel={stop} onLostPointerCapture={stop}
    onPointerDown={enabled ? ev => {
      if (ev.button !== 0) return;
      // Inside the text being written: the caret moves, nothing is dragged.
      if ((ev.target as Element).closest('[data-writing]')) return;
      // A handle of the selection: stretch or narrow it, from that side.
      const handle = (ev.target as HTMLElement).dataset.elementHandle as ResizeHandle | undefined;
      if (handle && editor.selected.length && !ev.altKey) {
        lastPress.current = null;
        ev.preventDefault(); ev.stopPropagation(); ev.currentTarget.focus({ preventScroll: true });
        if (elements.some(x => editor.selected.includes(x.id) && x.locked)) return;
        const box = ev.currentTarget.getBoundingClientRect();
        ev.currentTarget.setPointerCapture(ev.pointerId);
        drag.current = { x: ev.clientX, y: ev.clientY, all: elements, ids: editor.selected, width: box.width, height: box.height, pointer: ev.pointerId, last: null, resize: handle };
        return;
      }
      const node = (ev.target as Element).closest<HTMLElement>('[data-element-id]');
      // Alt on the empty board: the board's ordinary click, as before.
      if (!node) { lastPress.current = null; if (!ev.altKey) editor.select([]); return; }
      // The part pressed: the one drawn on top at that place (a turned part, too).
      const e = elements.find(x => x.id === node.dataset.elementId); if (!e) return;
      const at = Date.now(), last = lastDown.current;
      lastDown.current = { id: e.id, at };
      if (!ev.altKey && last?.id === e.id && at - last.at < 450 && writable(e)) {
        ev.preventDefault(); ev.stopPropagation();
        stop(); editor.select([e.id]); setWriting(e.id); lastDown.current = null; lastPress.current = null;
        return;
      }
      ev.preventDefault(); ev.stopPropagation(); ev.currentTarget.focus({ preventScroll: true });
      const pile = partsAt(elements, pointAt(ev.currentTarget, ev.clientX, ev.clientY));
      if (pile.length > 1) showPileHint();
      // Where on the board, not on the screen: the panel above it may grow when a part is chosen,
      // and the board then stands lower under the same hand.
      const r = ev.currentTarget.getBoundingClientRect(), here = { x: ev.clientX - r.left, y: ev.clientY - r.top, at };
      const before = lastPress.current, kind = ev.shiftKey ? 'new' : pressKind(before, here);
      // Alt + click, or a double click: that part alone, without its frame and box.
      if (ev.altKey || kind === 'double') {
        const id = ev.altKey || !before ? e.id : before.id;
        lastPress.current = ev.altKey ? { ...here, id } : null;
        takeAlone(ev, id); return;
      }
      // Pressed again at the same place: the part under the one chosen there, alone.
      if (kind === 'again' && before && pile.length > 1) {
        const id = partBelow(pile, before.id) ?? e.id;
        lastPress.current = { ...here, id };
        takeAlone(ev, id); return;
      }
      lastPress.current = { ...here, id: e.id };
      // A part chosen alone (from the list, Alt, a double click) stays alone under the mouse - also
      // under other parts: dragging moves it by itself. A click on it without dragging takes its
      // section again (or, with the section off, the part pressed); Esc lets it go.
      const alone = ev.shiftKey ? null : editor.alone;
      if (alone && pile.includes(alone)) {
        const again = editor.linkSection && linkedSection(elements, alone).length > 1
          ? pressSelection(alone, linkedSection(elements, alone), [], false)
          : pressSelection(e.id, editor.linkSection ? linkedSection(elements, e.id) : [e.id], [], false);
        lastPress.current = { ...here, id: alone };
        if (elements.find(x => x.id === alone)?.locked) return;
        const box = ev.currentTarget.getBoundingClientRect();
        ev.currentTarget.setPointerCapture(ev.pointerId);
        drag.current = { x: ev.clientX, y: ev.clientY, all: elements, ids: [alone], width: box.width, height: box.height, pointer: ev.pointerId, last: null, resize: null, click: again };
        return;
      }
      // With the section on, the frame, box and text move together - the part pressed first,
      // so the panel of the chosen part shows it and not its frame.
      const ids = pressSelection(e.id, editor.linkSection ? linkedSection(elements, e.id) : [e.id], editor.selected, ev.shiftKey);
      editor.select(ids);
      if (elements.some(x => ids.includes(x.id) && x.locked)) return;
      const box = ev.currentTarget.getBoundingClientRect();
      ev.currentTarget.setPointerCapture(ev.pointerId);
      drag.current = { x: ev.clientX, y: ev.clientY, all: elements, ids, width: box.width, height: box.height, pointer: ev.pointerId, last: null, resize: null };
    } : undefined}>
    {enabled&&editor.showGrid&&<svg data-testid="measurement-grid" viewBox="0 0 100 100" preserveAspectRatio="none" style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:25}} aria-hidden>
      {Array.from({length:Math.ceil(100/editor.gridStep)},(_,i)=>i*editor.gridStep).map(v=><g key={v}><path d={`M${v} 0V100M0 ${v}H100`} stroke="#639bb9" strokeOpacity=".5" strokeWidth=".12"/>{v%10===0&&<><text x={v+.3} y="2" fill="#2788bb" fontSize="1.5">{v}%</text><text x=".3" y={v+2} fill="#2788bb" fontSize="1.5">{v}%</text></>}</g>)}
    </svg>}
    {shown.map(e => <div key={e.id} data-element-id={e.id} data-testid={surface ? `element-${e.id}` : undefined}
      style={{ ...elementStyle(e), pointerEvents: enabled ? 'auto' : 'none', touchAction: enabled ? 'none' : undefined, userSelect: enabled ? 'none' : undefined, cursor: enabled ? e.locked ? 'not-allowed' : 'move' : undefined }}>
      {writing === e.id ? <WriteInPlace element={e} onDone={(text) => {
        setWriting(null);
        if (text !== null && text !== e.text) api.commit(elements.map(x => x.id === e.id ? { ...x, text } : x), `element-write:${e.id}`);
      }} /> : <ElementArt element={e} />}
      {enabled && editor.selected.includes(e.id) && <span data-edit-ui="true" style={{ position: 'absolute', inset: 0, outline: '2px solid #38bdf8', pointerEvents: 'none' }} />}
    </div>)}
    {enabled && <SelectionHandles elements={shown} ids={editor.selected} />}
    {enabled && pickMenu && <PartPickMenu x={pickMenu.x} y={pickMenu.y} current={editor.selected[0]}
      parts={pickMenu.ids.map(id => ({ id, name: elements.find(x => x.id === id)?.name ?? id }))}
      onClose={() => { setPickMenu(null); boardRef.current?.focus({ preventScroll: true }); }}
      onPick={id => {
        // Chosen from the list: that part alone, to move or change by itself.
        setPickMenu(null); editor.selectAlone(id); lastPress.current = null;
        boardRef.current?.focus({ preventScroll: true });
      }} />}
  </div></ElementDataProvider>;
}

/**
 * Eight handles around what is chosen - one part, or an arch with its heading
 * and its content - on every side and corner. Stretching moves only the side
 * held; the parts inside keep their places within the box.
 */
function SelectionHandles({ elements, ids }: { elements: BoardElement[]; ids: string[] }) {
  const chosen = elements.filter(e => ids.includes(e.id) && !e.hidden);
  if (!chosen.length || chosen.some(e => e.locked)) return null;
  const b = boundsOf(chosen, chosen.map(e => e.id));
  return <div data-edit-ui="true" data-testid="selection-handles" style={{ position: 'absolute', left: `${b.x}%`, top: `${b.y}%`, width: `${b.width}%`, height: `${b.height}%`, pointerEvents: 'none', zIndex: 2 }}>
    {RESIZE_HANDLES.map(h => <span key={h} data-element-handle={h} role="button" aria-label={`שינוי גודל - ${HANDLE_NAMES[h]}`}
      style={{ position: 'absolute', left: HANDLE_AT[h].left, top: HANDLE_AT[h].top, width: 12, height: 12, margin: '-6px 0 0 -6px', background: '#38bdf8', border: '2px solid #fff', borderRadius: 3, boxShadow: '0 0 0 1px #0369a1', cursor: HANDLE_AT[h].cursor, pointerEvents: 'auto', touchAction: 'none' }} />)}
  </div>;
}

/**
 * Writing into a text on the board itself: the words where they stand, in
 * their own letters. Enter keeps them (Shift+Enter starts a new line), Esc
 * leaves them as they were, and so does clicking away - it keeps them.
 */
function WriteInPlace({ element: e, onDone }: { element: BoardElement; onDone: (text: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Without scrolling: the board's frame clips its overflow, and a focus that
    // scrolled it to the text left the whole board standing aside.
    el.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []);
  const finish = (text: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(text);
  };
  return <div ref={ref} data-writing="true" contentEditable suppressContentEditableWarning dir="rtl" role="textbox" aria-multiline="true" aria-label={`כתיבה ב${e.name}`}
    style={{ width: '100%', minHeight: '100%', outline: '2px dashed #38bdf8', outlineOffset: 2, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.25, cursor: 'text', userSelect: 'text', ...textLook(e), fontSize: `${e.fontSize}cqh`, background: 'rgba(56, 189, 248, 0.08)' }}
    onKeyDown={ev => {
      ev.stopPropagation();
      if (ev.key === 'Escape') { ev.preventDefault(); finish(null); }
      else if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); finish((ev.currentTarget.innerText ?? '').replace(/\n$/, '').slice(0, 2000)); }
    }}
    onBlur={ev => finish((ev.currentTarget.innerText ?? '').replace(/\n$/, '').slice(0, 2000))}
  >{e.text}</div>;
}
