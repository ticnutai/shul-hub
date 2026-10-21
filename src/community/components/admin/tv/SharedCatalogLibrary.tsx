import { Hint } from "@/components/InfoTip";
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { putInFolder, toggleFavorite } from '@/tv/library';
import { useLibraryEdit, useLibraryOf } from './libraryEdit';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { TvConfig } from '@/tv/config';
import { importElementSet, exportElementSet, MAX_ELEMENTS } from '@/tv/elements';
import { useSharedCatalog, type SharedCatalog } from '@/tv/sharedCatalog';
import { CATALOG_CATEGORIES, catalogCategory, type CatalogCategory } from '@/tv/catalogCategories';
import { SELECT_CLASS } from './editorParts';
import { PartGrid, PartTile } from './GalleryTile';
import { Notice } from './Notice';

const PAGE = 12;

/** The shared catalogue did not load: one note, the same in the library of kits and of parts, with a retry. */
export function CatalogNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <Notice
      variant="error"
      role="alert"
      actions={
        <Button type="button" variant="outline" size="sm" className="h-7 px-2" onClick={onRetry}>
          ניסיון נוסף
        </Button>
      }
    >
      לא ניתן לטעון את האוסף המשותף. הלוח והערכות שלכם לא השתנו.
    </Notice>
  );
}

/**
 * The parts of the shared catalogue - every kit's parts, and parts that stand
 * alone - offered to any board. Read-only: opening it never saves or changes
 * a board; adding a part changes the draft only. (The kits of the catalogue
 * are offered in the design tab's library of kits, DesignLibrary; both read
 * the catalogue through useSharedCatalog.)
 */
export function SharedCatalogLibrary({ config, onEdit, onSelect }: {
  config: TvConfig;
  onEdit: (key: string, update: (c: TvConfig) => TvConfig) => void;
  onSelect?: (ids: string[]) => void;
}) {
  const { catalog, error, retry } = useSharedCatalog();
  const library = useLibraryOf(config);
  const changeLibrary = useLibraryEdit(onEdit);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('standalone');
  const [limit, setLimit] = useState(PAGE);
  const [category, setCategory] = useState<CatalogCategory>('הכול');

  const categoryDesigns = catalog?.designs.filter((d) => category === 'הכול' || catalogCategory(d) === category) ?? [];
  const parts = catalog?.parts.filter((p) => p.designId === source && p.name.includes(search.trim())) ?? [];
  const total = parts.length;

  const pickCategory = (next: CatalogCategory) => {
    if (!catalog) return;
    setCategory(next);
    setSearch('');
    setLimit(PAGE);
    setSource(
      next === 'הכול'
        ? 'standalone'
        : catalog.designs.find((d) => catalogCategory(d) === next && catalog.parts.some((p) => p.designId === d.id))?.id ?? '',
    );
  };

  const add = (p: SharedCatalog['parts'][number]) => {
    const added = importElementSet(exportElementSet(p.elements)).map((e) => ({ ...e, hidden: false, locked: false }));
    onEdit(`shared-part:${p.id}`, (c) => (c.elements.length + added.length > MAX_ELEMENTS ? c : { ...c, elements: [...c.elements, ...added] }));
    onSelect?.(added.map((e) => e.id));
  };

  return (
    <div className="space-y-3" dir="rtl">
      <Hint>הנושאים מסננים את האוסף בלבד; כל חלק אפשר להוסיף בכל יום.</Hint>
      {!catalog && !error && <p role="status" className="text-sm text-muted-foreground">טוען את האוסף המשותף…</p>}
      {error && <CatalogNotice onRetry={retry} />}
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
                {(category === 'הכול' || source === 'standalone') && <option value="standalone">חלקים עצמאיים מהאוסף</option>}
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
              {parts.slice(0, limit).map((p) => {
                const id = `catalog:${p.id}`, star = library.favorites.includes(id);
                return (
                  <div key={p.id}>
                    <PartTile
                      name={p.name}
                      note={p.note}
                      elements={p.elements}
                      addLabel={`הוספת חלק משותף ${p.name}`}
                      disabled={config.elements.length + p.elements.length > MAX_ELEMENTS}
                      onAdd={() => add(p)}
                    />
                    {/* Into the gabbai's folders: starred, or put in a folder - then it stands there, among their parts. */}
                    <div className="mt-1 flex flex-wrap items-center gap-1 px-1 text-[11px]">
                      <button type="button" className="rounded p-0.5 hover:bg-muted" aria-pressed={star} aria-label={`${star ? "הסרה מהמועדפים" : "הוספה למועדפים"} ${p.name}`}
                        onClick={() => changeLibrary(`library-star:${id}`, (l) => toggleFavorite(l, id))}>
                        <Star className={`size-4 ${star ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`} aria-hidden />
                      </button>
                      <select aria-label={`העברת ${p.name} לתיקייה`} className={`${SELECT_CLASS} h-6 max-w-32 text-[11px]`} value={library.place[id] ?? ""}
                        onChange={(e) => {
                          const folder = e.target.value;
                          changeLibrary(`library-move:${id}`, (l) => (folder ? putInFolder(l, [id], folder, {}) : { ...l, place: Object.fromEntries(Object.entries(l.place).filter(([k]) => k !== id)) }));
                          if (folder) toast.success(`"${p.name}" ${folder === "parts-catalog" ? 'נוסף ל"מהאוסף המשותף"' : "הועבר לתיקייה"} - בחלקים שבתיקיות.`);
                        }}>
                        <option value="">{library.place[id] ? "הוצאה מהתיקייה" : "לתיקייה…"}</option>
                        <option value="parts-catalog">מהאוסף המשותף</option>
                        {library.folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                  </div>
                );
              })}
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
