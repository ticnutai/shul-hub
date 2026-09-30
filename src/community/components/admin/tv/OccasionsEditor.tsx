import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, ImagePlus, Plus, Settings2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { specialDayByKey } from "@community/lib/specialDays";
import { BLOCK_BY_ID } from "@/tv/blocks";
import type { TvConfig } from "@/tv/config";
import { BUILTIN_DESIGNS } from "@/tv/designs";
import { STYLE_NAMES, PHOTO_STYLES, stylesFor } from "@/tv/eventSlides";
import {
  CARD_ELEMENTS,
  CARD_ELEMENT_LABELS,
  HEBREW_MONTHS,
  MAX_OCCASION_PICTURES,
  OCCASION_BLOCKS,
  SHABBAT_ID,
  describeWhen,
  newOccasionId,
  nextDateOf,
  readOccasions,
  type Occasion,
  type OccasionItem,
} from "@/tv/occasions";
import { SHABBAT_ART } from "@/tv/shabbat";
import { uploadImages } from "./uploadImages";

type Edit = (key: string, update: (c: TvConfig) => TvConfig) => void;

const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const DISPLAY_LABELS: Record<Occasion["display"], { name: string; note: string }> = {
  hold: { name: "מחליף את הלוח", note: "כל עוד המועד נמשך, רק המסך שלו מוצג" },
  turns: { name: "מתחלף עם הלוח", note: "מסך המועד ומסכי הלוח הרגילים לפי התור" },
  off: { name: "בלי מסך משלו", note: "רק פס בתחתית, אם סימנתם אותו למטה" },
};

const OVERLAP_LABELS: Record<Occasion["overlap"], { name: string; note: string }> = {
  only: { name: "רק המועד הזה", note: "המועד השני לא מוצג" },
  together: { name: "שניהם במסך אחד", note: "למשל \"שבת · חנוכה\", עם הזמנים של שניהם" },
  separate: { name: "כל אחד במסך משלו", note: "המסכים מתחלפים, הגבוה ברשימה ראשון" },
};

/** The picture a stored value stands for, and its name, for the dialog. */
function pictureInfo(p: string): { label: string; thumb?: string } {
  if (p.startsWith("art:")) return { label: SHABBAT_ART.find((a) => `art:${a.id}` === p)?.label ?? "ציור שבת" };
  if (p.startsWith("style:")) {
    const n = Number(p.slice(6));
    return { label: STYLE_NAMES[n] ?? "עיצוב מובנה", thumb: PHOTO_STYLES[n]?.src };
  }
  return { label: "תמונה שהעליתם", thumb: p };
}

const DAY_MS = 86_400_000;

/**
 * "מועדים": Shabbat, the festivals and the shul's own days, in one list whose
 * order is their importance. Each opens a dialog with everything about it
 * (occasions.ts). The first change saves the whole list, read until then
 * from the board's older settings, so nothing on the wall moves by itself.
 */
export function OccasionsEditor({
  config,
  onEdit,
  onPreview,
}: {
  config: TvConfig;
  onEdit: Edit;
  /** Show the preview at this moment (null: back to now). */
  onPreview: (at: Date | null) => void;
}) {
  const list = useMemo(() => readOccasions(config), [config]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [onlyOn, setOnlyOn] = useState(false);
  const today = useMemo(() => new Date(), []);
  const next = useMemo(() => {
    const cache = new Map();
    return Object.fromEntries(list.map((o) => [o.id, nextDateOf(o, today, cache)]));
  }, [list, today]);

  /** Every change writes the whole list, materialised from whatever the board had. */
  const change = (key: string, update: (list: Occasion[]) => Occasion[]) =>
    onEdit(`occasions:${key}`, (c) => ({ ...c, occasions: update(readOccasions(c)) }));
  const patch = (id: string, p: Partial<Occasion>) =>
    change(`${id}:${Object.keys(p).join(",")}`, (l) => l.map((o) => (o.id === id ? { ...o, ...p } : o)));
  const move = (id: string, by: number) =>
    change(`move:${id}`, (l) => {
      const i = l.findIndex((o) => o.id === id);
      const j = i + by;
      if (i < 0 || j < 0 || j >= l.length) return l;
      const out = [...l];
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });
  const add = () => {
    const id = newOccasionId();
    const shabbat = list.find((o) => o.id === SHABBAT_ID)!;
    change("add", (l) => [
      ...l,
      {
        ...shabbat,
        id,
        name: "מועד חדש",
        title: null,
        when: { type: "hebrew", month: 7, day: 1 },
        window: "day",
        display: "turns",
        banner: false,
        overlap: "together",
        elements: ["title", "date", "items", "pictures"],
        blocks: [],
        items: [],
        pictures: ["style:0"],
        pictureSeconds: 30,
        design: null,
      },
    ]);
    setOpenId(id);
  };

  /** A moment in the occasion's next day that shows it: Shabbat morning, or midday. */
  const preview = (o: Occasion) => {
    const d = next[o.id];
    if (!d) return toast.error("לא נמצא תאריך קרוב למועד הזה");
    onPreview(new Date(Date.parse(`${d.toISOString().slice(0, 10)}T11:00:00+03:00`)));
    if (!o.enabled) toast.warning(`"${o.name}" כבוי - הוא לא יופיע עד שתפעילו אותו.`);
  };

  const q = filter.trim();
  const shown = list.filter((o) => (!onlyOn || o.enabled) && (!q || o.name.includes(q)));
  const open = list.find((o) => o.id === openId) ?? null;

  return (
    <div className="space-y-3" data-testid="occasions">
      <p className="text-xs text-muted-foreground">
        שבת, החגים וימים משלכם - מערכת אחת. מועד פעיל מופיע לבד כשהיום שלו מגיע. הסדר ברשימה הוא סדר החשיבות: כששני
        מועדים חלים יחד, ההגדרה של הגבוה מביניהם קובעת אם יוצג רק הוא, שניהם במסך אחד או כל אחד במסך משלו.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={add}>
          <Plus className="size-4" /> הוספת מועד משלכם
        </Button>
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="חיפוש מועד"
          aria-label="חיפוש מועד"
          className="h-8 w-40"
        />
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={onlyOn} onChange={(e) => setOnlyOn(e.target.checked)} /> רק פעילים
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          תצוגה לתאריך:
          <input
            type="date"
            aria-label="תצוגה לתאריך"
            className="h-8 rounded-md border bg-background px-1 text-xs"
            onChange={(e) =>
              onPreview(e.target.value ? new Date(Date.parse(`${e.target.value}T11:00:00+03:00`)) : null)
            }
          />
        </label>
      </div>

      <ol className="divide-y rounded-lg border">
        {shown.map((o) => {
          const i = list.indexOf(o);
          const d = next[o.id];
          const inDays = d ? Math.round((d.getTime() - today.getTime()) / DAY_MS) : null;
          return (
            <li key={o.id} className="flex items-center gap-2 px-2 py-1.5" data-occasion={o.id}>
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label={`${o.name} למעלה`}
                  disabled={i === 0}
                  onClick={() => move(o.id, -1)}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`${o.name} למטה`}
                  disabled={i === list.length - 1}
                  onClick={() => move(o.id, 1)}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowDown className="size-3.5" />
                </button>
              </div>
              <span className="w-6 text-center text-[11px] text-muted-foreground">{i + 1}</span>
              <Switch checked={o.enabled} onCheckedChange={(on) => patch(o.id, { enabled: on })} aria-label={`${o.name} פעיל`} />
              <button type="button" className="min-w-0 flex-1 text-right" onClick={() => setOpenId(o.id)}>
                <div className={`truncate text-sm font-medium${o.enabled ? "" : " text-muted-foreground"}`}>{o.name}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {describeWhen(o)}
                  {inDays !== null && ` · ${inDays === 0 ? "היום" : inDays === 1 ? "מחר" : `בעוד ${inDays} ימים`}`}
                  {o.enabled && ` · ${DISPLAY_LABELS[o.display].name}`}
                  {o.design && " · עם עיצוב"}
                </div>
              </button>
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => preview(o)} title="תצוגה בתאריך הקרוב">
                <Eye className="size-4" />
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={() => setOpenId(o.id)}>
                <Settings2 className="size-4" /> הגדרות
              </Button>
            </li>
          );
        })}
      </ol>

      {open && (
        <OccasionDialog
          occasion={open}
          config={config}
          onClose={() => setOpenId(null)}
          onPatch={(p) => patch(open.id, p)}
          onDelete={() => {
            change(`delete:${open.id}`, (l) => l.filter((o) => o.id !== open.id));
            setOpenId(null);
          }}
          onPreview={() => preview(open)}
        />
      )}
    </div>
  );
}

function OccasionDialog({
  occasion: o,
  config,
  onClose,
  onPatch,
  onDelete,
  onPreview,
}: {
  occasion: Occasion;
  config: TvConfig;
  onClose: () => void;
  onPatch: (p: Partial<Occasion>) => void;
  onDelete: () => void;
  onPreview: () => void;
}) {
  const own = !o.id.startsWith("cal:") && o.id !== SHABBAT_ID;
  const def = o.when.type === "calendar" ? specialDayByKey(o.when.key) : null;
  const [busy, setBusy] = useState(false);
  const toggle = <T,>(list: T[], v: T, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));

  // The built-in pictures this occasion can have: its day's designs, and Shabbat's drawings.
  const builtins = [
    ...(def ? stylesFor(def) : [0, 1, 2]).map((n) => `style:${n}`),
    ...(o.id === SHABBAT_ID || own ? SHABBAT_ART.map((a) => `art:${a.id}`) : []),
  ];
  const setItem = (id: string, p: Partial<OccasionItem>) =>
    onPatch({ items: o.items.map((i) => (i.id === id ? { ...i, ...p } : i)) });

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const urls = await uploadImages(files);
      onPatch({ pictures: [...o.pictures, ...urls].slice(0, MAX_OCCASION_PICTURES) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "העלאת התמונה נכשלה");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="occasion-dialog">
        <DialogHeader>
          <DialogTitle>{o.name}</DialogTitle>
          <DialogDescription>{describeWhen(o)}. כל שינוי נשמר בטיוטה ומגיע למסכים ב"שמור ושדר".</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          <label className="flex items-center gap-3">
            <Switch checked={o.enabled} onCheckedChange={(on) => onPatch({ enabled: on })} aria-label="המועד פעיל" />
            <span>
              <b>פעיל</b> - מופיע לבד כשהיום שלו מגיע
            </span>
          </label>

          <section className="space-y-2">
            <h3 className="font-medium">שם</h3>
            {own && (
              <Input
                aria-label="שם המועד ברשימה"
                value={o.name}
                maxLength={60}
                onChange={(e) => onPatch({ name: e.target.value })}
              />
            )}
            <Input
              aria-label="הכותרת על המסך"
              value={o.title ?? ""}
              maxLength={80}
              placeholder={own ? "הכותרת על המסך (ריק = השם)" : `הכותרת על המסך (ריק = "${o.name.replace(/\s*\([^)]*\)$/, "")}")`}
              onChange={(e) => onPatch({ title: e.target.value || null })}
            />
          </section>

          {own && (
            <section className="space-y-2">
              <h3 className="font-medium">מתי</h3>
              <select
                aria-label="מתי"
                value={o.when.type}
                onChange={(e) => {
                  const t = e.target.value;
                  onPatch({
                    when:
                      t === "date"
                        ? { type: "date", date: new Date().toISOString().slice(0, 10) }
                        : t === "weekly"
                          ? { type: "weekly", weekday: 0 }
                          : { type: "hebrew", month: 7, day: 1 },
                  });
                }}
                className="h-9 rounded-md border bg-background px-2"
              >
                <option value="hebrew">כל שנה בתאריך עברי</option>
                <option value="date">פעם אחת בתאריך מסוים</option>
                <option value="weekly">כל שבוע ביום קבוע</option>
              </select>
              {o.when.type === "hebrew" && (
                <div className="flex gap-2">
                  <select
                    aria-label="יום בחודש"
                    value={o.when.day}
                    onChange={(e) => onPatch({ when: { ...(o.when as { type: "hebrew"; month: number; day: number }), day: Number(e.target.value) } })}
                    className="h-9 rounded-md border bg-background px-2"
                  >
                    {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="חודש"
                    value={o.when.month}
                    onChange={(e) => onPatch({ when: { ...(o.when as { type: "hebrew"; month: number; day: number }), month: Number(e.target.value) } })}
                    className="h-9 rounded-md border bg-background px-2"
                  >
                    {HEBREW_MONTHS.map((m) => (
                      <option key={m.month} value={m.month}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {o.when.type === "date" && (
                <input
                  type="date"
                  aria-label="התאריך"
                  value={o.when.date}
                  onChange={(e) => e.target.value && onPatch({ when: { type: "date", date: e.target.value } })}
                  className="h-9 rounded-md border bg-background px-2"
                />
              )}
              {o.when.type === "weekly" && (
                <select
                  aria-label="היום בשבוע"
                  value={o.when.weekday}
                  onChange={(e) => onPatch({ when: { type: "weekly", weekday: Number(e.target.value) } })}
                  className="h-9 rounded-md border bg-background px-2"
                >
                  {WEEKDAYS.map((w, i) => (
                    <option key={w} value={i}>
                      יום {w}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-[11px] text-muted-foreground">
                יום שחל בשלושים לחודש שיש בו השנה רק 29 ימים - יופיע בכ״ט. אדר ב׳ בשנה רגילה - באדר.
              </p>
            </section>
          )}

          {o.id !== SHABBAT_ID && (
            <section className="space-y-1">
              <h3 className="font-medium">משך</h3>
              {(["day", "holy"] as const).map((w) => (
                <label key={w} className="flex items-center gap-2">
                  <input type="radio" name="window" checked={o.window === w} onChange={() => onPatch({ window: w })} />
                  {w === "day" ? "היום עצמו (מחצות עד חצות)" : "כמו שבת ויום טוב: מהדלקת הנרות בערב ועד צאת"}
                </label>
              ))}
            </section>
          )}

          <section className="space-y-1">
            <h3 className="font-medium">איך מוצג</h3>
            {(Object.keys(DISPLAY_LABELS) as Occasion["display"][]).map((d) => (
              <label key={d} className="flex items-center gap-2">
                <input type="radio" name="display" checked={o.display === d} onChange={() => onPatch({ display: d })} />
                <b>{DISPLAY_LABELS[d].name}</b>
                <span className="text-[11px] text-muted-foreground">{DISPLAY_LABELS[d].note}</span>
              </label>
            ))}
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={o.banner} onChange={(e) => onPatch({ banner: e.target.checked })} />
              גם פס בתחתית המסכים הרגילים (השם והזמנים)
            </label>
            <label className="flex items-center gap-2 text-xs">
              משך מסך המועד בתור:
              <Input
                type="number"
                min={10}
                max={600}
                aria-label="משך מסך המועד"
                value={o.seconds}
                onChange={(e) => onPatch({ seconds: Math.max(10, Math.min(600, Number(e.target.value) || 45)) })}
                className="h-8 w-20"
              />
              שניות
            </label>
          </section>

          <section className="space-y-1">
            <h3 className="font-medium">כשהוא חל יחד עם מועד אחר</h3>
            <p className="text-[11px] text-muted-foreground">קובע כשהמועד הזה גבוה יותר ברשימה מהמועד השני.</p>
            {(Object.keys(OVERLAP_LABELS) as Occasion["overlap"][]).map((v) => (
              <label key={v} className="flex items-center gap-2">
                <input type="radio" name="overlap" checked={o.overlap === v} onChange={() => onPatch({ overlap: v })} />
                <b>{OVERLAP_LABELS[v].name}</b>
                <span className="text-[11px] text-muted-foreground">{OVERLAP_LABELS[v].note}</span>
              </label>
            ))}
          </section>

          <section className="space-y-2">
            <h3 className="font-medium">מה יופיע במסך</h3>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {CARD_ELEMENTS.map((e) => (
                <label key={e} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={o.elements.includes(e)}
                    onChange={(ev) => onPatch({ elements: CARD_ELEMENTS.filter((x) => (x === e ? ev.target.checked : o.elements.includes(x))) })}
                  />
                  {CARD_ELEMENT_LABELS[e]}
                </label>
              ))}
            </div>
            <div className="text-xs font-medium">ומהלוח הרגיל - במסך נוסף שמתחלף עם מסך המועד:</div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {OCCASION_BLOCKS.map((b) => (
                <label key={b} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={o.blocks.includes(b)}
                    onChange={(ev) => onPatch({ blocks: toggle(o.blocks, b, ev.target.checked) })}
                  />
                  {BLOCK_BY_ID[b].name}
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="font-medium">שורות משלכם</h3>
            <p className="text-[11px] text-muted-foreground">
              טקסט (ברכה, הודעה) או שעה עם כותרת (סעודה שלישית, שיעור מיוחד). מופיעות כשמסומן "השורות שהוספתם".
            </p>
            {o.items.map((it) => (
              <div key={it.id} className="flex items-center gap-2">
                <Input
                  aria-label="כותרת השורה"
                  value={it.label}
                  maxLength={60}
                  placeholder={it.kind === "time" ? "למה השעה" : "כותרת (לא חובה)"}
                  onChange={(e) => setItem(it.id, { label: e.target.value })}
                  className="h-8 w-40"
                />
                {it.kind === "time" ? (
                  <input
                    type="time"
                    aria-label="השעה"
                    value={it.value}
                    onChange={(e) => e.target.value && setItem(it.id, { value: e.target.value })}
                    className="h-8 rounded-md border bg-background px-1"
                  />
                ) : (
                  <Input
                    aria-label="הטקסט"
                    value={it.value}
                    maxLength={400}
                    onChange={(e) => setItem(it.id, { value: e.target.value })}
                    className="h-8 flex-1"
                  />
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="הסרת השורה"
                  onClick={() => onPatch({ items: o.items.filter((x) => x.id !== it.id) })}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              {(["text", "time"] as const).map((kind) => (
                <Button
                  key={kind}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={o.items.length >= 12}
                  onClick={() =>
                    onPatch({
                      items: [
                        ...o.items,
                        { id: Math.random().toString(36).slice(2, 8), kind, label: "", value: kind === "time" ? "12:00" : "טקסט" },
                      ],
                    })
                  }
                >
                  <Plus className="size-4" /> {kind === "time" ? "שעה" : "טקסט"}
                </Button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="font-medium">תמונות ברקע</h3>
            <p className="text-[11px] text-muted-foreground">מתחלפות לפי הסדר. לחיצה מוסיפה או מסירה.</p>
            <div className="flex flex-wrap gap-2">
              {[...new Set([...o.pictures, ...builtins])].map((p) => {
                const on = o.pictures.includes(p);
                const info = pictureInfo(p);
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      const pictures = on ? o.pictures.filter((x) => x !== p) : [...o.pictures, p].slice(0, MAX_OCCASION_PICTURES);
                      onPatch({ pictures });
                    }}
                    className={`w-24 overflow-hidden rounded-md border text-center text-[11px] ${
                      on ? "ring-2 ring-primary ring-offset-1" : "opacity-70 hover:opacity-100"
                    }`}
                  >
                    {info.thumb ? (
                      <img src={info.thumb} alt="" className="aspect-video w-full object-cover" loading="lazy" />
                    ) : (
                      <span className="flex aspect-video w-full items-center justify-center bg-muted">🎨</span>
                    )}
                    <span className="block truncate px-1 py-0.5">{info.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs">
                <ImagePlus className="size-4" /> {busy ? "מעלה…" : "העלאת תמונה"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  disabled={busy}
                  onChange={(e) => {
                    void upload(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <label className="flex items-center gap-1 text-xs">
                כל תמונה
                <Input
                  type="number"
                  min={5}
                  max={600}
                  aria-label="שניות לכל תמונה"
                  value={o.pictureSeconds}
                  onChange={(e) => onPatch({ pictureSeconds: Math.max(5, Math.min(600, Number(e.target.value) || 30)) })}
                  className="h-8 w-20"
                />
                שניות
              </label>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="font-medium">עיצוב הלוח במועד</h3>
            <select
              aria-label="עיצוב הלוח במועד"
              value={o.design ?? ""}
              onChange={(e) => onPatch({ design: e.target.value || null })}
              className="h-9 rounded-md border bg-background px-2"
            >
              <option value="">כרגיל</option>
              <optgroup label="עיצובים מוכנים">
                {BUILTIN_DESIGNS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </optgroup>
              {config.designs.length > 0 && (
                <optgroup label="העיצובים שלי">
                  {config.designs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </section>

          <div className="flex flex-wrap justify-between gap-2 border-t pt-3">
            <Button type="button" variant="outline" onClick={onPreview}>
              <Eye className="size-4" /> תצוגה בתאריך הקרוב
            </Button>
            <div className="flex gap-2">
              {own && (
                <Button type="button" variant="destructive" onClick={onDelete}>
                  <Trash2 className="size-4" /> מחיקת המועד
                </Button>
              )}
              <Button type="button" onClick={onClose}>
                סגירה
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
