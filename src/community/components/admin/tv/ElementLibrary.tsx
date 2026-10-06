import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { BoardElements } from '@/tv/BoardElements';
import type { TvConfig } from '@/tv/config';
import { elementId, exportElementSet, importElementSet, MAX_ELEMENTS, MAX_ELEMENT_SETS } from '@/tv/elements';

export function ElementLibrary({ config, selected, onEdit, onSelect }: {
  config: TvConfig; selected: string[]; onSelect: (ids: string[]) => void;
  onEdit: (key: string, update: (c: TvConfig) => TvConfig) => void;
}) {
  const [name, setName] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const chosen = config.elements.filter(e => selected.includes(e.id));
  return <section data-testid="element-library" className="space-y-3 rounded-lg border bg-muted/20 p-3">
    <h3 className="font-semibold">האלמנטים שלי</h3>
    <p className="text-xs text-muted-foreground">שומרים בחירה פעם אחת ומוסיפים עותקים לכל לוח. הספרייה נכללת בשמירה המקומית ובחבילת ה־ZIP.</p>
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
            <Button size="sm" variant="outline" aria-label={`הוספת ${item.name} מהספרייה`} disabled={config.elements.length + item.elements.length > MAX_ELEMENTS} onClick={() => {
              const added = importElementSet(exportElementSet(item.elements)).map(e => ({ ...e, locked: false, hidden: false }));
              onEdit(`element-library:insert:${elementId()}`, c => ({ ...c, elements: [...c.elements, ...added].slice(0, MAX_ELEMENTS) }));
              onSelect(added.map(e => e.id));
            }}>הוספת עותק</Button>
            <button type="button" className="text-xs underline" aria-label={`הסרת ${item.name} מהספרייה`} onClick={() => setRemoving(item.id)}>הסרה</button>
          </div>
          {removing === item.id && <div className="text-xs" role="alert">להסיר את הפריט מהספרייה? עותקים שעל הלוח יישארו.<div className="flex gap-3">
            <button type="button" onClick={() => { onEdit(`element-library:remove:${item.id}`, c => ({ ...c, elementLibrary: c.elementLibrary.filter(x => x.id !== item.id) })); setRemoving(null); }}>אישור הסרה</button>
            <button type="button" onClick={() => setRemoving(null)}>ביטול</button>
          </div></div>}
        </div>
      </article>)}
    </div>
    {!config.elementLibrary.length && <p className="text-xs text-muted-foreground">בחרו אלמנט או קבוצה כדי לשמור את הפריט הראשון.</p>}
  </section>;
}
