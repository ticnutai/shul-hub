/**
 * The pages of a board of parts, above the editor's tabs: which page is being
 * worked on, and the pages themselves - a new one, its name, its seconds, its
 * place in the turns, taking one off.
 *
 * Every tab edits the page chosen here: its kit (ערכות), its frames and what
 * they show (פריסה), its look. A page is a board of its own; changing one
 * changes no other. The board's ordinary screens are not offered on a board
 * of parts at all, so there is one list of what takes turns, not two.
 */
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Copy, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { TvConfig } from '@/tv/config';
import { MAX_PAGES, addPage, movePage, readPages, removePage, setPage } from '@/tv/partPages';

export function PartPagesBar({ config, current, onSelect, onEdit }: {
  config: TvConfig;
  current: number;
  onSelect: (index: number) => void;
  /** An edit of the whole board (not of one page): the pages themselves. */
  onEdit: (key: string, update: (c: TvConfig) => TvConfig) => void;
}) {
  const pages = readPages(config);
  const page = pages[current] ?? pages[0];
  const total = pages.reduce((s, p) => s + p.seconds, 0);

  const add = () => {
    if (pages.length >= MAX_PAGES) return toast.error(`עד ${MAX_PAGES} עמודים בלוח`);
    const index = pages.length;
    onEdit('add', c => addPage(c, current).config);
    onSelect(index);
    toast.success(`נוסף עמוד ${index + 1} - העתק של "${page.name}". עכשיו עורכים אותו: בחרו לו ערכה בלשונית "עיצוב", ומה יופיע בו בלשונית "פריסה".`);
  };
  const remove = () => {
    if (!window.confirm(`למחוק את "${page.name}"? המסגרות והתוכן שלו יימחקו. אפשר לבטל עם Ctrl+Z.`)) return;
    onEdit(`remove:${page.id}`, c => removePage(c, current));
    onSelect(Math.max(0, current - 1));
  };
  const move = (by: -1 | 1) => {
    onEdit(`move:${page.id}`, c => movePage(c, current, by));
    onSelect(current + by);
  };

  return (
    <div className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-3" data-testid="part-pages">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">עמודי הלוח</span>
        <span className="text-xs text-muted-foreground">
          {pages.length > 1
            ? `${pages.length} עמודים - הלוח מתחלף ביניהם, סיבוב שלם כל ${total} שניות. כל המסכים מראים את אותו עמוד באותו רגע.`
            : 'עמוד אחד - הלוח עומד. אפשר להוסיף עמודים שמתחלפים, כל אחד עם ערכה ותוכן משלו.'}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="עמודי הלוח">
        {pages.map((p, i) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={i === current}
            onClick={() => onSelect(i)}
            className={`flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm transition ${i === current ? 'border-primary ring-2 ring-primary ring-offset-1' : 'hover:border-primary/50'}`}
          >
            <span className="tabular-nums text-xs text-muted-foreground">{i + 1}</span>
            <span>{p.name}</span>
            {pages.length > 1 && <span className="rounded bg-muted px-1 text-[10px] tabular-nums">{p.seconds} שנ׳</span>}
          </button>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={add} disabled={pages.length >= MAX_PAGES} title="עמוד חדש - העתק של העמוד שנבחר, לשנות ממנו">
          <Copy className="size-4" aria-hidden /> עמוד חדש
        </Button>
      </div>
      {pages.length > 1 && (
        <div className="flex flex-wrap items-end gap-3 border-t border-primary/20 pt-2" data-testid="part-page-settings">
          <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
            שם העמוד
            <input
              value={page.name}
              maxLength={40}
              aria-label="שם העמוד"
              onChange={e => onEdit(`name:${page.id}`, c => setPage(c, current, { name: e.target.value }))}
              className="h-8 rounded border bg-background px-2 text-sm text-foreground"
            />
          </label>
          <label className="flex w-28 flex-col gap-1 text-xs text-muted-foreground">
            כמה שניות על המסך
            <input
              type="number"
              min={5}
              max={3600}
              value={page.seconds}
              aria-label="כמה שניות על המסך"
              onChange={e => e.target.value && onEdit(`seconds:${page.id}`, c => setPage(c, current, { seconds: Number(e.target.value) }))}
              className="h-8 rounded border bg-background px-2 text-sm text-foreground"
            />
          </label>
          <div className="flex items-center gap-1">
            <Button type="button" size="sm" variant="outline" className="h-8" disabled={current === 0} onClick={() => move(-1)} aria-label="להקדים את העמוד" title="להקדים - יופיע לפני העמוד שלפניו">
              <ChevronRight className="size-4" aria-hidden /> להקדים
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-8" disabled={current === pages.length - 1} onClick={() => move(1)} aria-label="לאחר את העמוד" title="לאחר - יופיע אחרי העמוד שאחריו">
              לאחר <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-8 text-destructive" onClick={remove} aria-label="מחיקת העמוד">
              <Trash2 className="size-4" aria-hidden /> מחיקה
            </Button>
          </div>
        </div>
      )}
      {current > 0 && (
        <p className="text-xs" role="status" data-testid="part-page-editing">
          ✏️ עורכים עכשיו את <b>{page.name}</b> - הערכה, המסגרות והתוכן שלו בלבד. העמודים האחרים לא משתנים.
        </p>
      )}
    </div>
  );
}
