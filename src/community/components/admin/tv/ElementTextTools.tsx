/**
 * The letters of the chosen parts: size, font, bold, slant, alignment,
 * shadow, colour, and whether long text breaks into lines or is made
 * smaller - for one part or several at once; on a list with times, how its
 * "הבא בתור" is marked.
 *
 * One bar, in both places a part is worked on: under the board's preview,
 * for the part clicked on the board itself, and in the list of parts. It is
 * the same component in both, so the two never offer different things.
 */
import { useEffect, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, WrapText } from 'lucide-react';

import { ELEMENT_FONTS, wraps, type BoardElement, type ElementFont } from '@/tv/elements';
import { ColourRow, SELECT_CLASS, Stepper } from './editorParts';
import { NextMarkTools } from './NextMarkTools';
import { Notice } from './Notice';

const BTN = 'grid size-8 place-items-center rounded border text-muted-foreground hover:border-primary hover:text-foreground disabled:opacity-40';
const ON = 'border-primary bg-primary/10 text-primary';
const WIDE = 'flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded border px-2 text-xs text-muted-foreground hover:border-primary hover:text-foreground';

export function ElementTextTools({ elements, ids, onPatch, withColor = true }: {
  elements: BoardElement[];
  ids: string[];
  /** The change, for the parts given (the locked among them are left alone). */
  onPatch: (ids: string[], patch: Partial<BoardElement>, what: string) => void;
  withColor?: boolean;
}) {
  const texts = elements.filter(e => ids.includes(e.id) && e.kind === 'text' && !e.locked);
  const cut = useCutText(texts.map(e => e.id).join(','));
  if (!texts.length) return null;
  const first = texts[0];
  const targets = texts.map(e => e.id);
  const set = (patch: Partial<BoardElement>, what: string) => onPatch(targets, patch, what);
  const all = <K extends keyof BoardElement>(k: K, v: BoardElement[K]) => texts.every(e => e[k] === v);
  const bold = texts.every(e => e.weight !== 'normal');
  const wrapping = texts.every(wraps);
  const plain = texts.length === 1 && !first.binding && !first.alternateTexts;
  const label = texts.length > 1 ? `${texts.length} טקסטים` : first.name;

  return (
    <div className="space-y-2 rounded-lg border p-2" role="group" aria-label={`עיצוב הטקסט - ${label}`} data-testid="element-text-tools">
      <p className="text-xs font-semibold">הטקסט של: {label}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Size: the letters themselves, as a share of the board's height - a % as every size in the editor. */}
        <Stepper label="גודל הטקסט" value={first.fontSize} min={0.5} max={20} step={0.25}
          format={(v) => `${Number(v.toFixed(2))}%`}
          onChange={(v) => set({ fontSize: Math.round(v * 100) / 100 }, 'fontSize')} />
        <select aria-label="גופן" value={texts.every(e => e.font === first.font) ? first.font ?? '' : ''}
          onChange={ev => set({ font: (ev.target.value || undefined) as ElementFont | undefined }, 'font')}
          className={SELECT_CLASS}>
          <option value="">גופן: כמו בלוח</option>
          {(Object.keys(ELEMENT_FONTS) as ElementFont[]).map(f => (
            <option key={f} value={f} style={{ fontFamily: ELEMENT_FONTS[f].family }}>{ELEMENT_FONTS[f].name}</option>
          ))}
        </select>
        <button type="button" className={`${BTN} ${bold ? ON : ''}`} aria-label="מודגש" aria-pressed={bold} title="מודגש"
          onClick={() => set({ weight: bold ? 'normal' : undefined }, 'weight')}><Bold className="size-4" aria-hidden /></button>
        <button type="button" className={`${BTN} ${all('italic', true) ? ON : ''}`} aria-label="נטוי" aria-pressed={all('italic', true)} title="נטוי"
          onClick={() => set({ italic: all('italic', true) ? undefined : true }, 'italic')}><Italic className="size-4" aria-hidden /></button>
        <div className="flex items-center gap-0.5" role="group" aria-label="יישור">
          {([['right', 'ימין', AlignRight], ['center', 'מרכז', AlignCenter], ['left', 'שמאל', AlignLeft]] as const).map(([a, name, Icon]) => {
            const on = texts.every(e => (e.align ?? 'center') === a);
            return <button key={a} type="button" className={`${BTN} ${on ? ON : ''}`} aria-label={`יישור ל${name}`} aria-pressed={on} title={`יישור ל${name}`}
              onClick={() => set({ align: a === 'center' ? undefined : a }, 'align')}><Icon className="size-4" aria-hidden /></button>;
          })}
        </div>
        {/* Wrapping: break into lines at its own size, or one line made smaller - never smaller unasked. */}
        <button type="button" className={`${WIDE} ${wrapping ? ON : ''}`} aria-label="גלישת שורות" aria-pressed={wrapping}
          title={wrapping ? 'גלישת שורות דולקת: טקסט ארוך נשבר לשורות ושומר על הגודל שלו' : 'גלישת שורות כבויה: טקסט ארוך נשאר בשורה אחת ומוקטן כדי שייכנס'}
          onClick={() => set({ wrap: !wrapping }, 'wrap')}>
          <WrapText className="size-4" aria-hidden /><span>גלישת שורות</span>
        </button>
        <button type="button" className={`${WIDE} ${all('shadow', true) ? ON : ''}`} aria-label="צל לטקסט" aria-pressed={all('shadow', true)}
          title="צל רך מתחת לאותיות - לטקסט על רקע עמוס" onClick={() => set({ shadow: all('shadow', true) ? undefined : true }, 'shadow')}>צל</button>
        {withColor && (
          <div className="min-w-32">
            <ColourRow label="צבע הטקסט" value={first.color} onChange={v => set({ color: v }, 'color')} />
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {wrapping ? 'טקסט ארוך נשבר לשורות ושומר על הגודל שלו.' : 'טקסט ארוך נשאר בשורה אחת ומוקטן כדי שייכנס.'}
      </p>
      {texts.some(e => cut[e.id]) && (
        <Notice variant="warning" className="p-2 text-xs" role="status" data-testid="text-cut"
          actions={
            <button type="button" className="rounded border border-amber-500 bg-background px-2 py-1 font-medium hover:bg-amber-100 dark:hover:bg-amber-900"
              onClick={() => texts.forEach(e => cut[e.id] && onPatch([e.id], { height: Math.min(100 - e.y, Math.round((e.height * cut[e.id] + 0.5) * 10) / 10) }, 'grow'))}>
              להגדיל את התיבה כדי שהכול ייכנס
            </button>
          }>
          חלק מהטקסט לא נכנס בתיבה ונחתך בתחתית שלה.
        </Notice>
      )}
      <NextMarkTools elements={elements} texts={texts} onPatch={onPatch} />
      {plain && (
        <label className="block text-xs">
          מה כתוב
          <textarea aria-label="מה כתוב בטקסט" value={first.text} rows={2} maxLength={2000}
            onChange={ev => set({ text: ev.target.value }, 'text')}
            className="mt-1 block w-full rounded border bg-background p-2 text-sm" />
        </label>
      )}
    </div>
  );
}

/**
 * Which of these texts are cut at the bottom of their box just now, and by how
 * much: read off the board (useOverflowMark in elementData.tsx marks them), a
 * little after every change - the board draws the change first.
 */
function useCutText(key: string): Record<string, number> {
  const [cut, setCut] = useState<Record<string, number>>({});
  useEffect(() => {
    const ids = key ? key.split(',') : [];
    const read = () => {
      const next: Record<string, number> = {};
      for (const id of ids) {
        const marks = [...document.querySelectorAll<HTMLElement>(`[data-element-id="${id}"] [data-overflow]`)];
        const most = Math.max(0, ...marks.map(m => Number(m.dataset.overflow) || 0));
        if (most > 1) next[id] = most;
      }
      setCut(c => (JSON.stringify(c) === JSON.stringify(next) ? c : next));
    };
    read();
    const timer = window.setInterval(read, 700);
    return () => window.clearInterval(timer);
  }, [key]);
  return cut;
}

