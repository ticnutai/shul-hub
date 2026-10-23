import { Hint } from "@/components/InfoTip";
import { CatalogPreview } from './CatalogPreview';
import { useSharedCatalog } from '@/tv/sharedCatalog';
import { CATALOG_CATEGORIES, catalogCategory } from '@/tv/catalogCategories';
import { useLibraryEdit, useLibraryOf } from './libraryEdit';
import { sharedId, useTvLibraryItems } from './useTvLibrary';
import { normalizeTvConfig } from '@/tv/config';
import { ofParts } from '@/tv/designs';
import { FolderedLibrary, type FixedFolder, type LibraryItem } from './FolderedLibrary';
import { useState, type ReactNode } from "react";
import { SubPart } from "./Parts";
import { Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { confirmAction } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import type { TvConfig } from "@/tv/config";
import { isOccasionKit, wornBy } from "@/tv/occasionDesign";
import { readOccasions } from "@/tv/occasions";
import { folderOf, putInFolder } from "@/tv/library";
import { NameForm } from "./editorParts";
import { PART_GRID } from "./GalleryTile";
import { CatalogNotice } from "./SharedCatalogLibrary";
import { findBackdrop } from "@/tv/backdrops";
import { framePictureUrl } from "@/tv/framePictures";
import { hideReady, isHiddenReady, showReady } from "@/tv/readyItems";
import { HiddenShelf, TileRemove } from "./ReadyShelf";
import { showDesignTopic } from "./designTopics";
import {
  BUILTIN_DESIGNS,
  DESIGN_GROUPS,
  DESIGN_PARTS,
  DESIGN_PART_LABELS,
  MAX_DESIGNS,
  applyDesign,
  captureDesign,
  newDesignId,
  coloursOnScreen,
  type DesignPart,
  type SavedDesign,
} from "@/tv/designs";

type Edit = (key: string, update: (c: TvConfig) => TvConfig) => void;

/**
 * What is on the board now, kept as a kit of one's own under a name - the one
 * way, from "הערכות שלי", from the toolbar over the preview and from a board
 * of parts' "שמירה כערכה": the same name is asked about and then replaced,
 * the limit is said, and it waits in the draft. Through the editor's `onEdit`,
 * so on an occasion's page it is the occasion's look that is kept.
 * True when kept.
 */
export async function saveKitAs(config: TvConfig, onEdit: Edit, rawName: string, asked: DesignPart[]): Promise<boolean> {
  // A board of parts is kept with its parts and its layout, always: without them it comes back as an ordinary board, nothing to edit part by part.
  const parts = DESIGN_PARTS.filter((p) => asked.includes(p) || PARTS_KEPT(config).includes(p));
  const name = rawName.trim().slice(0, 40);
  if (!name) return toast.error("צריך לתת שם לערכה"), false;
  if (!parts.length) return toast.error("צריך לבחור לפחות חלק אחד"), false;
  const existing = config.designs.find((d) => d.name === name);
  if (existing && !(await confirmAction({ title: `כבר יש ערכה בשם „${name}”`, description: "להחליף אותה במה שעל הלוח עכשיו?", confirmLabel: "החלפה", destructive: false })))
    return false;
  if (!existing && config.designs.length >= MAX_DESIGNS) {
    toast.error(`הגעתם למספר הערכות המרבי (${MAX_DESIGNS}). מחקו ערכה ב"הערכות שלי".`);
    return false;
  }
  onEdit(`design-new:${name}`, (c) => {
    const kit = captureDesign(c, name, parts, existing?.id);
    return { ...c, designs: existing ? c.designs.map((d) => (d.id === existing.id ? kit : d)) : [...c.designs, kit].slice(0, MAX_DESIGNS) };
  });
  toast.success(`הערכה "${name}" נשמרה - בטיוטה עד "שמור ושדר".`);
  return true;
}

/** What a new kit holds to start with: a board of parts whole (its layout is what makes it one), else its look. */
const startingParts = (config: TvConfig): DesignPart[] =>
  config.screenLayout === "composition" ? [...DESIGN_PARTS] : ["background", "frames", "text"];
/** On a board of parts, its parts ("מסגרות") and their layout ("פריסה") are always kept: they are what makes the kit editable. */
const PARTS_KEPT = (config: TvConfig): DesignPart[] => (config.screenLayout === "composition" ? ["frames", "layout"] : []);

/** The form of a new kit: its name and what it holds. One form, wherever a kit is saved from. */
export function KitSaveForm({ config, onEdit, onDone, testId }: { config: TvConfig; onEdit: Edit; onDone: () => void; testId?: string }) {
  const [name, setName] = useState("");
  const [parts, setParts] = useState<DesignPart[]>(() => startingParts(config));
  const kept = PARTS_KEPT(config);
  return (
    <NameForm
      testId={testId}
      label="שם הערכה"
      value={name}
      maxLength={40}
      placeholder="שם לערכה, למשל: חגים"
      onChange={setName}
      onSave={async () => {
        if (await saveKitAs(config, onEdit, name, parts)) onDone();
      }}
      onCancel={onDone}
      saveLabel="שמירת הערכה"
      extra={
        <fieldset className="space-y-1">
          <legend className="text-xs font-medium">מה הערכה כוללת</legend>
          <div className="flex flex-wrap gap-3">
            {DESIGN_PARTS.map((p) => (
              <label key={p} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={parts.includes(p) || kept.includes(p)}
                  disabled={kept.includes(p)}
                  onChange={(e) => setParts(e.target.checked ? [...parts, p] : parts.filter((x) => x !== p))}
                />
                {DESIGN_PART_LABELS[p]}
              </label>
            ))}
          </div>
          <Hint>
            כשמפעילים את הערכה, רק החלקים המסומנים משתנים בלוח. השאר נשאר כמו שהוא.
            {kept.length > 0 && " בלוח מחלקים, המסגרות והפריסה תמיד נשמרות - בלעדיהן לא יהיה אפשר לערוך את הערכה חלק אחרי חלק."}
          </Hint>
        </fieldset>
      }
    />
  );
}

/** "שמירה כערכה חדשה" beside the preview's device menu (and in the live window): the same form, in a small window. */
export function SaveKitButton({ config, onEdit }: { config: TvConfig; onEdit: Edit }) {
  const [open, setOpen] = useState(false);
  const full = config.designs.length >= MAX_DESIGNS;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={full}
          data-testid="toolbar-save-kit"
          aria-label="שמירה כערכה חדשה"
          title={full ? `הגעתם למספר הערכות המרבי (${MAX_DESIGNS})` : 'שומר את מה שעל הלוח עכשיו כערכה משלכם - תופיע ב"הערכות שלי"'}
        >
          <Plus className="size-4" aria-hidden /> ערכה חדשה
        </Button>
      </PopoverTrigger>
      <PopoverContent dir="rtl" align="end" className="w-96 max-w-[calc(100vw-1rem)] space-y-2 p-3 text-right">
        <p className="text-sm font-semibold">שמירה כערכה חדשה</p>
        {open && <KitSaveForm config={config} onEdit={onEdit} onDone={() => setOpen(false)} testId="toolbar-kit-form" />}
      </PopoverContent>
    </Popover>
  );
}

/** The folders always in the kits' library: one's own, then the topics (catalogCategories.ts). */
const MINE_FOLDER = "mine";
export const topicFolder = (topic: string) => `topic:${topic}`;
const SHARED_FOLDER = "shared";
const KIT_FOLDERS: FixedFolder[] = [
  { id: MINE_FOLDER, name: "הערכות שלי" },
  { id: SHARED_FOLDER, name: "משותף לכל הלוחות" },
  ...CATALOG_CATEGORIES.filter((c) => c !== "הכול").map((c) => ({ id: topicFolder(c), name: c })),
];

/**
 * "העיצובים שלי": looks the gabbai built and saved - all of it, or only the
 * parts they chose - shown beside the themes, put on the board with a tap.
 * The model and its rules are designs.ts.
 */
export function DesignLibrary({ config, onEdit, todayTopics = [], onWearFor }: {
  config: TvConfig;
  onEdit: Edit;
  /** The topics of today's occasions: their folders open to begin with. */
  todayTopics?: string[];
  /**
   * A kit made an occasion's own and its page opened ("קבע לשבת ופתח"): the
   * same setting as "בחירת ערכה" in "מועדים" - a way to it, not another one.
   */
  onWearFor?: (occasionId: string, kit: SavedDesign) => void;
}) {
  const [form, setForm] = useState<{ mode: "rename"; id?: string; name: string } | null>(null);
  const designs = config.designs;
  // An occasion's own kit is edited on its page (its 🎨), not listed among the gabbai's kits.
  const mine = designs.filter((d) => !isOccasionKit(config, d));
  const { catalog, error: catalogError, retry } = useSharedCatalog();
  // Kits of parts only, here and in the shared collection: a board is built of parts.
  const extra=(catalog?.designs??[]).filter(d=>ofParts(d)&&!BUILTIN_DESIGNS.some(b=>b.id===d.id));
  const available=[...BUILTIN_DESIGNS,...extra];
  const library = useLibraryOf(config);
  // The library's order is the board's (never an occasion's look): changed on the board itself.
  const changeLibrary = useLibraryEdit(onEdit);

  /** A kit of one's own renamed (a new one is KitSaveForm's). */
  const rename = () => {
    if (!form) return;
    const name = form.name.trim().slice(0, 40);
    if (!name) return toast.error("צריך לתת שם לערכה");
    onEdit("design-rename", (c) => ({ ...c, designs: c.designs.map((d) => (d.id === form.id ? { ...d, name } : d)) }));
    setForm(null);
  };

  /** One's own kit, deleted - asked first, as every delete is. */
  const remove = async (d: SavedDesign) => {
    const ok = await confirmAction({
      title: `למחוק את הערכה „${d.name}”?`,
      description: 'לוח שכבר לובש אותה לא ישתנה. אפשר לבטל עם "צעד אחורה" (Ctrl+Z) עד השמירה.',
      confirmLabel: "מחיקה",
    });
    if (ok) onEdit("design-delete", (cfg) => ({ ...cfg, designs: cfg.designs.filter((x) => x.id !== d.id) }));
  };

  /**
   * A kit copied into a folder - "הערכות שלי", a topic, one of one's own: a kit of
   * one's own, with every part, apart from the one it came from - changed or
   * deleted, the other stays as it was (and the other way round). The one way to
   * copy a kit; it was two buttons ("שכפול לעריכה", "העתקה ללוח הזה").
   */
  const copyKit = (d: SavedDesign, folder: string) => {
    if (designs.length >= MAX_DESIGNS) return void toast.error(`הגעתם למספר הערכות המרבי (${MAX_DESIGNS}) - מחקו ערכה שלכם כדי להעתיק`);
    const id = newDesignId();
    const { occasion: _occasion, from: _from, ...kit } = structuredClone(d);
    const copy: SavedDesign = { ...kit, id, name: `${d.name.replace(/ \(שלי\)$/, "")} (שלי)`.slice(0, 40) };
    onEdit(`design-copy:${id}`, (cfg) => ({ ...cfg, designs: [...cfg.designs, copy] }));
    if (folder !== MINE_FOLDER) changeLibrary(`library-copy:${id}:${folder}`, (l) => putInFolder(l, [id], folder, { [id]: MINE_FOLDER }));
    const where = folder === MINE_FOLDER ? "הערכות שלי" : KIT_FOLDERS.find((f) => f.id === folder)?.name ?? library.folders.find((f) => f.id === folder)?.name ?? "התיקייה";
    toast.success(`נוצר עותק נפרד: "${copy.name}" - בתיקייה "${where}". שינוי או מחיקה שלו לא נוגעים במקור.`);
  };

  /** A kit of parts, put on and opened part by part: the list of free parts, where each is chosen, moved and changed. */
  const editInParts = (d: SavedDesign) => {
    onEdit("design-apply", (cfg) => applyDesign(cfg, d));
    // Once the board has its parts.
    showDesignTopic("design-elements");
  };

  const update = (d: SavedDesign) => {
    onEdit("design-update", (c) => ({
      ...c,
      designs: c.designs.map((x) => (x.id === d.id ? captureDesign(c, x.name, x.parts, x.id) : x)),
    }));
    toast.success(`הערכה "${d.name}" עודכנה למה שעל הלוח עכשיו.`);
  };

  /** The topic of a kit's folder, and the occasions it is about: "שבת" - the Shabbat and its kind; "ראש חודש"... */
  const topicOf = (d: SavedDesign) => {
    const known = new Set(KIT_FOLDERS.map((f) => f.id).concat(library.folders.map((f) => f.id)));
    const home = mine.includes(d) ? MINE_FOLDER : topicFolder(catalogCategory(d));
    const folder = folderOf(library, d.id, home, known);
    return folder.startsWith("topic:") ? folder.slice("topic:".length) : catalogCategory(d);
  };
  const occasionsOf = (d: SavedDesign) => {
    const topic = topicOf(d);
    return topic === "כללי" ? [] : readOccasions(config).filter((o) => o.name.includes(topic));
  };
  /** On a kit of an occasion's folder: made that occasion's, its page opened - and which occasion wears it now. */
  const forOccasion = (d: SavedDesign) => {
    const worn = wornBy(config, d.id);
    const fits = onWearFor ? occasionsOf(d) : [];
    if (!worn.length && !fits.length) return null;
    // The folder's own occasion first ("שבת" - the Shabbat itself), the others of its kind in a list (שבת הגדול, שבת שובה...).
    const main = fits.length === 1 ? fits[0] : fits.find((o) => o.name === topicOf(d));
    const others = fits.filter((o) => o !== main);
    return (
      <>
        {worn.length > 0 && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900" data-testid="kit-worn-by">
            {worn.map((o) => `ערכת ה${o.name}`.replace("ערכת הה", "ערכת ה")).join(" · ")}
          </span>
        )}
        {main && (
          <TileAction onClick={() => onWearFor!(main.id, d)} title={`מעכשיו הערכה הזאת מופיעה ב${main.name}, ונפתח העמוד שלו לעריכה`}>
            קבע ל{main.name} ופתח
          </TileAction>
        )}
        {others.length > 0 && (
          <select aria-label={`קביעת ${d.name} למועד`} className="h-7 rounded-md border bg-background px-1 text-xs" value=""
            onChange={(e) => e.target.value && onWearFor!(e.target.value, d)}>
            <option value="">{main ? "או למועד אחר…" : "קבע למועד ופתח…"}</option>
            {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
      </>
    );
  };

  /** A ready kit's tile: put on, copied to one's own, opened part by part. */
  const readyTile = (d: SavedDesign, group = DESIGN_GROUPS.find((g) => g.ids.includes(d.id))?.id ?? "shared") => (
          <KitTile
            key={d.id}
            design={d}
            config={config}
            thumb={group === "shared" ? undefined : `/new-shul-assets/thumbs/${d.id}.webp`}
            onApply={() => onEdit("design-apply", (cfg) => applyDesign(cfg, d))}
            onRemove={() => onEdit("design-hide", (cfg) => hideReady(cfg, "design", d.id))}
            removeReady
          >

            {ofParts(d) && <TileAction onClick={() => editInParts(d)} title="מלביש את הערכה ופותח את רשימת החלקים - כל חלק נבחר, זז ומשתנה לבד">עריכה בחלקים</TileAction>}
            {forOccasion(d)}
          </KitTile>
  );
  /** One's own kit's tile: put on, updated to the board, opened part by part, renamed, deleted. */
  const ownTile = (d: SavedDesign) => (
    <KitTile key={d.id} design={d} config={config} onApply={() => onEdit("design-apply", (cfg) => applyDesign(cfg, d))} onRemove={() => void remove(d)}>
      <TileAction onClick={() => update(d)} title="הערכה מקבלת את מה שעל הלוח עכשיו">עדכון</TileAction>
      {ofParts(d) && <TileAction onClick={() => editInParts(d)} title="מלביש את הערכה ופותח את רשימת החלקים - כל חלק נבחר, זז ומשתנה לבד">עריכה בחלקים</TileAction>}
      <TileAction onClick={() => setForm({ mode: "rename", id: d.id, name: d.name })}>שינוי שם</TileAction>
      {forOccasion(d)}
      <TileAction title="נשמרת בספרייה המשותפת - זמינה בכל הלוחות, בכל בתי הכנסת"
        onClick={() => void sharedLibrary.add("kit", d.name, d)}>
        שיתוף לכל הלוחות
      </TileAction>
    </KitTile>
  );
  // Every kit of parts, ready and one's own, in folders: one's own in "הערכות שלי", a ready one in its topic, until put elsewhere.
  const ready = available.filter((d) => ofParts(d) && !isHiddenReady(config, "design", d.id));
  const items: LibraryItem[] = [
    ...mine.map((d) => ({ id: d.id, name: d.name, home: MINE_FOLDER })),
    ...ready.map((d) => ({ id: d.id, name: d.name, home: topicFolder(catalogCategory(d)) })),
  ];
  // Kept for every board (tv_library_items): each read as a kit of this board would be.
  const sharedLibrary = useTvLibraryItems();
  const sharedKits = sharedLibrary.items.filter((r) => r.kind === "kit").flatMap((row) => {
    const d = normalizeTvConfig({ designs: [row.data] }).designs[0];
    return d ? [{ row, d }] : [];
  });
  items.push(...sharedKits.map(({ row }) => ({ id: sharedId(row.id), name: row.name, home: SHARED_FOLDER })));
  const kitOf = new Map([...mine, ...ready].map((d) => [d.id, d]));
  /** A kit kept for every board: put on, opened part by part, copied to one's own, updated by its keeper, taken out. */
  const sharedTile = ({ row, d }: (typeof sharedKits)[number]) => (
    <KitTile key={row.id} design={d} config={config} onApply={() => onEdit("design-apply", (cfg) => applyDesign(cfg, d))}
      onRemove={async () => {
        const ok = await confirmAction({ title: `להוציא את „${row.name}” מהספרייה המשותפת?`, description: "הערכה לא תופיע יותר בלוחות. לוחות שכבר לובשים אותה לא ישתנו.", confirmLabel: "הוצאה מהספרייה" });
        if (ok) await sharedLibrary.remove(row);
      }}>
      {ofParts(d) && <TileAction onClick={() => editInParts(d)} title="מלביש את הערכה ופותח את רשימת החלקים">עריכה בחלקים</TileAction>}

      <TileAction title="הערכה המשותפת מקבלת את מה שעל הלוח עכשיו - בכל הלוחות"
        onClick={async () => {
          const ok = await confirmAction({ title: `לעדכן את „${row.name}” לכל הלוחות?`, description: "הערכה המשותפת תקבל את מה שעל הלוח עכשיו. לוחות שכבר לובשים אותה לא ישתנו.", confirmLabel: "עדכון", destructive: false });
          if (ok && (await sharedLibrary.update(row, { data: captureDesign(config, d.name, d.parts, d.id) }))) toast.success(`"${row.name}" עודכנה בספרייה המשותפת.`);
        }}>
        עדכון
      </TileAction>
    </KitTile>
  );

  return (
    <div className="space-y-5" data-testid="design-library">
      {/* No title of its own: the kits are the section "ערכות" itself - its ⓘ says how they work (DesignTab). */}
      <SubPart title="ערכות מוכנות" bare>
      {catalogError && <CatalogNotice onRetry={retry} />}
      <div className="space-y-4" data-testid="builtin-designs">
      <FolderedLibrary
        items={items}
        fixed={KIT_FOLDERS}
        library={library}
        onLibrary={changeLibrary}
        onCopy={(item, folder) => {
          const shared = sharedKits.find(({ row }) => sharedId(row.id) === item.id);
          const d = shared?.d ?? kitOf.get(item.id);
          if (d) copyKit(d, folder);
        }}
        tile={(item) => {
          const shared = sharedKits.find(({ row }) => sharedId(row.id) === item.id);
          if (shared) return sharedTile(shared);
          const d = kitOf.get(item.id)!;
          return mine.includes(d) ? ownTile(d) : readyTile(d);
        }}
        opened={[MINE_FOLDER, ...todayTopics.map(topicFolder)]}
        storageKey="tv-library-open:kits"
        testId="kit-folders"
        what={{ one: "ערכה", many: "ערכות" }}
      />
      </div>
      <HiddenShelf
        testId="designs-hidden"
        items={available.filter((d) => ofParts(d) && isHiddenReady(config, "design", d.id)).map((d) => ({ key: d.id, name: d.name }))}
        onRestore={(id) => onEdit("design-show", (cfg) => showReady(cfg, "design", id))}
      />
      </SubPart>
      <SubPart title="הערכות שלי" hint='ערכות ששמרתם נמצאות למעלה, בתיקייה "הערכות שלי" (או בתיקייה שהעברתם אליה): לחיצה מלבישה; אפשר לשנות שם, לעדכן למה שעל הלוח עכשיו, ולמחוק.'>

      {form ? (
        <NameForm
          label="שם הערכה"
          value={form.name}
          maxLength={40}
          placeholder="שם לערכה, למשל: חגים"
          onChange={(name) => setForm({ ...form, name })}
          onSave={rename}
          onCancel={() => setForm(null)}
          saveLabel="שינוי השם"
        />
      ) : (
        // Saving what is on the board as a kit is one button, beside the board (SaveKitButton) - not a second one here.
        <>
          <Hint data-testid="kit-save-where">לשמירת מה שעל הלוח כערכה - הכפתור "ערכה חדשה" בשורת הכפתורים שמתחת ללוח.</Hint>
          {/* A state, not an explanation: in sight. */}
          {designs.length >= MAX_DESIGNS && <p className="text-xs text-muted-foreground">הגעתם למספר הערכות המרבי ({MAX_DESIGNS}).</p>}
        </>
      )}
      </SubPart>
    </div>
  );
}

/** An action under a kit's tile: the same size, look and place for every kit. */
function TileAction({ children, onClick, disabled, title }: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs"
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

/**
 * One kit, drawn one way wherever kits are: a picture of the board wearing
 * it, its name, what it fills, its actions in one row, and ✕ in the corner
 * (hiding a ready kit, deleting one's own). There were six ways to draw a
 * kit, side by side in the same frame - a picture, three coloured dots in a
 * strip half the height, two sketched boxes, layers on a light background.
 */
function KitTile({ design: d, config, thumb, onApply, onRemove, removeReady = false, children }: {
  design: SavedDesign;
  config: TvConfig;
  /** A ready picture of the board wearing it, when there is one. */
  thumb?: string;
  onApply: () => void;
  onRemove: () => void;
  removeReady?: boolean;
  children?: ReactNode;
}) {
  const c = { ...coloursOnScreen(config), ...d.colours };
  const background = d.values.backgroundGradient ?? c["--tv-bg-a"];
  const wall = findBackdrop(d.values.backgroundImage ?? null);
  const frame = framePictureUrl(d.values.frameStyle?.image ?? null);
  return (
    <div data-design-id={d.id} className="group relative rounded-lg border bg-card text-right">
      <TileRemove name={d.name} ready={removeReady} onClick={onRemove} />
      <button
        type="button"
        aria-label={`החלת ערכה ${d.name}`}
        onClick={onApply}
        className="block w-full overflow-hidden rounded-t-lg text-right transition hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary"
        title="ממלא את החלקים שכתובים מתחת לערכה - וכל חלק אפשר לשנות אחר כך בנפרד"
      >
        {thumb ? (
          <img src={thumb} alt="" className="aspect-video w-full object-cover" loading="lazy" />
        ) : d.values.elements?.length ? (
          <CatalogPreview elements={d.values.elements} background={background} />
        ) : (
          // A classic kit: its two boxes on its background, in its frames and colours.
          <span
            className="flex aspect-video items-center justify-center gap-1 p-2"
            style={{ background: wall ? `url("${wall.thumb}") center / cover` : background }}
          >
            {[0, 1].map((i) => (
              <span
                key={i}
                className="h-3/4 w-2/5"
                style={
                  frame
                    ? { border: "6px solid transparent", borderImage: `url("${frame}") ${d.values.frameStyle?.imageSlice}% fill / 6px stretch` }
                    : {
                        background: d.values.frameStyle?.fill ?? c["--tv-panel"],
                        opacity: d.values.frameStyle?.fillOpacity ? Math.max(0.35, d.values.frameStyle.fillOpacity) : 1,
                        border: `1px solid ${d.values.frameStyle?.line ?? c["--tv-accent"] ?? "transparent"}`,
                        borderRadius: d.values.frame?.shape === "arch" ? "50% 50% 3px 3px / 30% 30% 3px 3px" : 4,
                      }
                }
              />
            ))}
          </span>
        )}
        <span className="block px-2 pt-2 text-sm font-medium leading-snug" data-kit-name>{d.name}</span>
        <span className="block px-2 pb-1 text-[11px] leading-tight text-muted-foreground" data-kit-fills>
          ממלא: {d.parts.map((x) => DESIGN_PART_LABELS[x]).join(" · ")}
        </span>
      </button>
      {children && <div className="flex flex-wrap gap-1 px-1 pb-1" data-kit-actions>{children}</div>}
    </div>
  );
}
