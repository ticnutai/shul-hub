/**
 * A library in folders - the kits, and the saved parts - one way for both:
 * folders by topic (and the gabbai's own), each opened or closed (and so
 * kept on this computer), the starred first of all, a search and the tags
 * across them all. An item goes into a folder by dragging it there - a
 * label follows the hand, saying what goes where - or by its "העברה לתיקייה"
 * menu, the way on a phone; several chosen go together.
 */
import { InfoTip } from "@/components/InfoTip";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, FolderPlus, Pencil, Search, Star, Tag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { confirmAction } from "@/components/ConfirmDialog";
import {
  MAX_FOLDERS, addTag, allTags, folderOf, moveFolder, newFolderId, putInFolder, removeFolder, removeTag, toggleFavorite,
  type Library,
} from "@/tv/library";
import { PART_GRID } from "./GalleryTile";
import { SELECT_CLASS } from "./editorParts";
import { choiceChipClass } from "./Notice";

export interface LibraryItem {
  id: string;
  name: string;
  /** The folder it stands in until it is put elsewhere. */
  home: string;
}

export interface FixedFolder {
  id: string;
  name: string;
}

const FAVORITES = "favorites";
/** Every folder opened (the editor's tests, and "פתיחת הכול"). */
const ALL = "all";

function readOpen(key: string): string[] | typeof ALL | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v === ALL ? ALL : Array.isArray(v) ? v.filter((x) => typeof x === "string") : null;
  } catch {
    return null;
  }
}

export function FolderedLibrary({ items, fixed, library, onLibrary, tile, extra, onCopy, opened, storageKey, testId, what }: {
  items: LibraryItem[];
  /** The folders that are always there (the topics, one's own), after the gabbai's. */
  fixed: FixedFolder[];
  library: Library;
  onLibrary: (key: string, change: (l: Library) => Library) => void;
  /** An item's own tile. */
  tile: (item: LibraryItem) => ReactNode;
  /** More actions on an item's line, beside the star and the folder (sharing it with every board...). */
  extra?: (item: LibraryItem) => ReactNode;
  /**
   * A copy of its own into a folder (any, its own too): a thing apart from the one
   * it was copied from - changed or deleted, the other stays as it was.
   */
  onCopy?: (item: LibraryItem, folder: string) => void;
  /** Folders open to begin with (today's occasion, one's own...), until the gabbai opens or closes any. */
  opened: string[];
  /** Where on this computer the open folders are kept. */
  storageKey: string;
  testId: string;
  /** "ערכה" / "חלק": in the words of the library. */
  what: { one: string; many: string };
}) {
  const folders = useMemo(() => [...library.folders, ...fixed], [library.folders, fixed]);
  const known = useMemo(() => new Set(folders.map((f) => f.id)), [folders]);
  const homes = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i.home])), [items]);
  const [open, setOpenState] = useState<string[] | typeof ALL>(() => readOpen(storageKey) ?? [FAVORITES, ...opened, ...library.folders.map((f) => f.id)]);
  const setOpen = (next: string[] | typeof ALL) => {
    setOpenState(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* no storage: open for this visit */
    }
  };
  const isOpen = (id: string) => open === ALL || open.includes(id);
  const toggle = (id: string) => {
    const now = open === ALL ? [FAVORITES, ...folders.map((f) => f.id)] : open;
    setOpen(now.includes(id) ? now.filter((x) => x !== id) : [...now, id]);
  };

  const [query, setQuery] = useState("");
  const [tagOn, setTagOn] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [naming, setNaming] = useState<{ id: string | null; value: string } | null>(null);
  const [tagging, setTagging] = useState<{ id: string; value: string } | null>(null);

  const q = query.trim();
  const shown = items.filter((i) => (!q || i.name.includes(q)) && (!tagOn || (library.tags[i.id] ?? []).includes(tagOn)));
  const shownIds = new Set(shown.map((i) => i.id));
  const tags = allTags(library, new Set(items.map((i) => i.id)));
  const filtering = Boolean(q || tagOn);
  const nameOf = (folder: string) => (folder === FAVORITES ? "מועדפים" : folders.find((f) => f.id === folder)?.name ?? "");

  const move = (ids: string[], folder: string) => {
    if (!ids.length) return;
    if (folder === FAVORITES) {
      onLibrary(`library-star:${ids.join(",")}`, (l) => ids.reduce((acc, id) => (acc.favorites.includes(id) ? acc : toggleFavorite(acc, id)), l));
    } else onLibrary(`library-move:${ids.join(",")}:${folder}`, (l) => putInFolder(l, ids, folder, homes));
    const one = ids.length === 1;
    const name = one ? `"${items.find((i) => i.id === ids[0])?.name}"` : `${ids.length} ${what.many}`;
    toast.success(folder === FAVORITES ? `${name} ${one ? "נוסף" : "נוספו"} למועדפים` : `${name} ${one ? "הועבר" : "הועברו"} לתיקייה "${nameOf(folder)}"`);
    // The folder it went to opens: where it is now is in sight.
    if (!isOpen(folder)) toggle(folder);
  };

  // Dragging: what goes, over which folder, and a label following the hand.
  const [drag, setDrag] = useState<{ ids: string[]; name: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  useEffect(() => {
    if (!drag) return;
    const follow = (e: DragEvent) => setAt({ x: e.clientX, y: e.clientY });
    const end = () => { setDrag(null); setOver(null); setAt(null); };
    window.addEventListener("dragover", follow);
    window.addEventListener("dragend", end);
    window.addEventListener("drop", end);
    return () => {
      window.removeEventListener("dragover", follow);
      window.removeEventListener("dragend", end);
      window.removeEventListener("drop", end);
    };
  }, [drag]);
  const dropTarget = (folder: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (over !== folder) setOver(folder);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === folder ? null : o));
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const ids = dragRef.current?.ids ?? (e.dataTransfer.getData("text/plain") ? [e.dataTransfer.getData("text/plain")] : []);
      move(ids, folder);
      setDrag(null); setOver(null); setAt(null);
    },
  });

  const addFolder = () => {
    const name = (naming?.value ?? "").trim().slice(0, 40);
    if (!name) return toast.error("צריך לתת שם לתיקייה");
    if (naming?.id) onLibrary(`library-rename:${naming.id}`, (l) => ({ ...l, folders: l.folders.map((f) => (f.id === naming.id ? { ...f, name } : f)) }));
    else {
      if (library.folders.length >= MAX_FOLDERS) return toast.error(`עד ${MAX_FOLDERS} תיקיות`);
      const id = newFolderId();
      onLibrary(`library-folder:${id}`, (l) => ({ ...l, folders: [...l.folders, { id, name }] }));
      if (open !== ALL) setOpen([...open, id]);
    }
    setNaming(null);
  };

  const itemCard = (item: LibraryItem, folder: string) => {
    const star = library.favorites.includes(item.id);
    const chosen = picked.includes(item.id);
    const mine = library.tags[item.id] ?? [];
    return (
      <div
        key={`${folder}:${item.id}`}
        data-library-item={item.id}
        draggable
        onDragStart={(e) => {
          const ids = picking && chosen ? picked : [item.id];
          e.dataTransfer.setData("text/plain", item.id);
          e.dataTransfer.effectAllowed = "move";
          setDrag({ ids, name: ids.length > 1 ? `${ids.length} ${what.many}` : item.name });
        }}
        className={`relative rounded-lg ${chosen ? "ring-2 ring-primary" : ""} ${drag?.ids.includes(item.id) ? "opacity-50" : ""}`}
        title="אפשר לגרור לתיקייה"
      >
        {picking && (
          <input type="checkbox" className="absolute start-2 top-2 z-20 size-5" aria-label={`בחירת ${item.name}`} checked={chosen}
            onChange={(e) => setPicked(e.target.checked ? [...picked, item.id] : picked.filter((x) => x !== item.id))} />
        )}
        {tile(item)}
        <div className="mt-1 flex flex-wrap items-center gap-1 px-1 text-[11px]">
          <button type="button" className="rounded p-0.5 hover:bg-muted" aria-label={`${star ? "הסרה מהמועדפים" : "הוספה למועדפים"} ${item.name}`} aria-pressed={star}
            title={star ? "הסרה מהמועדפים" : "הוספה למועדפים - מופיע ראשון"}
            onClick={() => {
              onLibrary(`library-star:${item.id}`, (l) => toggleFavorite(l, item.id));
              // Starred: the favourites open, where it now is too.
              if (!star && !isOpen(FAVORITES)) toggle(FAVORITES);
            }}>
            <Star className={`size-4 ${star ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`} aria-hidden />
          </button>
          <select aria-label={`העברת ${item.name} לתיקייה`} className={`${SELECT_CLASS} h-6 max-w-32 text-[11px]`} value=""
            onChange={(e) => e.target.value && move([item.id], e.target.value)}>
            <option value="">העברה לתיקייה…</option>
            {folders.filter((f) => f.id !== folderOf(library, item.id, item.home, known)).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          {onCopy && (
            <select aria-label={`העתקת ${item.name} לתיקייה`} className={`${SELECT_CLASS} h-6 max-w-32 text-[11px]`} value=""
              title="עותק נפרד: שינוי או מחיקה שלו לא משנים את המקור, וגם לא להפך"
              onChange={(e) => e.target.value && onCopy(item, e.target.value)}>
              <option value="">העתקה לתיקייה…</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
          {extra?.(item)}
          {mine.map((t) => (
            <span key={t} className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5">
              {t}
              <button type="button" aria-label={`הסרת התגית ${t} מ${item.name}`} onClick={() => onLibrary(`library-untag:${item.id}`, (l) => removeTag(l, item.id, t))}>
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
          {tagging?.id === item.id ? (
            <form className="inline-flex items-center gap-1" onSubmit={(e) => {
              e.preventDefault();
              onLibrary(`library-tag:${item.id}`, (l) => addTag(l, item.id, tagging.value));
              setTagging(null);
            }}>
              <input autoFocus list={`${testId}-tags`} aria-label={`תגית חדשה ל${item.name}`} value={tagging.value} maxLength={20}
                onChange={(e) => setTagging({ id: item.id, value: e.target.value })} onKeyDown={(e) => e.key === "Escape" && setTagging(null)}
                className="h-6 w-24 rounded border bg-background px-1" />
              <button type="submit" className="h-6 rounded border bg-background px-1.5">הוספה</button>
            </form>
          ) : (
            <button type="button" className="inline-flex items-center gap-0.5 rounded px-1 text-muted-foreground hover:bg-muted" aria-label={`הוספת תגית ל${item.name}`}
              onClick={() => setTagging({ id: item.id, value: "" })}>
              <Tag className="size-3" aria-hidden /> תגית
            </button>
          )}
        </div>
      </div>
    );
  };

  const folderBlock = (folder: FixedFolder, list: LibraryItem[], own: boolean, index = -1) => {
    if (filtering && !list.length) return null;
    const shownOpen = filtering || isOpen(folder.id);
    return (
      <section key={folder.id} data-library-folder={folder.id} {...dropTarget(folder.id)}
        className={`rounded-lg border transition ${over === folder.id ? "border-primary bg-primary/10 ring-2 ring-primary" : "bg-muted/20"}`}>
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <button type="button" className="flex min-w-0 flex-1 items-center gap-1.5 text-right" aria-expanded={shownOpen}
            aria-label={`${shownOpen ? "סגירת" : "פתיחת"} התיקייה ${folder.name}`} onClick={() => toggle(folder.id)}>
            {shownOpen ? <ChevronDown className="size-4 shrink-0" aria-hidden /> : <ChevronLeft className="size-4 shrink-0" aria-hidden />}
            {folder.id === FAVORITES && <Star className="size-4 shrink-0 fill-amber-400 text-amber-500" aria-hidden />}
            <span className="truncate text-sm font-semibold">{folder.name}</span>
            <span className="text-xs text-muted-foreground">({list.length})</span>
          </button>
          {own && (
            <span className="flex shrink-0 items-center gap-0.5">
              <button type="button" className="rounded p-1 hover:bg-muted" aria-label={`שינוי השם של התיקייה ${folder.name}`} onClick={() => setNaming({ id: folder.id, value: folder.name })}><Pencil className="size-3.5" aria-hidden /></button>
              <button type="button" className="rounded p-1 hover:bg-muted disabled:opacity-30" disabled={index <= 0} aria-label={`התיקייה ${folder.name} למעלה`} onClick={() => onLibrary(`library-up:${folder.id}`, (l) => moveFolder(l, folder.id, -1))}><ArrowUp className="size-3.5" aria-hidden /></button>
              <button type="button" className="rounded p-1 hover:bg-muted disabled:opacity-30" disabled={index >= library.folders.length - 1} aria-label={`התיקייה ${folder.name} למטה`} onClick={() => onLibrary(`library-down:${folder.id}`, (l) => moveFolder(l, folder.id, 1))}><ArrowDown className="size-3.5" aria-hidden /></button>
              <button type="button" className="rounded p-1 text-destructive hover:bg-muted" aria-label={`מחיקת התיקייה ${folder.name}`}
                onClick={async () => {
                  const ok = await confirmAction({ title: `למחוק את התיקייה „${folder.name}”?`, description: `ה${what.many} שבה (${list.length}) לא נמחקים - הם חוזרים לתיקייה שלהם.`, confirmLabel: "מחיקת התיקייה" });
                  if (ok) onLibrary(`library-remove:${folder.id}`, (l) => removeFolder(l, folder.id));
                }}><Trash2 className="size-3.5" aria-hidden /></button>
            </span>
          )}
        </div>
        {shownOpen && (
          list.length
            ? <div className={`${PART_GRID} px-2 pb-2`}>{list.map((i) => itemCard(i, folder.id))}</div>
            : <p className="flex items-center gap-1 px-3 pb-2 text-[11px] text-muted-foreground">{folder.id === FAVORITES ? "אין עדיין מועדפים" : "התיקייה ריקה"}<InfoTip>{folder.id === FAVORITES ? "לוחצים על הכוכב שליד ערכה כדי שתופיע כאן." : `גוררים לכאן ${what.one}, או "העברה לתיקייה" שמתחתיה.`}</InfoTip></p>
        )}
      </section>
    );
  };

  const favorites = shown.filter((i) => library.favorites.includes(i.id));
  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="relative flex min-w-40 flex-1 items-center">
          <Search className="pointer-events-none absolute start-2 size-4 text-muted-foreground" aria-hidden />
          <input type="search" aria-label={`חיפוש ${what.one}`} placeholder={`חיפוש ${what.one} לפי שם`} value={query} onChange={(e) => setQuery(e.target.value)}
            className="h-8 w-full rounded-md border bg-background ps-8 pe-2 text-sm" />
        </label>
        <button type="button" className="h-8 rounded-md border bg-background px-2 text-xs" onClick={() => setOpen(ALL)}>פתיחת הכול</button>
        <button type="button" className="h-8 rounded-md border bg-background px-2 text-xs" onClick={() => setOpen([])}>סגירת הכול</button>
        <button type="button" className="inline-flex h-8 items-center gap-1 rounded-md border bg-background px-2 text-xs" onClick={() => setNaming({ id: null, value: "" })}>
          <FolderPlus className="size-3.5" aria-hidden /> תיקייה חדשה
        </button>
        <button type="button" aria-pressed={picking} className={choiceChipClass(picking, "h-8 text-xs")} onClick={() => { setPicking(!picking); setPicked([]); }}>
          בחירה מרובה
        </button>
      </div>
      {naming && (
        <form className="flex flex-wrap items-center gap-1.5 rounded-md border bg-background p-2 text-sm" onSubmit={(e) => { e.preventDefault(); addFolder(); }}>
          <label className="flex items-center gap-1.5">
            {naming.id ? "שם התיקייה" : "שם התיקייה החדשה"}
            <input autoFocus aria-label="שם התיקייה" value={naming.value} maxLength={40} onChange={(e) => setNaming({ ...naming, value: e.target.value })}
              onKeyDown={(e) => e.key === "Escape" && setNaming(null)} className="h-8 rounded border px-2" placeholder="למשל: חגים, ימים נוראים" />
          </label>
          <button type="submit" className="h-8 rounded-md bg-primary px-3 text-primary-foreground">{naming.id ? "שינוי השם" : "יצירה"}</button>
          <button type="button" className="h-8 rounded-md border px-3" onClick={() => setNaming(null)}>ביטול</button>
        </form>
      )}
      {picking && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1.5 text-xs" data-testid={`${testId}-picked`}>
          <span>נבחרו {picked.length}. מסמנים בתיבה שעל כל {what.one}, או גוררים אחת מהן - כולן יעברו יחד.</span>
          <select aria-label="העברת הנבחרות לתיקייה" disabled={!picked.length} className={`${SELECT_CLASS} h-7`} value=""
            onChange={(e) => { if (e.target.value) { move(picked, e.target.value); setPicked([]); } }}>
            <option value="">העברת הנבחרות אל…</option>
            {[{ id: FAVORITES, name: "מועדפים" }, ...folders].map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <button type="button" className="rounded border bg-background px-2 py-0.5" onClick={() => setPicked(shown.map((i) => i.id))}>בחירת כל המוצגות</button>
          <button type="button" className="rounded border bg-background px-2 py-0.5" onClick={() => setPicked([])}>ניקוי הבחירה</button>
        </div>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-xs" role="group" aria-label="סינון לפי תגית">
          <span className="text-muted-foreground">תגיות:</span>
          {tags.map((t) => (
            <button key={t} type="button" aria-pressed={tagOn === t} className={choiceChipClass(tagOn === t, "text-xs")} onClick={() => setTagOn(tagOn === t ? null : t)}>{t}</button>
          ))}
        </div>
      )}
      <datalist id={`${testId}-tags`}>{tags.map((t) => <option key={t} value={t} />)}</datalist>
      {filtering && !shown.length && <p className="text-sm text-muted-foreground">לא נמצאו {what.many} {q ? `בשם "${q}"` : ""}{tagOn ? ` עם התגית "${tagOn}"` : ""}.</p>}
      {(favorites.length > 0 || library.favorites.length > 0) && folderBlock({ id: FAVORITES, name: "מועדפים" }, favorites, false)}
      {library.folders.map((f, i) => folderBlock(f, shown.filter((it) => folderOf(library, it.id, it.home, known) === f.id), true, i))}
      {fixed.map((f) => folderBlock(f, shown.filter((it) => folderOf(library, it.id, it.home, known) === f.id), false))}
      {drag && at && (
        <div className="pointer-events-none fixed z-[100] rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground shadow-lg" style={{ left: at.x + 14, top: at.y + 14 }} data-testid="library-drag-label">
          מעביר את {drag.ids.length > 1 ? drag.name : `"${drag.name}"`}{over ? ` אל "${nameOf(over)}"` : " - שחררו מעל תיקייה"}
        </div>
      )}
    </div>
  );
}
