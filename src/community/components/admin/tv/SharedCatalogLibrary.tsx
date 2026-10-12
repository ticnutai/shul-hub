import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { TvConfig } from '@/tv/config';
import { importElementSet, exportElementSet, MAX_ELEMENTS } from '@/tv/elements';
import { loadSharedCatalog, type SharedCatalog } from '@/tv/sharedCatalog';
import { CATALOG_CATEGORIES, catalogCategory, type CatalogCategory } from '@/tv/catalogCategories';
import { SELECT_CLASS } from './editorParts';
import { PartGrid, PartTile } from './GalleryTile';

const PAGE = 12;

/**
 * The parts of the shared catalogue - every kit's parts, and parts that stand
 * alone - offered to any board. Read-only: opening it never saves or changes
 * a board; adding a part changes the draft only. (The kits of the catalogue
 * are offered in the design tab's library of kits, DesignLibrary.)
 */
export function SharedCatalogLibrary({ config, onEdit, onSelect, includeStandalone = true }: {
  config: TvConfig;
  includeStandalone?: boolean;
  onEdit: (key: string, update: (c: TvConfig) => TvConfig) => void;
  onSelect?: (ids: string[]) => void;
}) {
  const [catalog, setCatalog] = useState<SharedCatalog>();
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('standalone');
  const [limit, setLimit] = useState(PAGE);
  const [attempt, setAttempt] = useState(0);
  const [category, setCategory] = useState<CatalogCategory>('הכול');

  useEffect(() => {
    let active = true;
    setError(false);
    loadSharedCatalog(attempt > 0)
      .then((c) => {
        if (!active) return;
        setCatalog(c);
        if (!includeStandalone) setSource(c.designs.find((d) => c.parts.some((p) => p.designId === d.id))?.id ?? '');
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [attempt, includeStandalone]);

  const categoryDesigns = catalog?.designs.filter((d) => category === 'הכול' || catalogCategory(d) === category) ?? [];
  const parts = catalog?.parts.filter((p) => p.designId === source && p.name.includes(search.trim())) ?? [];
  const total = parts.length;

  const pickCategory = (next: CatalogCategory) => {
    if (!catalog) return;
    setCategory(next);
    setSearch('');
    setLimit(PAGE);
    setSource(
      next === 'הכול' && includeStandalone
        ? 'standalone'
        : catalog.designs.find((d) => (next === 'הכול' || catalogCategory(d) === next) && catalog.parts.some((p) => p.designId === d.id))?.id ?? '',
    );
  };

  const add = (p: SharedCatalog['parts'][number]) => {
    const added = importElementSet(exportElementSet(p.elements)).map((e) => ({ ...e, hidden: false, locked: false }));
    onEdit(`shared-part:${p.id}`, (c) => (c.elements.length + added.length > MAX_ELEMENTS ? c : { ...c, elements: [...c.elements, ...added] }));
    onSelect?.(added.map((e) => e.id));
  };

  return (
    <div className="space-y-3" dir="rtl">
      <p className="text-[11px] text-muted-foreground">הנושאים מסננים את האוסף בלבד; כל חלק אפשר להוסיף בכל יום.</p>
      {!catalog && !error && <p role="status" className="text-sm text-muted-foreground">טוען את האוסף המשותף…</p>}
      {error && (
        <p role="alert" className="text-sm">
          לא ניתן לטעון את האוסף המשותף. הלוח לא השתנה.{' '}
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setAttempt((a) => a + 1)}>
            ניסיון נוסף
          </Button>
        </p>
      )}
      {catalog && (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              <span className="font-medium">נושא החלקים:</span>
              <select aria-label="נושא החלקים" className={SELECT_CLASS} value={category} onChange={(e) => pickCategory(e.target.value as CatalogCategory)}>
                {CATALOG_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="font-medium">מאיזו ערכה:</span>
              <select
                aria-label="חלקים מאיזו ערכה"
                className={`${SELECT_CLASS} max-w-[14rem]`}
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  setSearch('');
                  setLimit(PAGE);
                }}
              >
                {includeStandalone && (category === 'הכול' || source === 'standalone') && <option value="standalone">חלקים עצמאיים מהאוסף</option>}
                {categoryDesigns
                  .filter((d) => catalog.parts.some((p) => p.designId === d.id))
                  .map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
              </select>
            </label>
            <input
              type="search"
              aria-label="חיפוש בקטלוג המשותף"
              placeholder="חיפוש לפי שם"
              className={`${SELECT_CLASS} min-w-0 flex-1 basis-40`}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLimit(PAGE);
              }}
            />
          </div>
          <p data-testid="shared-count" className="text-[11px] text-muted-foreground">{total} חלקים זמינים</p>
          {total > 0 ? (
            <PartGrid>
              {parts.slice(0, limit).map((p) => (
                <PartTile
                  key={p.id}
                  name={p.name}
                  note={p.note}
                  elements={p.elements}
                  addLabel={`הוספת חלק משותף ${p.name}`}
                  disabled={config.elements.length + p.elements.length > MAX_ELEMENTS}
                  onAdd={() => add(p)}
                />
              ))}
            </PartGrid>
          ) : (
            <p className="text-sm text-muted-foreground">לא נמצאו חלקים.</p>
          )}
          {limit < total && (
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setLimit((n) => n + PAGE)}>
              הצגת עוד
            </Button>
          )}
        </>
      )}
    </div>
  );
}
