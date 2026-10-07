/**
 * A colour, chosen while the board is in sight.
 *
 * The browser's own colour box opened over the page and held it: nothing
 * scrolled while it was open, and the board's preview - far above the control
 * - could not be seen changing, nor picked from with the dropper. So the
 * colours open here in a small panel standing at the foot of the window, over
 * nothing and holding nothing: the page scrolls under it, the board changes
 * as the colour is dragged, and the dropper first brings the board into sight.
 *
 * One panel at a time: opening another closes the one open.
 */
import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, Pipette, X } from 'lucide-react';

const OPEN_EVENT = 'colorpick:open';
const RECENT_KEY = 'tv-editor.recent-colours';
/** Colours of the boards: gold, parchment, navy, and the plain ones. */
const BOARD_COLOURS = ['#ffffff', '#000000', '#f8d991', '#d3ae60', '#c9a45d', '#9a7425', '#f6ecd7', '#fff5de', '#3e2809', '#321b07', '#10233e', '#1b2a4a', '#0d3b2e', '#6e1d2f'];

/* ---------------------------------------------------------- colour maths -- */
type Hsv = { h: number; s: number; v: number };
const clamp = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n));
const isHex = (s: string) => /^#[\da-f]{6}$/i.test(s);
function hexToHsv(hex: string): Hsv {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: ((h * 60) + 360) % 360, s: max ? d / max : 0, v: max };
}
function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return `#${[f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter(isHex).slice(0, 8) : [];
  } catch {
    return [];
  }
}
function keepRecent(hex: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([hex, ...readRecent().filter((c) => c !== hex)].slice(0, 8)));
  } catch {
    /* a private window: no recent colours, nothing else lost */
  }
}

/** The board's preview, brought into sight - for the dropper, and to watch the colour change. */
function showBoard() {
  const frame = [...document.querySelectorAll<HTMLElement>('.tv-frame')].find((f) => f.offsetParent !== null);
  frame?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

/* ------------------------------------------------------------- the box -- */
export function ColorPick({ value, onChange, label, className = '' }: {
  value: string;
  /** Every change while dragging; the editor folds them into one step to undo. */
  onChange: (hex: string) => void;
  label: string;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const hex = isHex(value) ? value.toLowerCase() : '#000000';
  useEffect(() => {
    const other = (e: Event) => { if ((e as CustomEvent<string>).detail !== id) setOpen(false); };
    window.addEventListener(OPEN_EVENT, other);
    return () => window.removeEventListener(OPEN_EVENT, other);
  }, [id]);
  const toggle = () => {
    if (!open) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
    setOpen(!open);
  };
  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        title={`${label}: ${hex}`}
        onClick={toggle}
        data-colorpick={hex}
        className={`h-8 w-11 shrink-0 cursor-pointer rounded border-2 shadow-inner ${open ? 'border-sky-500 ring-2 ring-sky-300' : 'border-border'} ${className}`}
        style={{ background: hex }}
      />
      {open && createPortal(<Panel label={label} value={hex} onChange={onChange} onClose={() => { keepRecent(hex); setOpen(false); }} />, document.body)}
    </>
  );
}

/* ----------------------------------------------------------- the panel -- */
function Panel({ label, value, onChange, onClose }: { label: string; value: string; onChange: (hex: string) => void; onClose: () => void }) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const [typed, setTyped] = useState(value);
  const recent = useRef(readRecent());
  // A colour changed from outside (undo, another control): the panel follows it.
  useEffect(() => {
    if (hsvToHex(hsv) !== value) setHsv(hexToHsv(value));
    setTyped(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const set = (next: Hsv) => {
    setHsv(next);
    const hex = hsvToHex(next);
    setTyped(hex);
    onChange(hex);
  };
  const pick = (hex: string) => {
    setHsv(hexToHsv(hex));
    setTyped(hex);
    onChange(hex);
  };

  const drag = (el: HTMLElement, ev: ReactPointerEvent, move: (x: number, y: number) => void) => {
    ev.preventDefault();
    el.setPointerCapture(ev.pointerId);
    const at = (e: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      move(clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height));
    };
    at(ev);
    const onMove = (e: PointerEvent) => at(e);
    const onUp = () => { el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerup', onUp); el.removeEventListener('pointercancel', onUp); };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  };

  const dropper = 'EyeDropper' in window;
  const takeFromScreen = async () => {
    showBoard();
    // The board scrolls into sight first; then the dropper, over it.
    await new Promise((r) => setTimeout(r, 450));
    try {
      const Dropper = (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
      const { sRGBHex } = await new Dropper().open();
      if (isHex(sRGBHex)) pick(sRGBHex.toLowerCase());
    } catch {
      /* the dropper was left with Esc */
    }
  };

  const hueColour = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={`בחירת ${label}`}
      data-testid="color-panel"
      dir="rtl"
      className="fixed bottom-3 right-3 z-[100] w-[min(19rem,calc(100vw-1.5rem))] space-y-2 rounded-xl border bg-card p-3 text-card-foreground shadow-2xl"
    >
      <div className="flex items-center gap-2">
        <span className="size-6 shrink-0 rounded border" style={{ background: value }} aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{label}</span>
        <button type="button" onClick={onClose} aria-label="סגירת בחירת הצבע" className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="size-4" aria-hidden /></button>
      </div>
      {/* Saturation and brightness: the colour itself, dragged in. */}
      <div
        role="slider"
        aria-label="רוויה ובהירות"
        aria-valuetext={value}
        tabIndex={0}
        className="relative h-32 w-full cursor-crosshair touch-none rounded-md"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColour})` }}
        onPointerDown={(e) => drag(e.currentTarget, e, (x, y) => set({ ...hsv, s: x, v: 1 - y }))}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.1 : 0.02;
          const by: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
          if (by[e.key]) { e.preventDefault(); set({ ...hsv, s: clamp(hsv.s + by[e.key][0]), v: clamp(hsv.v + by[e.key][1]) }); }
        }}
      >
        <span className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
      </div>
      {/* The hue. */}
      <div
        role="slider"
        aria-label="גוון"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        tabIndex={0}
        className="relative h-4 w-full cursor-pointer touch-none rounded-full"
        style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
        onPointerDown={(e) => drag(e.currentTarget, e, (x) => set({ ...hsv, h: x * 359.9 }))}
        onKeyDown={(e) => {
          const by = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
          if (by) { e.preventDefault(); set({ ...hsv, h: (hsv.h + by * (e.shiftKey ? 15 : 3) + 360) % 360 }); }
        }}
      >
        <span className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${(hsv.h / 360) * 100}%`, background: hueColour }} />
      </div>
      <div className="flex items-center gap-2">
        <input
          dir="ltr"
          aria-label="קוד הצבע"
          value={typed}
          maxLength={7}
          onChange={(e) => {
            const v = e.target.value.trim();
            setTyped(v);
            const full = v.startsWith('#') ? v : `#${v}`;
            if (isHex(full)) pick(full.toLowerCase());
          }}
          className="h-8 w-24 rounded border bg-background px-2 font-mono text-sm"
        />
        {dropper && (
          <button type="button" onClick={() => void takeFromScreen()} title="לוקחים צבע מכל מקום במסך - קודם הלוח עולה למעלה" className="flex h-8 items-center gap-1 rounded border px-2 text-xs hover:border-primary">
            <Pipette className="size-4" aria-hidden /> צבע מהלוח
          </button>
        )}
        <button type="button" onClick={showBoard} className="h-8 rounded border px-2 text-xs hover:border-primary" title="גולל את העמוד אל הלוח, והחלון הזה נשאר פתוח">
          לראות את הלוח
        </button>
      </div>
      {[['אחרונים', recent.current], ['צבעי לוחות', BOARD_COLOURS]].map(([title, list]) =>
        (list as string[]).length ? (
          <div key={title as string} className="space-y-1">
            <p className="text-[11px] text-muted-foreground">{title as string}</p>
            <div className="flex flex-wrap gap-1">
              {(list as string[]).map((c) => (
                <button key={c} type="button" aria-label={`צבע ${c}`} title={c} onClick={() => pick(c)}
                  className={`size-6 rounded border ${c === value ? 'ring-2 ring-sky-500 ring-offset-1' : ''}`} style={{ background: c }} />
              ))}
            </div>
          </div>
        ) : null,
      )}
      <div className="flex items-center justify-between gap-2 pt-1">
        <p className="text-[11px] text-muted-foreground">אפשר לגלול את העמוד - החלון נשאר פתוח, והלוח משתנה בזמן הבחירה.</p>
        <button type="button" onClick={onClose} className="flex h-8 shrink-0 items-center gap-1 rounded bg-primary px-3 text-xs text-primary-foreground"><Check className="size-4" aria-hidden /> סיום</button>
      </div>
    </div>
  );
}
