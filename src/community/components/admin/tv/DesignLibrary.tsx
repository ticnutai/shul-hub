import { useState } from "react";
import { Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TvConfig } from "@/tv/config";
import { findBackdrop } from "@/tv/backdrops";
import { framePictureUrl } from "@/tv/framePictures";
import { hideReady, isHiddenReady, showReady } from "@/tv/readyItems";
import { HiddenShelf, TileRemove } from "./ReadyShelf";
import {
  BUILTIN_DESIGNS,
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

  const commit = () => {
    if (!form) return;
    const name = form.name.trim().slice(0, 40);
    if (!name) return toast.error("צריך לתת שם לעיצוב");
    if (form.mode === "new") {
      if (!form.parts.length) return toast.error("צריך לבחור לפחות חלק אחד");
      onEdit("design-new", (c) => ({ ...c, designs: [...c.designs, captureDesign(c, name, form.parts)].slice(0, MAX_DESIGNS) }));
      toast.success(`העיצוב "${name}" נשמר. הוא יגיע למסכים ב"שמור ושדר".`);
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
    toast.success(`העיצוב "${d.name}" עודכן למה שעל הלוח עכשיו.`);
  };

  return (
    <div className="space-y-2" data-testid="design-library">
      <div className="text-sm font-medium">עיצובים מוכנים</div>
      <p className="text-[11px] leading-tight text-muted-foreground">
        לחיצה ממלאת את החלקים שכתובים מתחת לעיצוב - ואחר כך כל חלק משתנה לבד למטה. "שכפול לעריכה" יוצר עותק שלכם.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="builtin-designs">
        {BUILTIN_DESIGNS.filter((d) => !isHiddenReady(config, "design", d.id)).map((d) => {
          const wall = findBackdrop(d.values.backgroundImage ?? null);
          const frame = framePictureUrl(d.values.frameStyle?.image ?? null);
          return (
            <div key={d.id} className="group relative overflow-hidden rounded-lg border text-right">
            <TileRemove name={d.name} ready onClick={() => onEdit("design-hide", (cfg) => hideReady(cfg, "design", d.id))} />
            <button
              type="button"
              onClick={() => onEdit("design-apply", (cfg) => applyDesign(cfg, d))}
              className="block w-full text-right hover:bg-muted/40"
              title="ממלא את החלקים שכתובים מתחתיו - וכל חלק ניתן אחר כך לשינוי בנפרד"
            >
              <span
                className="flex aspect-video items-center justify-center gap-1 p-2"
                style={{ background: wall ? `url("${wall.thumb}") center / cover` : undefined }}
              >
                {[0, 1].map((i) => (
                  <span
                    key={i}
                    className="h-3/4 w-2/5"
                    style={
                      frame
                        ? { border: "6px solid transparent", borderImage: `url("${frame}") ${d.values.frameStyle?.imageSlice}% fill / 6px stretch` }
                        : {
                            background: d.values.frameStyle?.fill ?? undefined,
                            opacity: d.values.frameStyle?.fillOpacity ? Math.max(0.35, d.values.frameStyle.fillOpacity) : 1,
                            border: `1px solid ${d.values.frameStyle?.line ?? "transparent"}`,
                            borderRadius: d.values.frame?.shape === "arch" ? "50% 50% 3px 3px / 30% 30% 3px 3px" : 4,
                          }
                    }
                  />
                ))}
              </span>
              <span className="block px-2 pt-2 text-sm font-medium">{d.name}</span>
              <span className="block px-2 pb-1 text-[11px] leading-tight text-muted-foreground">
                ממלא: {d.parts.map((x) => DESIGN_PART_LABELS[x]).join(" · ")}
              </span>
            </button>
            <button
              type="button"
              className="mx-2 mb-2 text-[11px] text-primary underline"
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
            </button>
            </div>
          );
        })}
      </div>
      <HiddenShelf
        testId="designs-hidden"
        items={BUILTIN_DESIGNS.filter((d) => isHiddenReady(config, "design", d.id)).map((d) => ({ key: d.id, name: d.name }))}
        onRestore={(id) => onEdit("design-show", (cfg) => showReady(cfg, "design", id))}
      />
      {designs.length > 0 && (
        <>
          <div className="text-sm font-medium">הערכות שלי</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {designs.map((d) => {
              const c = { ...coloursOnScreen(config), ...d.colours };
              return (
                <div key={d.id} className="overflow-hidden rounded-lg border text-right">
                  <button
                    type="button"
                    onClick={() => onEdit("design-apply", (cfg) => applyDesign(cfg, d))}
                    className="block w-full text-right hover:bg-muted/50"
                    title="לחיצה שמה את העיצוב על הלוח (אפשר לבטל ב-Ctrl+Z)"
                  >
                    <div
                      className="flex h-12 items-end gap-1 p-2"
                      style={{
                        background:
                          d.values.backgroundGradient ??
                          `radial-gradient(ellipse at 20% 0%, ${c["--tv-bg-b"]}, transparent 70%), ${c["--tv-bg-a"]}`,
                      }}
                    >
                      <span className="size-4 rounded-full" style={{ background: c["--tv-accent"] }} />
                      <span className="size-4 rounded-full" style={{ background: c["--tv-text"] }} />
                      <span className="size-4 rounded-full" style={{ background: d.values.frameStyle?.fill ?? c["--tv-panel"] }} />
                    </div>
                    <div className="p-2 pb-1">
                      <div className="text-sm font-medium">{d.name}</div>
                      <div className="text-[11px] leading-tight text-muted-foreground">
                        {d.parts.map((p) => DESIGN_PART_LABELS[p]).join(" · ")}
                      </div>
                    </div>
                  </button>
                  <div className="flex flex-wrap gap-1 px-1 pb-1">
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[11px]" onClick={() => update(d)}>
                      עדכון
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-[11px]"
                      onClick={() => setForm({ mode: "rename", id: d.id, name: d.name, parts: d.parts })}
                    >
                      שינוי שם
                    </Button>
                    {confirmDelete === d.id ? (
                      <>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="h-6 px-1.5 text-[11px]"
                          onClick={() => {
                            setConfirmDelete(null);
                            onEdit("design-delete", (cfg) => ({ ...cfg, designs: cfg.designs.filter((x) => x.id !== d.id) }));
                          }}
                        >
                          למחוק?
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[11px]" onClick={() => setConfirmDelete(null)}>
                          ביטול
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-[11px] text-destructive"
                        onClick={() => setConfirmDelete(d.id)}
                      >
                        מחיקה
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
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
            placeholder="שם לעיצוב, למשל: חגים"
            className="h-9"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          {form.mode === "new" && (
            <fieldset className="space-y-1">
              <legend className="text-xs font-medium">מה העיצוב כולל</legend>
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
                כשמפעילים את העיצוב, רק החלקים המסומנים משתנים בלוח. השאר נשאר כמו שהוא.
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
            onClick={() => setForm({ mode: "new", name: "", parts: ["background", "frames", "text"] })}
          >
            <Plus className="size-4" /> שמירה כערכה חדשה
          </Button>
          <span className="text-xs text-muted-foreground">
            שומר את מה שעל הלוח עכשיו - כולו או רק החלקים שתבחרו.
            {designs.length >= MAX_DESIGNS ? ` הגעתם למספר העיצובים המרבי (${MAX_DESIGNS}).` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
