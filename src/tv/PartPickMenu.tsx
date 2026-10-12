import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

/**
 * The parts at one place on the board, to choose one: a right click on the
 * board opens it where the pointer stands. A part covered by another - a box
 * under its picture, a frame under its box - is chosen here alone.
 *
 * In the page itself, not in the board: the board's frame clips what stands
 * outside it, and a board shown smaller is scaled.
 */
export function PartPickMenu({ x, y, parts, current, onPick, onClose }: {
  /** Where the pointer stood, on the screen. */
  x: number; y: number;
  /** The parts there, the topmost first. */
  parts: { id: string; name: string }[];
  /** The part chosen now, marked in the list. */
  current?: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [at, setAt] = useState({ left: x, top: y });
  // Inside the window: near its edge the menu opens to the other side.
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    setAt({ left: Math.max(4, Math.min(x, window.innerWidth - r.width - 4)), top: Math.max(4, Math.min(y, window.innerHeight - r.height - 4)) });
  }, [x, y, parts.length]);
  useEffect(() => { ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true }); }, []);
  // A press anywhere else, the window losing focus or changing size: closed.
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const outside = (ev: Event) => { if (!ref.current?.contains(ev.target as Node)) close.current(); };
    const away = () => close.current();
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('blur', away);
    window.addEventListener('resize', away);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('blur', away);
      window.removeEventListener('resize', away);
    };
  }, []);
  const move = (ev: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const now = items.indexOf(document.activeElement as HTMLElement);
    const to = ev.key === 'ArrowDown' ? (now + 1) % items.length : ev.key === 'ArrowUp' ? (now - 1 + items.length) % items.length
      : ev.key === 'Home' ? 0 : ev.key === 'End' ? items.length - 1 : -1;
    if (to >= 0) { ev.preventDefault(); items[to]?.focus({ preventScroll: true }); return; }
    if (ev.key === 'Escape' || ev.key === 'Tab') { ev.preventDefault(); onClose(); }
  };
  return createPortal(<div ref={ref} role="menu" aria-labelledby={titleId} dir="rtl" data-testid="part-pick-menu"
    className="fixed z-[200] min-w-48 max-w-72 rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-lg"
    style={{ left: at.left, top: at.top }}
    // In the page, but still within the board as React sees it: its presses are the menu's alone.
    onPointerDown={ev => ev.stopPropagation()} onClick={ev => ev.stopPropagation()} onDoubleClick={ev => ev.stopPropagation()}
    onKeyDown={ev => { ev.stopPropagation(); move(ev); }}
    onContextMenu={ev => { ev.preventDefault(); ev.stopPropagation(); }}>
    <p id={titleId} className="px-2 py-1 text-xs font-medium text-muted-foreground">בחירת חלק</p>
    {parts.map(p => <button key={p.id} type="button" role="menuitem" tabIndex={-1}
      className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-right outline-none hover:bg-accent focus:bg-accent ${p.id === current ? 'font-semibold' : ''}`}
      onClick={() => onPick(p.id)}>
      <span className="truncate">{p.name}</span>
      {p.id === current && <span aria-hidden className="text-xs text-muted-foreground">נבחר</span>}
    </button>)}
  </div>, document.body);
}
