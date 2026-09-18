import { ArrowDown, ArrowLeftRight, ArrowUp, Eye, EyeOff, Globe, Minus, Move, MousePointerClick, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EDITABLE, isHidden, setElementStyle, setHidden, setText, toggleFlip } from "@/tv/boardEdit";
import type { ElementStyle, FlipArea, RecordTable, TvConfig } from "@/tv/config";
import { isSafeCssValue } from "@/tv/themes";
import type { BoardData } from "@/tv/useBoardData";
import { moveAnnouncement, withRecordEdit } from "./tvRecords";

/**
 * The form for whatever the admin clicked on the board. Every change goes
 * into the editor's draft (undo/redo, discard) and reaches the screens only
 * with "שמור ושדר".
 */

type Edit = (key: string, update: (c: TvConfig) => TvConfig) => void;

const FLIP_LABELS: Record<FlipArea, string> = {
  header: "החלפת צד: שם בית הכנסת ↔ שעון",
  prayer: "החלפת צד: מניינים ↔ זמני היום",
  learning: "היפוך סדר הכרטיסים",
};

const RECORD_RE = /^(ann|shiur|minyan):([0-9a-f-]{8,})(?::([a-z_]+))?$/i;
const TABLE_OF = { ann: "announcements", shiur: "shiurim", minyan: "minyanim" } as const;
const FIELD_LABELS: Record<string, string> = { title: "כותרת", body: "תוכן", teacher: "מגיד השיעור", label: "שם המניין" };
const KIND_LABELS = { ann: "מודעה", shiur: "שיעור", minyan: "מניין" } as const;

export function TvEditInspector({
  selected,
  config,
  data,
  onEdit,
  onSelect,
}: {
  selected: string | null;
  config: TvConfig;
  data: BoardData;
  onEdit: Edit;
  onSelect: (key: string | null) => void;
}) {
  const hiddenList = [
    ...config.hidden,
    ...(!config.header.parasha ? ["header.parasha"] : []),
    ...(!config.header.dafYomi ? ["header.daf"] : []),
    ...(!config.header.logo ? ["header.logo"] : []),
    ...(!config.ticker.enabled && config.ticker.text ? ["ticker"] : []),
  ];

  return (
    <div className="rounded-xl border-2 border-primary/40 bg-card p-3 shadow-sm" dir="rtl">
      {selected ? (
        <Selected key={selected} k={selected} config={config} data={data} onEdit={onEdit} onClose={() => onSelect(null)} />
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <MousePointerClick className="size-4 shrink-0" />
          לחצו על כל טקסט או אזור בלוח כדי לערוך, להסתיר או להזיז אותו. זה עובד בכל אחד מהמכשירים שלמעלה.
        </p>
      )}

      {hiddenList.length > 0 && (
        <div className="mt-3 border-t pt-2">
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">מוסתרים מהלוח ({hiddenList.length}) · לחיצה מחזירה</div>
          <div className="flex flex-wrap gap-1.5">
            {hiddenList.map((k) => (
              <button
                key={k}
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-0.5 text-xs hover:bg-secondary"
                onClick={() =>
                  onEdit(`hide:${k}`, (c) => (k === "ticker" ? { ...c, ticker: { ...c.ticker, enabled: true } } : setHidden(c, k, false)))
                }
              >
                <Eye className="size-3" /> {describeKey(k, data)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Human name of an element key, for the hidden list and the inspector title. */
function describeKey(key: string, data: BoardData): string {
  if (EDITABLE[key]) return EDITABLE[key].label;
  const m = key.match(RECORD_RE);
  if (!m) return key;
  const kind = m[1] as keyof typeof KIND_LABELS;
  const row = findRow(data, kind, m[2]);
  const name = row ? String(row.title ?? row.label ?? "") : "";
  return `${KIND_LABELS[kind]}${name ? `: ${name.slice(0, 40)}` : ""}${m[3] ? ` · ${FIELD_LABELS[m[3]] ?? m[3]}` : ""}`;
}

function findRow(data: BoardData, kind: "ann" | "shiur" | "minyan", id: string): Record<string, unknown> | undefined {
  const rows = kind === "ann" ? data.announcements : kind === "shiur" ? data.shiurim : data.minyanim;
  return (rows ?? []).find((r) => r.id === id) as Record<string, unknown> | undefined;
}

function Selected({ k, config, data, onEdit, onClose }: { k: string; config: TvConfig; data: BoardData; onEdit: Edit; onClose: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">עריכה</span>
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{describeKey(k, data)}</h3>
        <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="סגירה" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>
      {EDITABLE[k] ? (
        <BoardElement k={k} config={config} data={data} onEdit={onEdit} />
      ) : (
        <RecordElement k={k} config={config} data={data} onEdit={onEdit} onClose={onClose} />
      )}
      <ElementLook k={k} style={config.styles[k]} onEdit={onEdit} />
    </div>
  );
}

/* ------------------------------------------ size, colour and position -- */

function NumStep({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  return (
    <div className="inline-flex items-center rounded-md border bg-background" role="group" aria-label={label}>
      <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`הקטנת ${label}`} onClick={() => onChange(clamp(value - step))} disabled={value <= min}>
        <Minus className="size-3.5" />
      </Button>
      <span className="min-w-12 px-1 text-center text-xs tabular-nums" role="spinbutton" aria-label={label} aria-valuenow={value} aria-valuemin={min} aria-valuemax={max}>
        {format(value)}
      </span>
      <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`הגדלת ${label}`} onClick={() => onChange(clamp(value + step))} disabled={value >= max}>
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}

/**
 * The look of the selected element on its own: text size, colour and a
 * nudge from its natural place. Stored per element in tv_config.styles and
 * rendered the same way on the TV (boardEdit.elementStyleCss). Dragging the
 * element in the preview edits the same x / y.
 */
function ElementLook({ k, style, onEdit }: { k: string; style: ElementStyle | undefined; onEdit: Edit }) {
  const scale = style?.scale ?? 1;
  const [colorText, setColorText] = useState(style?.color ?? "");
  useEffect(() => setColorText(style?.color ?? ""), [style?.color]);
  const set = (patch: Partial<ElementStyle>, group = "look") => onEdit(`style:${group}:${k}`, (c) => setElementStyle(c, k, patch));
  const changed = Boolean(style && Object.keys(style).length);
  const isHex = /^#[0-9a-f]{6}$/i.test(style?.color ?? "");

  return (
    <div className="space-y-2 border-t pt-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Move className="size-3.5" /> עיצוב הרכיב הזה בלבד
        {changed && (
          <Button type="button" variant="ghost" size="sm" className="ms-auto h-7 text-xs" onClick={() => onEdit(`style:reset:${k}`, (c) => setElementStyle(c, k, null))}>
            <RotateCcw className="size-3.5" /> איפוס העיצוב
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          גודל טקסט
          <NumStep label="גודל טקסט של הרכיב" value={Math.round(scale * 100)} min={50} max={200} step={5} format={(v) => `${v}%`} onChange={(v) => set({ scale: v / 100 }, "scale")} />
        </label>
        <label className="flex items-center gap-2">
          צבע
          <input
            type="color"
            aria-label="צבע הרכיב"
            value={isHex ? style!.color! : "#ffffff"}
            onChange={(e) => set({ color: e.target.value }, "color")}
            className="size-8 cursor-pointer rounded border bg-transparent p-0.5"
          />
          <Input
            dir="ltr"
            aria-label="צבע הרכיב (ערך)"
            value={colorText}
            placeholder="של הערכה"
            className={`h-8 w-28 font-mono text-xs ${colorText && !isSafeCssValue(colorText) ? "border-destructive" : ""}`}
            onChange={(e) => {
              setColorText(e.target.value);
              if (e.target.value === "" || isSafeCssValue(e.target.value)) set({ color: e.target.value.trim() || undefined }, "color");
            }}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          ימין/שמאל
          <NumStep label="הזזה אופקית" value={style?.x ?? 0} min={-50} max={50} step={0.5} format={(v) => `${v}%`} onChange={(v) => set({ x: v }, "pos")} />
        </label>
        <label className="flex items-center gap-2">
          למעלה/למטה
          <NumStep label="הזזה אנכית" value={style?.y ?? 0} min={-50} max={50} step={0.5} format={(v) => `${v}%`} onChange={(v) => set({ y: v }, "pos")} />
        </label>
        <span className="text-xs text-muted-foreground">אפשר גם לגרור את הרכיב בתצוגה. ההזזה באחוזי מסך, כך שהיא נשמרת בכל גודל מסך.</span>
      </div>
    </div>
  );
}

/* --------------------------------------------- board wording and layout -- */

function BoardElement({ k, config, data, onEdit }: { k: string; config: TvConfig; data: BoardData; onEdit: Edit }) {
  const spec = EDITABLE[k];
  const isTicker = k === "ticker";
  const siteValue = spec.siteField ? String(data.settings?.[spec.siteField] ?? "") : "";
  const fallback = spec.siteField ? siteValue : (spec.text ?? "");
  const value = isTicker ? config.ticker.text : (config.texts[k] ?? fallback);
  const overridden = !isTicker && config.texts[k] !== undefined && config.texts[k] !== fallback;
  const hidden = isTicker ? !config.ticker.enabled : isHidden(config, k);
  const Field = spec.multiline ? Textarea : Input;

  const change = (v: string) =>
    onEdit(`txt:${k}`, (c) =>
      isTicker ? { ...c, ticker: { enabled: v.trim() !== "", text: v.slice(0, 400) } } : setText(c, k, v === fallback ? null : v),
    );

  return (
    <div className="space-y-3">
      {spec.text !== undefined && (
        <div className="space-y-1.5">
          <Field
            value={value}
            dir="rtl"
            aria-label={spec.label}
            placeholder={fallback || "טקסט"}
            onChange={(e: { target: { value: string } }) => change(e.target.value)}
            className={spec.multiline ? "min-h-20" : undefined}
          />
          <p className="text-xs text-muted-foreground">
            {spec.siteField
              ? "משנה רק את הלוח. כדי לשנות גם באתר - הכפתור \"גם באתר\"."
              : isTicker
                ? "שורה שרצה בתחתית המסך. (התנועה הרציפה מעמיסה על מעבד הקופסה.)"
                : "משנה את הנוסח בלוח בלבד."}
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {spec.hideable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onEdit(`hide:${k}`, (c) => (isTicker ? { ...c, ticker: { ...c.ticker, enabled: hidden } } : setHidden(c, k, !hidden)))
            }
          >
            {hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />} {hidden ? "הצגה בלוח" : "הסתרה מהלוח"}
          </Button>
        )}
        {spec.flip && (
          <Button type="button" variant="outline" size="sm" onClick={() => onEdit(`flip:${spec.flip}`, (c) => toggleFlip(c, spec.flip!))}>
            <ArrowLeftRight className="size-4" /> {FLIP_LABELS[spec.flip]}
          </Button>
        )}
        {overridden && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(`txt:${k}`, (c) => setText(c, k, null))}>
            <RotateCcw className="size-4" /> חזרה לנוסח המקורי
          </Button>
        )}
        {spec.siteField && data.settings && overridden && value.trim() && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            title="השם יתעדכן בכל האתר, והלוח יציג אותו משם"
            onClick={() =>
              onEdit(`site:${k}`, (c) =>
                setText(withRecordEdit(c, { table: "settings", id: String(data.settings!.id), field: spec.siteField!, value: value.trim() }), k, null),
              )
            }
          >
            <Globe className="size-4" /> גם באתר
          </Button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------ content records -- */

function RecordElement({ k, config, data, onEdit, onClose }: { k: string; config: TvConfig; data: BoardData; onEdit: Edit; onClose: () => void }) {
  const m = k.match(RECORD_RE);
  if (!m) return <p className="text-sm text-muted-foreground">אי אפשר לערוך את הרכיב הזה.</p>;
  const kind = m[1] as keyof typeof TABLE_OF;
  const id = m[2];
  const field = m[3];
  const table: RecordTable = TABLE_OF[kind];
  const row = findRow(data, kind, id);
  if (!row) return <p className="text-sm text-muted-foreground">הפריט כבר לא קיים.</p>;

  const elementKey = `${kind}:${id}`;
  const hidden = config.hidden.includes(elementKey);
  const multiline = field === "body";
  const Field = multiline ? Textarea : Input;
  const ordered = (data.announcements ?? []).filter((a) => !config.hidden.includes(`ann:${a.id}`));
  const pos = ordered.findIndex((a) => a.id === id);

  return (
    <div className="space-y-3">
      {field && (
        <div className="space-y-1.5">
          <Field
            value={String(row[field] ?? "")}
            dir="rtl"
            aria-label={FIELD_LABELS[field] ?? field}
            onChange={(e: { target: { value: string } }) =>
              onEdit(`rec:${k}`, (c) => withRecordEdit(c, { table, id, field, value: e.target.value.slice(0, multiline ? 4000 : 200) }))
            }
            className={multiline ? "min-h-28" : undefined}
          />
          <p className="text-xs text-muted-foreground">
            זה אותו {KIND_LABELS[kind]} שמופיע באתר: השינוי יחול גם שם, בלחיצה על "שמור ושדר".
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onEdit(`hide:${elementKey}`, (c) => setHidden(c, elementKey, !hidden))}>
          <EyeOff className="size-4" /> הסתרה מהלוח בלבד
        </Button>
        {kind === "ann" && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pos <= 0}
              onClick={() => onEdit(`move:${id}`, (c) => moveAnnouncement(c, data.announcements ?? [], ordered, id, -1))}
            >
              <ArrowUp className="size-4" /> הקדמה
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pos < 0 || pos >= ordered.length - 1}
              onClick={() => onEdit(`move:${id}`, (c) => moveAnnouncement(c, data.announcements ?? [], ordered, id, 1))}
            >
              <ArrowDown className="size-4" /> העברה אחורה
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="text-destructive">
                  <Trash2 className="size-4" /> מחיקת המודעה
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle>למחוק את המודעה לגמרי?</AlertDialogTitle>
                  <AlertDialogDescription>
                    המודעה "{String(row.title ?? "")}" תימחק מהאתר ומכל המסכים בלחיצה על "שמור ושדר". עד אז אפשר לבטל (Ctrl+Z).
                    אם רוצים רק להוריד אותה מהלוח - "הסתרה מהלוח בלבד".
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>ביטול</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => {
                      onEdit(`del:${id}`, (c) => withRecordEdit(c, { table: "announcements", id, delete: true }));
                      onClose();
                    }}
                  >
                    מחיקה
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
      {kind === "minyan" && <p className="text-xs text-muted-foreground">שעות המניין נקבעות בלשונית "מניינים" (שעה קבועה או לפי זמני היום).</p>}
    </div>
  );
}
