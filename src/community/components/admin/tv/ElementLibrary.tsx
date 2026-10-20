import { toast } from 'sonner';
import { confirmAction } from '@/components/ConfirmDialog';
import type { TvConfig } from '@/tv/config';
import { elementId, exportElementSet, importElementSet, MAX_ELEMENTS, MAX_ELEMENT_SETS, newElement, normalizeElementLibrary } from '@/tv/elements';
import { addInside, addPictureAlone, containerTree } from '@/tv/containers';
import { READY_PARTS } from '@/tv/readyParts';
import { hideReady, isHiddenReady, showReady } from '@/tv/readyItems';
import { HiddenShelf } from './ReadyShelf';
import { SubPart } from './Parts';
import { SaveToParts } from './ContainerAdd';
import { PartTile } from './GalleryTile';
import { useSharedCatalog } from '@/tv/sharedCatalog';
import { FolderedLibrary, type FixedFolder, type LibraryItem } from './FolderedLibrary';
import { useLibraryEdit, useLibraryOf } from './libraryEdit';
import { sharedId, useTvLibraryItems } from './useTvLibrary';
import { SharedCatalogLibrary } from './SharedCatalogLibrary';

/**
 * Parts kept in "החלקים שלי" under a name - the parts chosen in the list, or
 * a frame of a board of parts with its picture, heading and content: the one
 * way, from both places. The same name is asked about, then replaced.
 * True when kept.
 */
export async function saveToLibrary(
  config: TvConfig,
  onEdit: (key: string, update: (c: TvConfig) => TvConfig) => void,
  name: string,
  elements: TvConfig['elements'],
): Promise<boolean> {
  const clean = name.trim().slice(0, 80);
  if (!clean || !elements.length) return false;
  const same = config.elementLibrary.find((x) => x.name === clean);
  if (same) {
    const ok = await confirmAction({
      title: `כבר יש חלק בשם „${clean}”`,
      description: 'להחליף אותו במה שנבחר עכשיו?',
      confirmLabel: 'החלפה',
      destructive: false,
    });
    if (!ok) return false;
  } else if (config.elementLibrary.length >= MAX_ELEMENT_SETS) {
    toast.error(`הגעתם למספר החלקים השמורים המרבי (${MAX_ELEMENT_SETS}).`);
    return false;
  }
  const kept = structuredClone(elements);
  onEdit(`element-library:add:${same?.id ?? clean}`, (c) => ({
    ...c,
    elementLibrary: same
      ? c.elementLibrary.map((x) => (x.id === same.id ? { ...x, elements: kept } : x))
      : [...c.elementLibrary, { id: elementId(), name: clean, elements: kept }].slice(0, MAX_ELEMENT_SETS),
  }));
  toast.success(`"${clean}" נשמר בחלקים שלי - גם ברשימת "הוספת תוכן". הוא יישמר עם הלוח ב"שמור ושדר".`);
  return true;
}

/** The folders always in the parts' library. */
const PART_FOLDERS: FixedFolder[] = [
  { id: 'parts-mine', name: 'החלקים שלי' },
  { id: 'parts-shared', name: 'משותף לכל הלוחות' },
  { id: 'parts-images', name: 'התמונות שלי' },
  { id: 'parts-ready', name: 'חלקים מוכנים מהערכות' },
  { id: 'parts-catalog', name: 'מהאוסף המשותף' },
];

export function ElementLibrary({ config, selected, onEdit, onSelect }: {
  config: TvConfig;
  selected: string[];
  onSelect: (ids: string[]) => void;
  onEdit: (key: string, update: (c: TvConfig) => TvConfig) => void;
}) {
  const chosen = config.elements.filter((e) => selected.includes(e.id));
  const insert = (key: string, elements: TvConfig['elements']) => {
    const added = importElementSet(exportElementSet(elements)).map((e) => ({ ...e, locked: false, hidden: false }));
    onEdit(`${key}:${elementId()}`, (c) => ({ ...c, elements: [...c.elements, ...added].slice(0, MAX_ELEMENTS) }));
    onSelect(added.map((e) => e.id));
  };
  const full = (n: number) => config.elements.length + n > MAX_ELEMENTS;

  const remove = async (item: TvConfig['elementLibrary'][number]) => {
    const ok = await confirmAction({
      title: `למחוק את „${item.name}” מהחלקים שלי?`,
      description: 'עותקים שכבר על הלוח יישארו.',
      confirmLabel: 'מחיקה',
    });
    if (ok) onEdit(`element-library:remove:${item.id}`, (c) => ({ ...c, elementLibrary: c.elementLibrary.filter((x) => x.id !== item.id) }));
  };

  // The library: one's own parts at home in "החלקים שלי", the ready ones in theirs, and a part of the shared collection once placed.
  const changeLibrary = useLibraryEdit(onEdit);
  const library = useLibraryOf(config);
  const { catalog } = useSharedCatalog();
  const ready = READY_PARTS.filter((item) => !isHiddenReady(config, 'part', item.id));
  const placed = new Set([...Object.keys(library.place), ...library.favorites]);
  const fromCatalog = (catalog?.parts ?? []).filter((p) => placed.has(`catalog:${p.id}`));
  const items: LibraryItem[] = [
    ...config.elementLibrary.map((x) => ({ id: `part:${x.id}`, name: x.name, home: 'parts-mine' })),
    ...ready.map((x) => ({ id: `part:${x.id}`, name: x.name, home: 'parts-ready' })),
    ...fromCatalog.map((p) => ({ id: `catalog:${p.id}`, name: p.name, home: 'parts-catalog' })),
  ];
  // Kept for every board (tv_library_items), each read as a board's own saved parts are.
  const sharedLibrary = useTvLibraryItems();
  const sharedParts = sharedLibrary.items.filter((r) => r.kind === 'part').flatMap((row) => {
    const set = normalizeElementLibrary([row.data])[0];
    return set ? [{ row, set }] : [];
  });
  items.push(...sharedParts.map(({ row }) => ({ id: sharedId(row.id), name: row.name, home: 'parts-shared' })));
  // The pictures uploaded (on any board): put on this one - into the container chosen, in its shape, or on their own.
  const images = sharedLibrary.items.filter((r) => r.kind === 'image' && typeof (r.data as { url?: unknown } | null)?.url === 'string');
  items.push(...images.map((row) => ({ id: sharedId(row.id), name: row.name, home: 'parts-images' })));
  /** A picture of "התמונות שלי" put on: into the container chosen (addInside - its board's area and shape), else alone (addPictureAlone). */
  const putImage = (url: string, name: string) => {
    const tree = containerTree(config.elements, config.containers ?? []);
    const into = tree.containers.find((c) => selected.some((id) => c.parts.includes(id)));
    const id = elementId();
    onEdit(`library-image:${id}`, (c) => (c.elements.length >= MAX_ELEMENTS ? c : { ...c, ...(into ? addInside(c, into.id, id, 'image', { image: url, name }) : addPictureAlone(c, id, { url, name })) }));
    onSelect([id]);
    toast.success(into ? `"${name}" נוספה לקונטיינר שבחרתם, בצורה שלו.` : `"${name}" נוספה ללוח - גררו אותה למקום, ושנו צורה וגודל בידיות.`);
  };
  const partTile = (id: string) => {
    const image = images.find((row) => sharedId(row.id) === id);
    if (image) {
      const url = (image.data as { url: string }).url;
      return <PartTile name={image.name} elements={[{ ...newElement('image'), id: `preview_${image.id.slice(0, 8)}`, image: url, x: 5, y: 5, width: 90, height: 90 }]}
        addLabel={`הוספת התמונה ${image.name}`} disabled={full(1)} onAdd={() => putImage(url, image.name)}
        remove={{ ready: false, onClick: async () => {
          const ok = await confirmAction({ title: `להוציא את „${image.name}” מהתמונות שלי?`, description: 'לוחות שכבר מציגים אותה לא ישתנו.', confirmLabel: 'הוצאה' });
          if (ok) await sharedLibrary.remove(image);
        } }} />;
    }
    const shared = sharedParts.find(({ row }) => sharedId(row.id) === id);
    if (shared) return <PartTile name={shared.row.name} elements={shared.set.elements} addLabel={`הוספת ${shared.row.name} מהספרייה המשותפת`} disabled={full(shared.set.elements.length)}
      onAdd={() => insert('shared-library:insert', shared.set.elements)}
      remove={{ ready: false, onClick: async () => {
        const ok = await confirmAction({ title: `להוציא את „${shared.row.name}” מהספרייה המשותפת?`, description: 'החלק לא יופיע יותר בלוחות. עותקים שכבר על לוחות יישארו.', confirmLabel: 'הוצאה מהספרייה' });
        if (ok) await sharedLibrary.remove(shared.row);
      } }} />;
    const own = config.elementLibrary.find((x) => `part:${x.id}` === id);
    if (own) return <PartTile name={own.name} elements={own.elements} addLabel={`הוספת ${own.name} מהחלקים שלי`} disabled={full(own.elements.length)}
      onAdd={() => insert('element-library:insert', own.elements)} remove={{ ready: false, onClick: () => void remove(own) }} />;
    const r = ready.find((x) => `part:${x.id}` === id);
    if (r) return <PartTile name={r.name} elements={r.elements} addLabel={`הוספת ${r.name}`} disabled={full(r.elements.length)}
      onAdd={() => insert('ready-part:insert', r.elements)}
      // Hidden from this board's list, brought back from the shelf below - as every ready gallery.
      remove={{ ready: true, onClick: () => onEdit(`ready-part:hide:${r.id}`, (c) => hideReady(c, 'part', r.id)) }} />;
    const c = fromCatalog.find((p) => `catalog:${p.id}` === id)!;
    return <PartTile name={c.name} elements={c.elements} addLabel={`הוספת ${c.name}`} disabled={full(c.elements.length)} onAdd={() => insert('shared-part:insert', c.elements)} />;
  };

  return (
    <div className="space-y-5">
      <SubPart title="חלקים משותפים מכל הערכות" testId="shared-catalog-parts" hint="זמינים בכל לוח, גם חדש. הוספה משנה את הטיוטה בלבד, ולא את המקור המשותף.">
        <SharedCatalogLibrary config={config} onEdit={onEdit} onSelect={onSelect} />
      </SubPart>

      {/* The parts in folders: one's own, the ready ones of the kits, and any of the shared collection put in a folder or starred. */}
      <SubPart title="החלקים בתיקיות" hint="החלקים שלכם, החלקים המוכנים מהערכות, וכל חלק מהאוסף המשותף שהעברתם לתיקייה או סימנתם בכוכב. גוררים חלק לתיקייה, פותחים וסוגרים, ומחפשים לפי שם או תגית.">
        <div data-testid="ready-parts">
          <FolderedLibrary
            items={items}
            fixed={PART_FOLDERS}
            library={library}
            onLibrary={changeLibrary}
            tile={(item) => partTile(item.id)}
            // One's own parts, kept for every board too.
            extra={(item) => {
              const own = config.elementLibrary.find((x) => `part:${x.id}` === item.id);
              return own ? (
                <button type="button" className="rounded px-1 text-primary hover:bg-muted" title="נשמר בספרייה המשותפת - זמין בכל הלוחות, בכל בתי הכנסת"
                  onClick={() => void sharedLibrary.add('part', own.name, own)}>
                  שיתוף לכל הלוחות
                </button>
              ) : null;
            }}
            opened={['parts-mine', 'parts-ready']}
            storageKey="tv-library-open:parts"
            testId="part-folders"
            what={{ one: 'חלק', many: 'חלקים' }}
          />
        </div>
        <HiddenShelf
          testId="ready-parts-hidden"
          items={READY_PARTS.filter((item) => isHiddenReady(config, 'part', item.id)).map((item) => ({ key: item.id, name: item.name }))}
          onRestore={(id) => onEdit(`ready-part:show:${id}`, (c) => showReady(c, 'part', id))}
        />
      </SubPart>

      <SubPart title="החלקים והתיבות שלי" testId="element-library" hint='שומרים בחירה פעם אחת ומוסיפים עותקים לכל לוח. אותה רשימה מופיעה גם ב"הוספת תוכן", ותיבה שנשמרה מ"עוד אפשרויות" של מסגרת נכנסת לכאן. נשמרת עם הלוח ובקובץ הלוח.'>
        <div className="flex flex-wrap items-center gap-2">
          <SaveToParts key={selected.join(',')} config={config} onEdit={onEdit} elements={chosen} name="" />
          <span className="text-[11px] text-muted-foreground">
            {chosen.length ? `נבחרו ${chosen.length} חלקים` : 'בוחרים קונטיינר, תמונה או חלק - בלוח או ברשימה למעלה. אותו כפתור נמצא גם בחלון שנפתח ליד הלוח.'}
          </span>
        </div>
        {config.elementLibrary.length > 0 && <p className="text-[11px] text-muted-foreground">החלקים ששמרתם ({config.elementLibrary.length}) נמצאים למעלה, בתיקייה "החלקים שלי" או בתיקייה שהעברתם אליה.</p>}
      </SubPart>
    </div>
  );
}
