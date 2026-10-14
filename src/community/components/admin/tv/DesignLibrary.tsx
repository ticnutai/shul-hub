import { CatalogPreview } from './CatalogPreview';
import { useSharedCatalog } from '@/tv/sharedCatalog';
import {CATALOG_CATEGORIES,catalogCategory,type CatalogCategory} from '@/tv/catalogCategories';
import { useState, type ReactNode } from "react";
import { Folded, SubPart } from "./Parts";
import { BookmarkPlus, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { confirmAction } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import type { TvConfig } from "@/tv/config";
import { isOccasionKit } from "@/tv/occasionDesign";
import { NameForm, SELECT_CLASS } from "./editorParts";
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
/** A kit made of free parts: put on, its parts are edited one by one in "חלקים חופשיים". */
const ofParts = (d: SavedDesign) => d.values.screenLayout === "composition" || Boolean(d.values.elements?.length);

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
          <p className="text-[11px] text-muted-foreground">
            כשמפעילים את הערכה, רק החלקים המסומנים משתנים בלוח. השאר נשאר כמו שהוא.
            {kept.length > 0 && " בלוח מחלקים, המסגרות והפריסה תמיד נשמרות - בלעדיהן לא יהיה אפשר לערוך את הערכה חלק אחרי חלק."}
          </p>
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
          title={full ? `הגעתם למספר הערכות המרבי (${MAX_DESIGNS})` : 'שומר את מה שעל הלוח עכשיו כערכה משלכם - תופיע ב"הערכות שלי"'}
        >
          <BookmarkPlus className="size-4" aria-hidden /> שמירה כערכה חדשה
        </Button>
      </PopoverTrigger>
      <PopoverContent dir="rtl" align="end" className="w-96 max-w-[calc(100vw-1rem)] space-y-2 p-3 text-right">
        <p className="text-sm font-semibold">שמירה כערכה חדשה</p>
        {open && <KitSaveForm config={config} onEdit={onEdit} onDone={() => setOpen(false)} testId="toolbar-kit-form" />}
      </PopoverContent>
    </Popover>
  );
}

/**
 * "העיצובים שלי": looks the gabbai built and saved - all of it, or only the
 * parts they chose - shown beside the themes, put on the board with a tap.
 * The model and its rules are designs.ts.
 */
export function DesignLibrary({ config, onEdit }: { config: TvConfig; onEdit: Edit }) {
  const [form, setForm] = useState<{ mode: "new" | "rename"; id?: string; name: string } | null>(null);
  const designs = config.designs;
  // An occasion's own kit is edited on its page (its 🎨), not listed among the gabbai's kits.
  const mine = designs.filter((d) => !isOccasionKit(config, d));
  const { catalog, error: catalogError, retry } = useSharedCatalog();
  const [category,setCategory]=useState<CatalogCategory>('הכול');
  const extra=(catalog?.designs??[]).filter(d=>!BUILTIN_DESIGNS.some(b=>b.id===d.id));
  const available=[...BUILTIN_DESIGNS,...extra];
  const groups=[...DESIGN_GROUPS,{id:'shared',title:'האוסף המשותף - לכל הלוחות',hint:'כל ערכה זמינה בכל יום. בוחרים עותק ומשנים אותו בלוח בלבד.',ids:extra.map(d=>d.id)}];

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

  /** A ready kit's tile: put on, copied to one's own, opened part by part. */
  const readyTile = (d: SavedDesign, group: string) => (
          <KitTile
            key={d.id}
            design={d}
            config={config}
            thumb={group === "classic" || group === "shared" || group === "older" ? undefined : `/new-shul-assets/thumbs/${d.id}.webp`}
            onApply={() => onEdit("design-apply", (cfg) => applyDesign(cfg, d))}
            onRemove={() => onEdit("design-hide", (cfg) => hideReady(cfg, "design", d.id))}
            removeReady
          >
            <TileAction
              disabled={designs.length >= MAX_DESIGNS}
              title={designs.length >= MAX_DESIGNS ? `הגעתם למספר הערכות המרבי (${MAX_DESIGNS})` : "עותק שלכם, לשנות ממנו"}
              onClick={() => {
                // A copy of one's own: renamed, changed, updated and deleted like any.
                onEdit("design-copy", (cfg) => ({
                  ...cfg,
                  designs: [...cfg.designs, { ...structuredClone(d), id: newDesignId(), name: `${d.name} (שלי)` }].slice(0, MAX_DESIGNS),
                }));
                toast.success(`נוצר עותק: "${d.name} (שלי)" - ב"הערכות שלי"`);
              }}
            >
              שכפול לעריכה
            </TileAction>
            {ofParts(d) && <TileAction onClick={() => editInParts(d)} title="מלביש את הערכה ופותח את רשימת החלקים - כל חלק נבחר, זז ומשתנה לבד">עריכה בחלקים</TileAction>}
          </KitTile>
  );
  // The kits not built of parts: kept, and offered folded - a board is built of parts now.
  const older = available.filter((d) => !ofParts(d) && !isHiddenReady(config, "design", d.id) && (category === "הכול" || catalogCategory(d) === category));

  return (
    <div className="space-y-5" data-testid="design-library">
      <SubPart
        title="ערכות מוכנות"
        hint={'לחיצה ממלאת את החלקים שכתובים מתחת לערכה - ואחר כך כל חלק משתנה לבד למטה. "שכפול לעריכה" יוצר עותק שלכם.'}
      >
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">נושא הערכות:</span>
        <select aria-label="נושא הערכות" className={SELECT_CLASS} value={category} onChange={(e) => setCategory(e.target.value as CatalogCategory)}>
          {CATALOG_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <p className="text-[11px] text-muted-foreground">הנושא מסנן את הספרייה בלבד ואינו מגביל את יום השימוש. שינוי עותק לא משנה ערכות בלוחות אחרים.</p>
      {catalogError && <CatalogNotice onRetry={retry} />}
      <div className="space-y-4" data-testid="builtin-designs">
      {groups.map((group) => {
        // Kits of parts only: a board is built of parts. The older kits are kept, folded below.
        const shown = available.filter((d) => group.ids.includes(d.id) && ofParts(d) && !isHiddenReady(config, "design", d.id) && (category==='הכול'||catalogCategory(d)===category));
        if (!shown.length) return null;
        return (
      <section key={group.id} data-design-group={group.id} className="space-y-1.5">
        <h4 className="text-sm font-semibold">{group.title}</h4>
        <p className="text-[11px] leading-snug text-muted-foreground">{group.hint}</p>
      <div className={PART_GRID}>
        {shown.map((d) => readyTile(d, group.id))}
      </div>
      </section>
        );
      })}
      {older.length > 0 && (
        <Folded label={`ערכות ישנות, שלא בנויות מחלקים (${older.length})`} testId="older-designs">
          <p className="mb-2 text-[11px] text-muted-foreground">נשמרות לבתי כנסת שכבר משתמשים בהן. לוח חדש בונים מערכה של חלקים, שכל חלק בה משתנה לבד.</p>
          <div className={PART_GRID}>{older.map((d) => readyTile(d, "older"))}</div>
        </Folded>
      )}
      </div>
      <HiddenShelf
        testId="designs-hidden"
        items={available.filter((d) => isHiddenReady(config, "design", d.id)).map((d) => ({ key: d.id, name: d.name }))}
        onRestore={(id) => onEdit("design-show", (cfg) => showReady(cfg, "design", id))}
      />
      </SubPart>
      <SubPart title="הערכות שלי" hint="ערכות ששמרתם: לחיצה מלבישה; אפשר לשנות שם, לעדכן למה שעל הלוח עכשיו, ולמחוק.">
      {mine.length > 0 && (
        <div className={PART_GRID}>
          {mine.map((d) => (
            <KitTile
              key={d.id}
              design={d}
              config={config}
              onApply={() => onEdit("design-apply", (cfg) => applyDesign(cfg, d))}
              onRemove={() => void remove(d)}
            >
              <TileAction onClick={() => update(d)} title="הערכה מקבלת את מה שעל הלוח עכשיו">עדכון</TileAction>
              {ofParts(d) && <TileAction onClick={() => editInParts(d)} title="מלביש את הערכה ופותח את רשימת החלקים - כל חלק נבחר, זז ומשתנה לבד">עריכה בחלקים</TileAction>}
              <TileAction onClick={() => setForm({ mode: "rename", id: d.id, name: d.name })}>שינוי שם</TileAction>
            </KitTile>
          ))}
        </div>
      )}

      {form?.mode === "new" ? (
        <KitSaveForm config={config} onEdit={onEdit} onDone={() => setForm(null)} />
      ) : form ? (
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
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={designs.length >= MAX_DESIGNS}
            onClick={() => setForm({ mode: "new", name: "" })}
          >
            <Plus className="size-4" /> שמירה כערכה חדשה
          </Button>
          <span className="text-xs text-muted-foreground">
            שומר את מה שעל הלוח עכשיו - כולו או רק החלקים שתבחרו.
            {designs.length >= MAX_DESIGNS ? ` הגעתם למספר הערכות המרבי (${MAX_DESIGNS}).` : ""}
          </span>
        </div>
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
        <span className="block px-2 pt-2 text-sm font-medium leading-snug">{d.name}</span>
        <span className="block px-2 pb-1 text-[11px] leading-tight text-muted-foreground">
          ממלא: {d.parts.map((x) => DESIGN_PART_LABELS[x]).join(" · ")}
        </span>
      </button>
      {children && <div className="flex flex-wrap gap-1 px-1 pb-1">{children}</div>}
    </div>
  );
}
