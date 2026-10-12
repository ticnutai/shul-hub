import { CatalogPreview } from './CatalogPreview';
import {loadSharedCatalog,type SharedCatalog} from '@/tv/sharedCatalog';
import {CATALOG_CATEGORIES,catalogCategory,type CatalogCategory} from '@/tv/catalogCategories';
import { useEffect, useState, type ReactNode } from "react";
import { SubPart } from "./Parts";
import { Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TvConfig } from "@/tv/config";
import { findBackdrop } from "@/tv/backdrops";
import { framePictureUrl } from "@/tv/framePictures";
import { hideReady, isHiddenReady, showReady } from "@/tv/readyItems";
import { HiddenShelf, TileRemove } from "./ReadyShelf";
import { BoardElements } from "@/tv/BoardElements";
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
 * "העיצובים שלי": looks the gabbai built and saved - all of it, or only the
 * parts they chose - shown beside the themes, put on the board with a tap.
 * The model and its rules are designs.ts.
 */
export function DesignLibrary({ config, onEdit }: { config: TvConfig; onEdit: Edit }) {
  const [form, setForm] = useState<{ mode: "new" | "rename"; id?: string; name: string; parts: DesignPart[] } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const designs = config.designs;
  const [catalog,setCatalog]=useState<SharedCatalog>();
  const [catalogError,setCatalogError]=useState(false);
  const [attempt,setAttempt]=useState(0);
  const [category,setCategory]=useState<CatalogCategory>('הכול');
  useEffect(()=>{let active=true;setCatalogError(false);loadSharedCatalog(attempt>0).then(c=>{if(active)setCatalog(c);}).catch(()=>{if(active)setCatalogError(true);});return()=>{active=false;};},[attempt]);
  const extra=(catalog?.designs??[]).filter(d=>!BUILTIN_DESIGNS.some(b=>b.id===d.id));
  const available=[...BUILTIN_DESIGNS,...extra];
  const groups=[...DESIGN_GROUPS,{id:'shared',title:'האוסף המשותף - לכל הלוחות',hint:'כל ערכה זמינה בכל יום. בוחרים עותק ומשנים אותו בלוח בלבד.',ids:extra.map(d=>d.id)}];

  const commit = () => {
    if (!form) return;
    const name = form.name.trim().slice(0, 40);
    if (!name) return toast.error("צריך לתת שם לערכה");
    if (form.mode === "new") {
      if (!form.parts.length) return toast.error("צריך לבחור לפחות חלק אחד");
      onEdit("design-new", (c) => ({ ...c, designs: [...c.designs, captureDesign(c, name, form.parts)].slice(0, MAX_DESIGNS) }));
      toast.success(`הערכה "${name}" נשמרה. היא תגיע למסכים ב"שמור ושדר".`);
    } else {
      onEdit("design-rename", (c) => ({ ...c, designs: c.designs.map((d) => (d.id === form.id ? { ...d, name } : d)) }));
    }
    setForm(null);
  };

  const update = (d: SavedDesign) => {
    onEdit("design-update", (c) => ({
      ...c,
      designs: c.designs.map((x) => (x.id === d.id ? captureDesign(c, x.name, x.parts, x.id) : x)),
    }));
    toast.success(`הערכה "${d.name}" עודכנה למה שעל הלוח עכשיו.`);
  };

  return (
    <div className="space-y-5" data-testid="design-library">
      <SubPart
        title="ערכות מוכנות"
        hint={'לחיצה ממלאת את החלקים שכתובים מתחת לערכה - ואחר כך כל חלק משתנה לבד למטה. "שכפול לעריכה" יוצר עותק שלכם.'}
      >
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">נושא הערכות:</span>
        <select aria-label="נושא הערכות" className="h-8 rounded-md border bg-background px-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value as CatalogCategory)}>
          {CATALOG_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <p className="text-[11px] text-muted-foreground">הנושא מסנן את הספרייה בלבד ואינו מגביל את יום השימוש. שינוי עותק לא משנה ערכות בלוחות אחרים.</p>
      {catalogError && (
        <p role="alert" className="text-sm">
          לא ניתן לטעון את האוסף המשותף. הלוח והערכות הקיימות לא השתנו.{" "}
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setAttempt((n) => n + 1)}>ניסיון נוסף</Button>
        </p>
      )}
      <div className="space-y-4" data-testid="builtin-designs">
      {groups.map((group) => {
        const shown = available.filter((d) => group.ids.includes(d.id) && !isHiddenReady(config, "design", d.id) && (category==='הכול'||catalogCategory(d)===category));
        if (!shown.length) return null;
        return (
      <section key={group.id} data-design-group={group.id} className="space-y-1.5">
        <h4 className="text-sm font-semibold">{group.title}</h4>
        <p className="text-[11px] leading-snug text-muted-foreground">{group.hint}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {shown.map((d) => (
          <KitTile
            key={d.id}
            design={d}
            config={config}
            thumb={group.id === "classic" || group.id === "shared" ? undefined : `/new-shul-assets/thumbs/${d.id}.webp`}
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
          </KitTile>
        ))}
      </div>
      </section>
        );
      })}
      </div>
      <HiddenShelf
        testId="designs-hidden"
        items={available.filter((d) => isHiddenReady(config, "design", d.id)).map((d) => ({ key: d.id, name: d.name }))}
        onRestore={(id) => onEdit("design-show", (cfg) => showReady(cfg, "design", id))}
      />
      </SubPart>
      <SubPart title="הערכות שלי" hint="ערכות ששמרתם: לחיצה מלבישה; אפשר לשנות שם, לעדכן למה שעל הלוח עכשיו, ולמחוק.">
      {designs.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {designs.map((d) => (
              <KitTile
                key={d.id}
                design={d}
                config={config}
                onApply={() => onEdit("design-apply", (cfg) => applyDesign(cfg, d))}
                onRemove={() => setConfirmDelete(d.id)}
              >
                {confirmDelete === d.id ? (
                  <>
                    <TileAction
                      destructive
                      onClick={() => {
                        setConfirmDelete(null);
                        onEdit("design-delete", (cfg) => ({ ...cfg, designs: cfg.designs.filter((x) => x.id !== d.id) }));
                      }}
                    >
                      למחוק?
                    </TileAction>
                    <TileAction onClick={() => setConfirmDelete(null)}>ביטול</TileAction>
                  </>
                ) : (
                  <>
                    <TileAction onClick={() => update(d)} title="הערכה מקבלת את מה שעל הלוח עכשיו">עדכון</TileAction>
                    <TileAction onClick={() => setForm({ mode: "rename", id: d.id, name: d.name, parts: d.parts })}>שינוי שם</TileAction>
                  </>
                )}
              </KitTile>
            ))}
          </div>
        </>
      )}

      {form ? (
        <form
          className="space-y-2 rounded-lg border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            commit();
          }}
        >
          <Input
            autoFocus
            aria-label="שם הערכה"
            value={form.name}
            maxLength={40}
            placeholder="שם לערכה, למשל: חגים"
            className="h-9"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          {form.mode === "new" && (
            <fieldset className="space-y-1">
              <legend className="text-xs font-medium">מה הערכה כוללת</legend>
              <div className="flex flex-wrap gap-3">
                {DESIGN_PARTS.map((p) => (
                  <label key={p} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={form.parts.includes(p)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          parts: e.target.checked ? [...form.parts, p] : form.parts.filter((x) => x !== p),
                        })
                      }
                    />
                    {DESIGN_PART_LABELS[p]}
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                כשמפעילים את הערכה, רק החלקים המסומנים משתנים בלוח. השאר נשאר כמו שהוא.
              </p>
            </fieldset>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              <Save className="size-4" /> {form.mode === "new" ? "שמירת הערכה" : "שינוי השם"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setForm(null)}>
              ביטול
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={designs.length >= MAX_DESIGNS}
            // A board of parts is saved whole: its layout is what makes it one - without it, the kit came back as an ordinary board.
            onClick={() => setForm({ mode: "new", name: "", parts: config.screenLayout === "composition" ? [...DESIGN_PARTS] : ["background", "frames", "text"] })}
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
function TileAction({ children, onClick, disabled, destructive, title }: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  title?: string;
}) {
  return (
    <Button
      type="button"
      variant={destructive ? "destructive" : "ghost"}
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
