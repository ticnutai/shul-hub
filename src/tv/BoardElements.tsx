import { useEffect, useRef, useId } from 'react';
import { useElementEditing } from './elementEditing';
import { ElementDataProvider, BoundElement, TurningText, type ElementData } from './elementData';
import { MAX_ELEMENTS, RESIZE_HANDLES, boundsOf, exportElementSet, importElementSet, moveElements, normalizeElements, elementStyle, resizeElements, type BoardElement, type ResizeHandle } from './elements';

/** Where each handle stands on the selection's box, and the cursor it shows. */
const HANDLE_AT: Record<ResizeHandle, { left: string; top: string; cursor: string }> = {
  n: { left: '50%', top: '0%', cursor: 'ns-resize' }, s: { left: '50%', top: '100%', cursor: 'ns-resize' },
  e: { left: '100%', top: '50%', cursor: 'ew-resize' }, w: { left: '0%', top: '50%', cursor: 'ew-resize' },
  ne: { left: '100%', top: '0%', cursor: 'nesw-resize' }, sw: { left: '0%', top: '100%', cursor: 'nesw-resize' },
  nw: { left: '0%', top: '0%', cursor: 'nwse-resize' }, se: { left: '100%', top: '100%', cursor: 'nwse-resize' },
};
const HANDLE_NAMES: Record<ResizeHandle, string> = { n: 'למעלה', s: 'למטה', e: 'ימינה', w: 'שמאלה', ne: 'פינה ימנית עליונה', nw: 'פינה שמאלית עליונה', se: 'פינה ימנית תחתונה', sw: 'פינה שמאלית תחתונה' };

export function ElementArt({ element: e }: { element: BoardElement }) {
  const maskId=useId().replace(/:/g,'');
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
  if (e.kind === 'frame' && e.image) return <div data-art-frame style={{ width: '100%', height: '100%', boxSizing: 'border-box', border: '2.6cqh solid transparent', borderImage: `url("${e.image}") 20% / 2.6cqh stretch`, background: 'transparent' }} />;
  // A symbol laid over an arch (artSymbols.ts) fades into the drawing at its edges.
  if (e.kind === 'image' && e.image && e.crop) return <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...(e.symbol ? { maskImage: 'radial-gradient(closest-side, #000 72%, transparent 100%)', WebkitMaskImage: 'radial-gradient(closest-side, #000 72%, transparent 100%)' } : {}) }}><img src={e.image} alt={e.name} draggable={false} style={{ position: 'absolute', maxWidth: 'none', width: `${10000 / e.crop.width}%`, height: `${10000 / e.crop.height}%`, left: `${-100 * e.crop.x / e.crop.width}%`, top: `${-100 * e.crop.y / e.crop.height}%` }} /></div>;
  if (e.kind === 'image') return e.image ? <img src={e.image} alt={e.name} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : null;
  if (e.kind === 'text') return <div dir="rtl" style={{ whiteSpace: 'pre-wrap', textAlign: 'center', fontWeight: 700, width: '100%', overflow: 'hidden', fontSize: `${e.fontSize}cqh` }}>{e.alternateTexts ? <TurningText texts={e.alternateTexts} seconds={e.alternateSeconds} /> : e.text}</div>;
  if (e.kind === 'column') return <svg viewBox="0 0 100 600" preserveAspectRatio="none" width="100%" height="100%" aria-hidden>
    <path fill={e.color} d="M0 0H100V18H0ZM6 22H94V38H6ZM12 48H88L79 75H21ZM25 78H75V535H25ZM17 539H83V558H17ZM7 562H93V579H7ZM0 583H100V600H0Z" />
    <path stroke="#fff" opacity=".42" strokeWidth="4" d="M34 84V529M47 84V529M61 84V529" />
    <path fill="none" stroke={e.color} strokeWidth="6" d="M30 48C0 70 0 18 24 31C40 38 24 53 19 40M70 48C100 70 100 18 76 31C60 38 76 53 81 40" />
  </svg>;
  if (e.kind === 'ornament') return <svg viewBox="0 0 300 70" width="100%" height="100%" aria-hidden><g fill="none" stroke={e.color} strokeWidth="3"><path d="M10 40H115Q135 40 150 12Q165 40 185 40H290M25 40C55 0 110 0 105 30S65 35 83 18M275 40C245 0 190 0 195 30S235 35 217 18M115 40Q150 80 185 40"/><path d="M150 12L162 30L150 47L138 30Z"/></g></svg>;
  return <div style={{ width: '100%', height: '100%', border: `${e.kind === 'frame' ? '.6' : '.15'}cqh ${e.kind === 'frame' ? 'double' : 'solid'} ${e.color}`, background: e.fill, borderRadius: '1.5cqh', boxShadow: '0 .3cqh 1cqh #0002', boxSizing: 'border-box' }} />;
}
export function BoardElements({ elements = [], surface = false, data }: { elements?: BoardElement[]; surface?: boolean; data?: ElementData }) {
  const editor = useElementEditing();
  const api = editor?.api.current;
  const enabled = !!editor && !!api && api.elements === elements && (surface || editor.enabled);
  const drag = useRef<{ x: number; y: number; all: BoardElement[]; ids: string[]; width: number; height: number; resize: ResizeHandle | null; last: BoardElement[] | null; pointer: number } | null>(null);
  const setDraft = editor?.setDraft;
  useEffect(() => {
    // A changed scope, history step or editing mode invalidates an in-flight gesture.
    if (drag.current) { drag.current = null; setDraft?.(null); }
  }, [elements, enabled, setDraft]);
  const shown = enabled && editor.draft ? editor.draft : elements;
  const stop = () => { drag.current = null; editor?.setDraft(null); };
  return <ElementDataProvider value={data}><div data-testid="board-elements" data-free-edit={enabled ? 'true' : undefined}
    tabIndex={enabled ? 0 : undefined} aria-label={enabled ? 'עריכת אלמנטים על הלוח' : undefined}
    style={{ position: 'absolute', inset: 0, pointerEvents: surface ? 'auto' : 'none', zIndex: 15, outline: 'none' }}
    onClick={enabled ? e => { if (!e.altKey) e.stopPropagation(); } : undefined}
    onDoubleClick={enabled ? e => e.stopPropagation() : undefined}
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
      const q = (v: number) => editor.snap ? Math.round(v) : v;
      const dx = q((ev.clientX - d.x) / d.width * 100), dy = q((ev.clientY - d.y) / d.height * 100);
      d.last = d.resize ? normalizeElements(resizeElements(d.all, d.ids, d.resize, dx, dy)) : moveElements(d.all, d.ids, dx, dy);
      editor.setDraft(d.last);
    } : undefined}
    onPointerUp={enabled ? ev => { const d = drag.current; if (!d) return; ev.stopPropagation(); if (d.last && d.all === editor.api.current?.elements) api.commit(d.last); stop(); } : undefined}
    onPointerCancel={stop} onLostPointerCapture={stop}
    onPointerDown={enabled ? ev => {
      if (ev.button !== 0 || ev.altKey) return;
      // A handle of the selection: stretch or narrow it, from that side.
      const handle = (ev.target as HTMLElement).dataset.elementHandle as ResizeHandle | undefined;
      if (handle && editor.selected.length) {
        ev.preventDefault(); ev.stopPropagation(); ev.currentTarget.focus({ preventScroll: true });
        if (elements.some(x => editor.selected.includes(x.id) && x.locked)) return;
        const box = ev.currentTarget.getBoundingClientRect();
        ev.currentTarget.setPointerCapture(ev.pointerId);
        drag.current = { x: ev.clientX, y: ev.clientY, all: elements, ids: editor.selected, width: box.width, height: box.height, pointer: ev.pointerId, last: null, resize: handle };
        return;
      }
      const node = (ev.target as Element).closest<HTMLElement>('[data-element-id]');
      if (!node) { editor.select([]); return; }
      const e = elements.find(x => x.id === node.dataset.elementId); if (!e) return;
      ev.preventDefault(); ev.stopPropagation(); ev.currentTarget.focus({ preventScroll: true });
      const family = e.group ? elements.filter(x => x.group === e.group).map(x => x.id) : [e.id];
      const ids = ev.shiftKey ? [...new Set([...editor.selected, ...family])] : editor.selected.includes(e.id) ? editor.selected : family;
      editor.select(ids);
      if (elements.some(x => ids.includes(x.id) && x.locked)) return;
      const box = ev.currentTarget.getBoundingClientRect();
      ev.currentTarget.setPointerCapture(ev.pointerId);
      drag.current = { x: ev.clientX, y: ev.clientY, all: elements, ids, width: box.width, height: box.height, pointer: ev.pointerId, last: null, resize: null };
    } : undefined}>
    {shown.map(e => <div key={e.id} data-element-id={e.id} data-testid={surface ? `element-${e.id}` : undefined}
      style={{ ...elementStyle(e), pointerEvents: enabled ? 'auto' : 'none', touchAction: enabled ? 'none' : undefined, userSelect: enabled ? 'none' : undefined, cursor: enabled ? e.locked ? 'not-allowed' : 'move' : undefined }}>
      <ElementArt element={e} />
      {enabled && editor.selected.includes(e.id) && <span data-edit-ui="true" style={{ position: 'absolute', inset: 0, outline: '2px solid #38bdf8', pointerEvents: 'none' }} />}
    </div>)}
    {enabled && <SelectionHandles elements={shown} ids={editor.selected} />}
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
