import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { BoardElements } from '@/tv/BoardElements';
import type { TvConfig } from '@/tv/config';
import { elementId, exportElementSet, importElementSet, MAX_ELEMENTS, MAX_ELEMENT_SETS } from '@/tv/elements';
import { READY_PARTS } from '@/tv/readyParts';

export function ElementLibrary({ config, selected, onEdit, onSelect }: {
  config: TvConfig; selected: string[]; onSelect: (ids: string[]) => void;
  onEdit: (key: string, update: (c: TvConfig) => TvConfig) => void;
}) {
  const [name, setName] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const chosen = config.elements.filter(e => selected.includes(e.id));
  const insert = (key: string, elements: TvConfig['elements']) => {
    const added = importElementSet(exportElementSet(elements)).map(e => ({ ...e, locked: false, hidden: false }));
    onEdit(`${key}:${elementId()}`, c => ({ ...c, elements: [...c.elements, ...added].slice(0, MAX_ELEMENTS) }));
    onSelect(added.map(e => e.id));
  };
  return <div className="space-y-3">
  <section data-testid="ready-parts" className="space-y-3 rounded-lg border bg-muted/20 p-3">
    <h3 className="font-semibold">חלקים מוכנים מהערכות</h3>
    <p className="text-xs text-muted-foreground">עמודים, קשתות, מסגרות שעון ופמוטים מתוך הערכות - כל אחד לבד, בלי הקיר שמסביבו. מוסיפים לכל לוח, גם לוח רגיל, ומזיזים ומגדילים כרצונכם.</p>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {READY_PARTS.map(item => <article key={item.id} className="overflow-hidden rounded border bg-background">
        <div className="relative aspect-video bg-slate-900" style={{ containerType: 'size' }}><BoardElements elements={item.elements} /></div>
        <div className="flex items-center justify-between gap-2 p-2">
          <p className="min-w-0 truncate text-xs font-medium" title={item.name}>{item.name}</p>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" aria-label={`הוספת ${item.name}`} disabled={config.elements.length + item.elements.length > MAX_ELEMENTS} onClick={() => insert('ready-part:insert', item.elements)}>הוספה</Button>
        </div>
      </article>)}
    </div>
  </section>
  <section data-testid="element-library" className="space-y-3 rounded-lg border bg-muted/20 p-3">
    <h3 className="font-semibold">החלקים שלי</h3>
    <p className="text-xs text-muted-foreground">שומרים בחירה פעם אחת ומוסיפים עותקים לכל לוח. הספרייה נשמרת עם הלוח ונכללת בקובץ הלוח.</p>
    <div className="flex flex-wrap gap-2">
      <input aria-label="שם פריט בספרייה" maxLength={80} placeholder="למשל: זוג עמודים מוזהבים" className="min-w-0 flex-1 rounded border bg-background px-2 py-1 text-sm" value={name} onChange={e => setName(e.target.value)} />
      <Button size="sm" disabled={!chosen.length || !name.trim() || config.elementLibrary.length >= MAX_ELEMENT_SETS} onClick={() => {
        const entry = { id: elementId(), name: name.trim(), elements: structuredClone(chosen) };
        onEdit(`element-library:add:${entry.id}`, c => ({ ...c, elementLibrary: [...c.elementLibrary, entry].slice(0, MAX_ELEMENT_SETS) }));
        setName(''); toast.success('הפריט נוסף לטיוטת הספרייה. שמרו את הלוח כדי לשמור גם אותו.');
      }}>שמירת הבחירה בספרייה</Button>
    </div>
    <div className="grid grid-cols-2 gap-2">
      {config.elementLibrary.map(item => <article key={item.id} className="overflow-hidden rounded border bg-background">
        <div className="relative aspect-video bg-slate-900" style={{ containerType: 'size' }}><BoardElements elements={item.elements} /></div>
        <div className="space-y-2 p-2">
          <p className="truncate text-sm font-medium">{item.name}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" aria-label={`הוספת ${item.name} מהספרייה`} disabled={config.elements.length + item.elements.length > MAX_ELEMENTS} onClick={() => insert('element-library:insert', item.elements)}>הוספת עותק</Button>
            <button type="button" className="text-xs underline" aria-label={`הסרת ${item.name} מהספרייה`} onClick={() => setRemoving(item.id)}>הסרה</button>
          </div>
          {removing === item.id && <div className="text-xs" role="alert">להסיר את הפריט מהספרייה? עותקים שעל הלוח יישארו.<div className="flex gap-3">
            <button type="button" onClick={() => { onEdit(`element-library:remove:${item.id}`, c => ({ ...c, elementLibrary: c.elementLibrary.filter(x => x.id !== item.id) })); setRemoving(null); }}>אישור הסרה</button>
            <button type="button" onClick={() => setRemoving(null)}>ביטול</button>
          </div></div>}
        </div>
      </article>)}
    </div>
    {!config.elementLibrary.length && <p className="text-xs text-muted-foreground">בחרו חלק או קבוצה כדי לשמור את הפריט הראשון.</p>}
  </section>
  </div>;
}
