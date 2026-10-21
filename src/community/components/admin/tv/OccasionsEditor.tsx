import { Hint } from "@/components/InfoTip";
import { useMemo, useState } from "react";
import { Eye, Palette, Plus, Settings2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { confirmAction } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { jerusalemDateKey } from "@community/lib/minyan-time";
import { specialDayByKey } from "@community/lib/specialDays";
import { BLOCK_BY_ID } from "@/tv/blocks";
import type { TvConfig } from "@/tv/config";
import { findDesign } from "@/tv/designs";
import { STYLE_NAMES, PHOTO_STYLES, stylesFor } from "@/tv/eventSlides";
import {
  CARD_ELEMENTS,
  CARD_ELEMENT_LABELS,
  HEBREW_MONTHS,
  MAX_OCCASION_PICTURES,
  MAX_OCCASION_UPLOADS,
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
import { useUpload } from "./Upload";
import { INPUT_CLASS, MoveButtons, SELECT_CLASS, Stepper, SwitchRow } from "./editorParts";
import { GalleryGrid, GalleryTile, UploadTile } from "./GalleryTile";
import { Notice } from "./Notice";
import { ChipRemove } from "./ReadyShelf";
import { TimetableButton, TimetableSection } from "./OccasionTimetable";

/** One sentence for an occasion that is off, wherever it is opened (here, and its tab beside the pages). */
export const occasionOffNote = (name: string) => `"${name}" כבוי - הוא לא יופיע על המסכים עד שתפעילו אותו בלשונית "מועדים".`;

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
 *
 * Its look is edited on its own page (🎨 here, or its tab beside the pages):
 * the dialog names the kit it wears and leads there, rather than offering a
 * second list of kits of its own. Its day is shown in the preview by the eye
 * in its row; any other day, by the one date control under the preview.
 */
export function OccasionsEditor({
  config,
  onEdit,
  onPreview,
  onDesign,
}: {
  config: TvConfig;
  onEdit: Edit;
  /** Edit this occasion's own design in the board's design tab. */
  onDesign?: (occasionId: string) => void;
  /** Show the preview at this moment (null: back to now) - on this occasion's screen, when one is named. */
  onPreview: (at: Date | null, occasionId?: string) => void;
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
  const move = (id: string, by: -1 | 1) =>
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
        screen: null,
      },
    ]);
    setOpenId(id);
  };

  /** A moment in the occasion's next day that shows it: Shabbat morning, or midday. */
  const preview = (o: Occasion) => {
    const d = next[o.id];
    if (!d) return toast.error("לא נמצא תאריך קרוב למועד הזה");
    // The day in Israel: toISOString's is UTC, the day before from midnight to 03:00.
    onPreview(new Date(Date.parse(`${jerusalemDateKey(d)}T11:00:00+03:00`)), o.id);
    if (!o.enabled) toast.warning(occasionOffNote(o.name));
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
        <SwitchRow label="רק פעילים" ariaLabel="רק פעילים" checked={onlyOn} onChange={setOnlyOn} />
      </div>

      <ol className="divide-y rounded-lg border">
        {shown.map((o) => {
          const i = list.indexOf(o);
          const d = next[o.id];
          const inDays = d ? Math.round((d.getTime() - today.getTime()) / DAY_MS) : null;
          return (
            <li key={o.id} className="flex items-center gap-2 px-2 py-1.5" data-occasion={o.id}>
              {/* Earlier in the list is more important. */}
              <MoveButtons name={o.name} stacked first={i === 0} last={i === list.length - 1} onMove={(by) => move(o.id, by)} />
              <span className="w-6 text-center text-[11px] text-muted-foreground">{i + 1}</span>
              <Switch checked={o.enabled} onCheckedChange={(on) => patch(o.id, { enabled: on })} aria-label={`${o.name} פעיל`} />
              <button type="button" className="min-w-0 flex-1 text-right" onClick={() => setOpenId(o.id)}>
                <div className={`truncate text-sm font-medium${o.enabled ? "" : " text-muted-foreground"}`}>{o.name}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {describeWhen(o)}
                  {inDays !== null && ` · ${inDays === 0 ? "היום" : inDays === 1 ? "מחר" : `בעוד ${inDays} ימים`}`}
                  {o.enabled && ` · ${DISPLAY_LABELS[o.display].name}`}
                  {o.design && " · עם ערכה"}
                </div>
              </button>
              {o.when.type === "calendar" && specialDayByKey(o.when.key) && <TimetableButton def={specialDayByKey(o.when.key)!} />}
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => preview(o)} title="תצוגה בתאריך הקרוב" aria-label={`תצוגה של ${o.name} בתאריך הקרוב`}>
                <Eye className="size-4" />
              </Button>
              {onDesign && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => {
                    // Its day, on its screen, and the design tab working on it.
                    preview(o);
                    onDesign(o.id);
                  }}
                  title="עריכת המסך של המועד והערכה שלו, בעורך העיצוב הרגיל"
                  aria-label={`עיצוב המסך של ${o.name}`}
                  data-testid="occasion-design"
                >
                  <Palette className="size-4" />
                </Button>
              )}
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
          onDelete={async () => {
            const ok = await confirmAction({
              title: `למחוק את "${open.name}"?`,
              description: 'המועד והגדרותיו יימחקו מהרשימה. אפשר לבטל עם "צעד אחורה" (Ctrl+Z) עד השמירה.',
              confirmLabel: "מחיקה",
            });
            if (!ok) return;
            change(`delete:${open.id}`, (l) => l.filter((o) => o.id !== open.id));
            setOpenId(null);
          }}
          onDesign={
            onDesign &&
            (() => {
              // The dialog covers the page it leads to: closed, its day and its screen in the preview.
              setOpenId(null);
              preview(open);
              onDesign(open.id);
            })
          }
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
  onDesign,
}: {
  occasion: Occasion;
  config: TvConfig;
  onClose: () => void;
  onPatch: (p: Partial<Occasion>) => void;
  onDelete: () => void;
  /** Its page in the design tab, where its look is edited. */
  onDesign?: () => void;
}) {
  const own = !o.id.startsWith("cal:") && o.id !== SHABBAT_ID;
  const def = o.when.type === "calendar" ? specialDayByKey(o.when.key) : null;
  const kit = findDesign(config, o.design);
  const toggle = <T,>(list: T[], v: T, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));

  // The built-in pictures this occasion can have: its day's designs, and Shabbat's drawings.
  const builtins = [
    ...(def ? stylesFor(def) : [0, 1, 2]).map((n) => `style:${n}`),
    ...(o.id === SHABBAT_ID || own ? SHABBAT_ART.map((a) => `art:${a.id}`) : []),
  ];
  const setItem = (id: string, p: Partial<OccasionItem>) =>
    onPatch({ items: o.items.map((i) => (i.id === id ? { ...i, ...p } : i)) });

  const { uploading, upload: uploadFiles } = useUpload();
  const upload = (files: File[]) =>
    uploadFiles(files, (urls) =>
      onPatch({
        pictures: [...o.pictures, ...urls].slice(0, MAX_OCCASION_PICTURES),
        uploads: [...new Set([...urls, ...(o.uploads ?? [])])].slice(0, MAX_OCCASION_UPLOADS),
      }),
    );
  /** An uploaded picture taken out of the gallery (and off the screen), asked first. */
  const removePicture = async (p: string) => {
    const ok = await confirmAction({
      title: "למחוק את התמונה מהגלריה?",
      description: "היא תרד מהמסך של המועד ומהגלריה שלו.",
      confirmLabel: "מחיקה",
    });
    if (ok) onPatch({ pictures: o.pictures.filter((x) => x !== p), uploads: (o.uploads ?? []).filter((x) => x !== p) });
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="occasion-dialog">
        <DialogHeader>
          <DialogTitle>{o.name}</DialogTitle>
          <DialogDescription>{describeWhen(o)}. כל שינוי נשמר בטיוטה ומגיע למסכים ב"שמור ושדר".</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          <SwitchRow
            label={<b>פעיל</b>}
            note="מופיע לבד כשהיום שלו מגיע"
            ariaLabel="המועד פעיל"
            checked={o.enabled}
            onChange={(on) => onPatch({ enabled: on })}
          />

          {def && <TimetableSection def={def} />}

          {/* Its own screen is shown or hidden by "איך מוצג" below ("בלי מסך משלו"): one control, not two. */}
          {!o.screen && o.blocks.length > 0 && config.screenLayout !== "composition" && (
          <section className="space-y-2" data-testid="occasion-screens">
            <h3 className="font-medium">המסך הנוסף מהלוח</h3>
            <Hint>אפשר להסתיר אותו ולהחזיר מתי שרוצים, בלי למחוק את מה שהוגדר בו.</Hint>
              <SwitchRow
                label={<b>{o.name} · מהלוח</b>}
                note={o.blocksOff ? "מוסתר - מה שסימנתם בו נשמר להחזרה" : "המסך הנוסף עם מה שסימנתם מהלוח הרגיל"}
                ariaLabel="המסך הנוסף מהלוח מוצג"
                checked={!o.blocksOff}
                onChange={(on) => onPatch({ blocksOff: !on })}
              />
          </section>
          )}

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
                className={SELECT_CLASS}
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
                    className={SELECT_CLASS}
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
                    className={SELECT_CLASS}
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
                  className={INPUT_CLASS}
                />
              )}
              {o.when.type === "weekly" && (
                <select
                  aria-label="היום בשבוע"
                  value={o.when.weekday}
                  onChange={(e) => onPatch({ when: { type: "weekly", weekday: Number(e.target.value) } })}
                  className={SELECT_CLASS}
                >
                  {WEEKDAYS.map((w, i) => (
                    <option key={w} value={i}>
                      יום {w}
                    </option>
                  ))}
                </select>
              )}
              <Hint>
                יום שחל בשלושים לחודש שיש בו השנה רק 29 ימים - יופיע בכ״ט. אדר ב׳ בשנה רגילה - באדר.
              </Hint>
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
            <Hint>"בלי מסך משלו" מסתיר את מסך המועד; מה שהוגדר בו נשמר להחזרה.</Hint>
            <div role="radiogroup" aria-label="איך מוצג" className="space-y-1">
            {(Object.keys(DISPLAY_LABELS) as Occasion["display"][]).map((d) => (
              <label key={d} className="flex items-center gap-2">
                <input type="radio" name="display" checked={o.display === d} onChange={() => onPatch({ display: d })} aria-label={DISPLAY_LABELS[d].name} />
                <b>{DISPLAY_LABELS[d].name}</b>
                <span className="text-[11px] text-muted-foreground">{DISPLAY_LABELS[d].note}</span>
              </label>
            ))}
            </div>
            <div className="pt-1">
              <SwitchRow
                label="גם פס בתחתית המסכים הרגילים (השם והזמנים)"
                ariaLabel="פס בתחתית המסכים הרגילים"
                checked={o.banner}
                onChange={(on) => onPatch({ banner: on })}
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              משך מסך המועד בתור:
              <Stepper
                label="משך מסך המועד"
                value={o.seconds}
                min={10}
                max={600}
                step={5}
                format={(v) => `${v} שניות`}
                onChange={(v) => onPatch({ seconds: v })}
              />
            </div>
          </section>

          <section className="space-y-1">
            <h3 className="font-medium">כשהוא חל יחד עם מועד אחר</h3>
            <Hint>קובע כשהמועד הזה גבוה יותר ברשימה מהמועד השני.</Hint>
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
            {config.screenLayout === "composition" && !o.screen ? (
              // A board of parts shows all of it in one picture: a screen of its blocks would be the board again.
              <Notice variant="neutral" className="text-[11px]" data-testid="occasion-parts-board">
                הלוח שלכם בנוי מחלקים, וכל התוכן שלו מוצג בתמונה אחת - לכן למועד אין מסך נוסף "מהלוח". כאן נקבע מה בתוך
                הכרטיס; את המסך של המועד מעצבים כמו עמוד (כפתור הפלטה בשורה שלו, או הלשונית שלו ליד "עמוד 1").
              </Notice>
            ) : o.screen ? (
              // One place decides what stands beside the card, and where.
              <Notice variant="neutral" className="text-[11px]" data-testid="occasion-arranged">
                למועד הזה יש מסך משלו, מסודר בלשונית <b>פריסה</b> ("מסכים ומה עליהם"): שם בוחרים מה עומד ליד הכרטיס - תפילות,
                זמנים, הודעות - ואיפה. כאן נקבע מה בתוך הכרטיס.
              </Notice>
            ) : (
            <>
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
            <Hint>
              לסידור חופשי - הכרטיס ליד תפילות, זמנים והודעות, כל אחד במקום שתבחרו - פתחו את המועד בלשונית <b>פריסה</b>.
            </Hint>
            </>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="font-medium">שורות משלכם</h3>
            <Hint>
              טקסט (ברכה, הודעה) או שעה עם כותרת (סעודה שלישית, שיעור מיוחד). מופיעות כשמסומן "השורות שהוספתם".
            </Hint>
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
                    className={INPUT_CLASS}
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
                <ChipRemove label="הסרת השורה" onClick={() => onPatch({ items: o.items.filter((x) => x.id !== it.id) })} />
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
            <Hint>
              מתחלפות לפי הסדר. לחיצה מוסיפה או מסירה מהמסך; תמונה שהעליתם נשארת כאן גם כשהיא לא מוצגת, ו-✕ מוחק אותה מהגלריה.
            </Hint>
            {/* The one gallery of the editor: the upload first, the size of the tiles beside it. */}
            <GalleryGrid testId="occasion-pictures">
              <UploadTile label="העלאת תמונה" multiple uploading={uploading} onFiles={(files) => void upload(files)} hint="תמונה משלכם - נשמרת בגלריה של המועד" />
              {[...new Set([...o.pictures, ...(o.uploads ?? []), ...builtins])].map((p) => {
                const on = o.pictures.includes(p);
                const info = pictureInfo(p);
                const uploaded = p.startsWith("https://");
                return (
                  <GalleryTile
                    key={p}
                    name={on ? info.label : `${info.label} · לא מוצגת`}
                    ariaLabel={info.label}
                    on={on}
                    onPick={() => {
                      if (!on) return onPatch({ pictures: [...o.pictures, p].slice(0, MAX_OCCASION_PICTURES) });
                      // Off the screen, still in the gallery: an uploaded picture
                      // (one from before there was a gallery too) is kept.
                      onPatch({
                        pictures: o.pictures.filter((x) => x !== p),
                        ...(uploaded ? { uploads: [...new Set([p, ...(o.uploads ?? [])])].slice(0, MAX_OCCASION_UPLOADS) } : {}),
                      });
                    }}
                    preview={
                      info.thumb ? (
                        <img src={info.thumb} alt="" className="size-full object-cover" loading="lazy" />
                      ) : (
                        <span className="flex size-full items-center justify-center">
                          <Palette className="size-5 text-white/60" aria-hidden />
                        </span>
                      )
                    }
                    remove={uploaded ? { ready: false, onClick: () => void removePicture(p) } : undefined}
                  />
                );
              })}
            </GalleryGrid>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 text-xs">
                כל תמונה
                <Stepper
                  label="שניות לכל תמונה"
                  value={o.pictureSeconds}
                  min={5}
                  max={600}
                  step={5}
                  format={(v) => `${v} שניות`}
                  onChange={(v) => onPatch({ pictureSeconds: v })}
                />
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="font-medium">עיצוב המועד</h3>
            {/* One place to choose and change it: the occasion's page. Here, what it wears, and the way there. */}
            <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="occasion-kit">
              <span>
                ערכה: <b>{kit ? kit.name : o.design ? "ערכה שנמחקה" : "בלי ערכה - כמו הלוח"}</b>
              </span>
              {onDesign && (
                <Button type="button" size="sm" variant="outline" className="h-8" onClick={onDesign} title="פותח את העמוד של המועד: בוחרים שם ערכה ומשנים רקע, מסגרות וטקסט">
                  <Palette className="size-4" aria-hidden /> {o.design ? "עריכה" : "בחירת ערכה"}
                </Button>
              )}
              {o.design && (
                <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => onPatch({ design: null })} title="המועד חוזר להיראות כמו הלוח">
                  בלי ערכה
                </Button>
              )}
            </div>
            <Hint>
              הערכה נבחרת ומשתנה בעמוד של המועד (כפתור הפלטה בשורה שלו, או הלשונית שלו ליד "עמוד 1") - שם גם ערכות מהאוסף המשותף. כל שינוי נשמר לערכה של המועד בלבד.
            </Hint>
            {o.design && (
              <div className="space-y-1 text-sm" role="radiogroup" aria-label="איפה העיצוב חל" data-testid="occasion-design-on">
                <label className="flex items-start gap-2">
                  <input
                    type="radio"
                    name={`design-on-${o.id}`}
                    checked={o.designOn === "screen"}
                    onChange={() => onPatch({ designOn: "screen" })}
                    className="mt-1"
                  />
                  <span>
                    רק על המסך של המועד
                    <span className="block text-[11px] text-muted-foreground">המסכים הרגילים נשארים בעיצוב שלהם, גם ביום הזה.</span>
                  </span>
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="radio"
                    name={`design-on-${o.id}`}
                    checked={o.designOn === "board"}
                    onChange={() => onPatch({ designOn: "board" })}
                    className="mt-1"
                  />
                  <span>
                    על כל הלוח בזמן המועד
                    <span className="block text-[11px] text-muted-foreground">גם המסכים הרגילים לובשים אותו עד שהמועד נגמר.</span>
                  </span>
                </label>
              </div>
            )}
          </section>

          {/* Logical order: what it does first, closing at the end (the left, in Hebrew). */}
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            {own && (
              <Button type="button" variant="destructive" onClick={onDelete}>
                <Trash2 className="size-4" /> מחיקת המועד
              </Button>
            )}
            <Button type="button" variant="ghost" className="ms-auto" onClick={onClose}>
              <X className="size-4" /> סגירה
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
