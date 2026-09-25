import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, Copy, ImagePlus, Plus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@community/integrations/supabase/client";
import { communityId } from "@/community/lib/community";
import { uploadTvImage, useTvConfig } from "@community/components/admin/tv/tvAdminData";
import { DefaultArt, EventSplash } from "@/tv/EventSplash";
import { MAX_EVENT_IMAGES, STYLE_NAMES, eventSlides, stylesFor } from "@/tv/eventSlides";
import { zmanimFor } from "@community/lib/minyan-time";
import { useSettings } from "@community/lib/data";
import "@/tv/tv.css";
import type { Minyan, MinyanCategory } from "@community/lib/data";
import {
  GROUP_LABELS,
  SPECIAL_DAYS,
  eventSystemKey,
  isEventCategory,
  nextDatesAll,
  type SpecialDayDef,
  type SpecialGroup,
} from "@community/lib/specialDays";

/**
 * "מועדים ואירועים": the special days of the Jewish year, each of which can
 * have a timetable of its own. Switching one on creates its minyan tab
 * (system_key "event:<key>"); on the day that tab replaces ימות החול / שבת on
 * the website and the board, every year again - the dates come from the
 * calendar, never from here.
 */

const GROUP_ORDER: SpecialGroup[] = ["noraim", "sukkot", "chanukah_purim", "pesach_shavuot", "fasts", "shabbatot", "other", "national"];

function formatDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!, 12);
  return new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
}

function whenText(key: string, now: Date, soon = false): string {
  const n = daysUntil(key, now);
  if (n === 0) return "היום";
  if (n === 1) return "מחר";
  return soon ? `עוד ${n} ימים` : `בעוד ${n} ימים`;
}

function daysUntil(key: string, now: Date): number {
  const [y, m, d] = key.split("-").map(Number);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((new Date(y!, m! - 1, d!).getTime() - today.getTime()) / 86_400_000);
}

export function SpecialDaysAdmin({
  categories,
  minyanim,
  onOpen,
}: {
  categories: MinyanCategory[];
  minyanim: Minyan[];
  onOpen: (categoryId: string) => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const tv = useTvConfig();
  const { data: settings } = useSettings();
  const [preview, setPreview] = useState<SpecialDayDef | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!preview) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [preview]);
  const tvConfig = tv.data?.config;

  // The picture lives in the board's config. Read it fresh before writing, so
  // a change made elsewhere in the meantime is not written over.
  const saveBoard = async (patch: (c: NonNullable<typeof tvConfig>) => NonNullable<typeof tvConfig>) => {
    const fresh = (await tv.refetch()).data?.config;
    if (!fresh) {
      toast.error("הגדרות הלוח לא נטענו");
      return false;
    }
    try {
      await tv.save.mutateAsync(patch(fresh));
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "השמירה נכשלה");
      return false;
    }
  };

  /** Adds pictures (several at once), up to 8 a day; they take turns on the board. */
  const addImages = async (def: SpecialDayDef, files: File[]) => {
    const room = MAX_EVENT_IMAGES - (tvConfig?.eventImages[def.key]?.length ?? 0);
    if (room <= 0) {
      toast.error(`אפשר עד ${MAX_EVENT_IMAGES} תמונות למועד`);
      return;
    }
    setBusy(`img:${def.key}`);
    try {
      const urls: string[] = [];
      for (const f of files.slice(0, room)) urls.push((await uploadTvImage(f)).url);
      const ok = await saveBoard((c) => ({
        ...c,
        eventImages: { ...c.eventImages, [def.key]: [...(c.eventImages[def.key] ?? []), ...urls].slice(0, MAX_EVENT_IMAGES) },
      }));
      if (ok) toast.success(`${urls.length === 1 ? "התמונה נוספה" : `נוספו ${urls.length} תמונות`} ל${def.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "העלאת התמונה נכשלה");
    } finally {
      setBusy(null);
    }
  };

  /** Removes one picture, or all of them (back to the built-in designs). */
  const removeImage = async (def: SpecialDayDef, url: string | null) => {
    setBusy(`img:${def.key}`);
    const ok = await saveBoard((c) => {
      const eventImages = { ...c.eventImages };
      const left = url ? (eventImages[def.key] ?? []).filter((u) => u !== url) : [];
      if (left.length) eventImages[def.key] = left;
      else delete eventImages[def.key];
      return { ...c, eventImages };
    });
    setBusy(null);
    if (ok && !url) toast.success(`${def.name}: חזרה לעיצובים המובנים`);
  };

  /** The built-in styles that take turns on the day now. */
  const shownStyles = (def: SpecialDayDef) =>
    eventSlides(tvConfig?.eventImages[def.key], stylesFor(def), tvConfig?.eventStyles[def.key]).flatMap((s) =>
      "variant" in s ? [s.variant] : [],
    );

  /** Puts a built-in style in the day's rotation, or takes it out. */
  const toggleStyle = async (def: SpecialDayDef, v: number) => {
    const current = shownStyles(def);
    const hasImages = (tvConfig?.eventImages[def.key]?.length ?? 0) > 0;
    const next = stylesFor(def).filter((s) => (s === v ? !current.includes(v) : current.includes(s)));
    if (!next.length && !hasImages) {
      toast.error("צריך לפחות סגנון אחד או תמונה");
      return;
    }
    setBusy(`style:${def.key}`);
    await saveBoard((c) => ({ ...c, eventStyles: { ...c.eventStyles, [def.key]: next } }));
    setBusy(null);
  };
  const now = useMemo(() => new Date(), []);
  const next = useMemo(() => nextDatesAll(now), [now]);
  const upcoming = useMemo(
    () =>
      SPECIAL_DAYS.filter((d) => !d.national && next[d.key])
        .sort((a, b) => (next[a.key]! < next[b.key]! ? -1 : 1))
        .slice(0, 6),
    [next],
  );
  const own = (def: SpecialDayDef) => categories.find((c) => c.system_key === eventSystemKey(def.key));
  const ordinary = categories.filter((c) => !isEventCategory(c));

  const refresh = () => qc.invalidateQueries({ queryKey: ["minyan_categories"] });

  const create = async (def: SpecialDayDef) => {
    setBusy(def.key);
    const { data, error } = await supabase
      .from("minyan_categories")
      .insert({
        community_id: communityId(),
        name: def.name,
        system_key: eventSystemKey(def.key),
        active: true,
        display_mode: "tabs",
        sort_order: 500 + SPECIAL_DAYS.indexOf(def),
      } as never)
      .select("id")
      .single();
    setBusy(null);
    if (error || !data) {
      toast.error(error?.message ?? "היצירה נכשלה");
      return;
    }
    await refresh();
    toast.success(`נוצר: ${def.name}. עכשיו מוסיפים לו מניינים.`);
    onOpen((data as { id: string }).id);
  };

  const setActive = async (cat: MinyanCategory, active: boolean) => {
    setBusy(cat.id);
    const { error } = await supabase
      .from("minyan_categories")
      .update({ active } as never)
      .eq("id", cat.id)
      .eq("community_id", communityId());
    setBusy(null);
    if (error) toast.error(error.message);
    else await refresh();
  };

  const copyFrom = async (target: MinyanCategory, sourceId: string) => {
    const rows = minyanim.filter((m) => m.category_id === sourceId);
    if (rows.length === 0) {
      toast.error("אין מניינים בטאב הזה");
      return;
    }
    setBusy(target.id);
    const copies = rows.map(({ id: _id, created_at: _c, updated_at: _u, ...m }) => ({
      ...m,
      community_id: communityId(),
      category_id: target.id,
      day_type: "custom",
    }));
    const { error } = await supabase
      .from("minyanim")
      .insert(copies.map((c) => ({ ...c, community_id: communityId() })) as never);
    setBusy(null);
    if (error) toast.error(error.message);
    else {
      await qc.invalidateQueries({ queryKey: ["minyanim"] });
      toast.success(`הועתקו ${copies.length} מניינים ל${target.name}`);
    }
  };

  const card = (def: SpecialDayDef) => {
    const cat = own(def);
    const count = cat ? minyanim.filter((m) => m.category_id === cat.id).length : 0;
    const date = next[def.key];
    return (
      <div key={def.key} className={`rounded-lg border p-3 ${cat?.active ? "border-primary/50 bg-primary/5" : ""}`} data-testid={`special-${def.key}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold">{def.name}</div>
            <div className="text-xs text-muted-foreground">
              {date ? `${formatDay(date)} · ${whenText(date, now)}` : "—"}
            </div>
          </div>
          {cat && (
            <Switch
              checked={cat.active}
              disabled={busy === cat.id}
              onCheckedChange={(v) => void setActive(cat, v)}
              aria-label={`${def.name} פעיל`}
            />
          )}
        </div>
        {!def.national && (
          <div className="mt-2 space-y-1.5">
            {(tvConfig?.eventImages[def.key]?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5" data-testid={`images-${def.key}`}>
                {tvConfig!.eventImages[def.key]!.map((url, i) => (
                  <div key={url} className="relative h-12 w-20 overflow-hidden rounded border">
                    <img src={url} alt={`תמונה ${i + 1} של ${def.name}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      aria-label={`הסרת תמונה ${i + 1}`}
                      disabled={busy === `img:${def.key}`}
                      onClick={() => void removeImage(def, url)}
                      className="absolute left-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* The built-in styles: one tap puts a style in the rotation or takes it out. */}
            <div className="flex flex-wrap gap-1.5" data-testid={`styles-${def.key}`}>
              {stylesFor(def).map((v) => {
                const on = shownStyles(def).includes(v);
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={on}
                    title={on ? `${STYLE_NAMES[v]} - מוצג (לחיצה להסרה)` : `${STYLE_NAMES[v]} - לחיצה להוספה`}
                    disabled={busy === `style:${def.key}`}
                    onClick={() => void toggleStyle(def, v)}
                    className={`relative h-12 w-20 overflow-hidden rounded border-2 transition ${on ? "border-primary" : "border-transparent opacity-40 grayscale"}`}
                  >
                    <DefaultArt def={def} variant={v} />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-0.5 text-[9px] leading-tight text-white">
                      {STYLE_NAMES[v]}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-primary underline">
                <ImagePlus className="size-3.5" />
                {busy === `img:${def.key}` ? "מעלה…" : "הוספת תמונות"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  data-testid={`add-images-${def.key}`}
                  disabled={busy === `img:${def.key}`}
                  onChange={(e) => {
                    const files = [...(e.target.files ?? [])];
                    if (files.length) void addImages(def, files);
                    e.target.value = "";
                  }}
                />
              </label>
              <button type="button" className="text-xs underline" onClick={() => setPreview(def)} data-testid={`preview-${def.key}`}>
                תצוגה בלוח
              </button>
              {(tvConfig?.eventImages[def.key]?.length ?? 0) > 0 && (
                <button type="button" className="inline-flex items-center gap-1 text-xs underline" onClick={() => void removeImage(def, null)}>
                  <RotateCcw className="size-3.5" /> הסרת כל התמונות
                </button>
              )}
            </div>
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {cat ? (
            <>
              <Button size="sm" variant="outline" onClick={() => onOpen(cat.id)}>
                מניינים ({count}) <ChevronLeft className="size-4" />
              </Button>
              {count === 0 && ordinary.length > 0 && (
                <label className="flex items-center gap-1 text-xs">
                  <Copy className="size-3.5" />
                  <select
                    aria-label={`העתקת מניינים ל${def.name}`}
                    value=""
                    disabled={busy === cat.id}
                    onChange={(e) => e.target.value && void copyFrom(cat, e.target.value)}
                    className="h-8 rounded-md border bg-background px-1 text-xs"
                  >
                    <option value="">העתקה מ…</option>
                    {ordinary.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          ) : (
            <Button size="sm" variant="ghost" disabled={busy === def.key} onClick={() => void create(def)}>
              <Plus className="size-4" /> הגדרת זמנים
            </Button>
          )}
        </div>
      </div>
    );
  };

  const previewDate = preview ? next[preview.key] : null;
  // The day's date, with a clock that runs - so the pictures take turns in the preview too.
  const previewNow = previewDate ? new Date(Date.parse(`${previewDate}T09:00:00Z`) + tick * 1000) : now;

  return (
    <div className="space-y-5" dir="rtl">
      {preview && tvConfig && (
        <div
          className="fixed inset-0 z-[80] cursor-pointer bg-black"
          role="dialog"
          aria-label={`תצוגה בלוח: ${preview.name}`}
          onClick={() => setPreview(null)}
          data-testid="splash-preview"
        >
          <div className="tv-root absolute inset-0" dir="rtl">
            <EventSplash
              categories={categories}
              config={tvConfig}
              now={previewNow}
              zmanim={zmanimFor(previewNow, settings)}
              force
              day={preview}
            />
          </div>
          <div className="absolute left-3 top-3 rounded bg-white/90 px-3 py-1 text-sm text-black">לחיצה לסגירה</div>
        </div>
      )}
      <div className="card-elev space-y-2 p-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-5 text-primary" />
          <h3 className="text-lg font-semibold">מועדים ואירועים</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          לכל מועד אפשר להגדיר זמני תפילות משלו. ביום עצמו הם מחליפים באתר ובלוח את זמני ימות החול או השבת, וזמני
          המועד (תחילת הצום וסופו, הדלקת נרות, צאת החג) מוצגים לצד זמני היום. התאריכים מחושבים לבד מהלוח העברי, כך
          שמה שמגדירים השנה חוזר בשנה הבאה.
        </p>
        {tvConfig && (
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={tvConfig.eventSplash}
              onCheckedChange={(v) => void saveBoard((c) => ({ ...c, eventSplash: v }))}
              aria-label="הצגת תמונת המועד בלוח"
            />
            ביום המועד הלוח מציג כל דקה וחצי, ל-15 שניות, את תמונת המועד וזמניו
          </label>
        )}
        {upcoming.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="text-xs font-medium">בקרוב:</span>
            {upcoming.map((d) => (
              <span key={d.key} className={`rounded-full px-2 py-0.5 text-xs ${own(d)?.active ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {d.name} · {whenText(next[d.key]!, now, true)}
              </span>
            ))}
          </div>
        )}
      </div>

      {GROUP_ORDER.map((group) => {
        const defs = SPECIAL_DAYS.filter((d) => d.group === group);
        const body = <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{defs.map(card)}</div>;
        if (group === "national") {
          return (
            <details key={group} className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">{GROUP_LABELS[group]}</summary>
              <p className="my-2 text-xs text-muted-foreground">אפשר להכין כאן זמנים; בינתיים הם לא מוצגים באתר ובלוח.</p>
              {body}
            </details>
          );
        }
        return (
          <section key={group} className="space-y-2">
            <h4 className="font-semibold">{GROUP_LABELS[group]}</h4>
            {body}
          </section>
        );
      })}
    </div>
  );
}
