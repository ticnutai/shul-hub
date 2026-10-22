import { Hint } from "@/components/InfoTip";
import { useEffect, useMemo, useState } from "react";
import { Check, Download, Upload, X } from "lucide-react";
import { confirmAction } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  isSafeGradient,
} from "@/tv/themes";
import { ColourRow, Range, Segments } from "./editorParts";
import { FileButton } from "./Upload";

/**
 * Building and keeping gradients.
 *
 * Two colours, a direction and a live swatch cover what an admin actually
 * wants; an "advanced" field keeps any gradient CSS that the simple controls
 * cannot express (three stops, conic, transparency) exactly as written,
 * instead of flattening it. Saving to the library stores the CSS itself, so
 * deleting a saved gradient never changes a board that already uses it.
 */


const DEFAULT_ANGLE = 160;

/** Reads a simple two-stop gradient back into the controls; null when it is beyond them. */
function parseSimple(
  value: string | null | undefined,
): { kind: "linear" | "radial"; angle: number; from: string; to: string } | null {
  if (!value) return null;
  const linear = value.match(
    /^linear-gradient\(\s*(\d{1,3})deg\s*,\s*(#[0-9a-f]{6})\s*(?:\d+%)?\s*,\s*(#[0-9a-f]{6})\s*(?:\d+%)?\s*\)$/i,
  );
  if (linear) return { kind: "linear", angle: Number(linear[1]), from: linear[2], to: linear[3] };
  const radial = value.match(
    /^radial-gradient\(\s*ellipse at 50% 30%\s*,\s*(#[0-9a-f]{6})\s*(?:\d+%)?\s*,\s*(#[0-9a-f]{6})\s*(?:\d+%)?\s*\)$/i,
  );
  if (radial) return { kind: "radial", angle: DEFAULT_ANGLE, from: radial[1], to: radial[2] };
  return null;
}

function build(kind: "linear" | "radial", angle: number, from: string, to: string): string {
  return kind === "linear"
    ? `linear-gradient(${angle}deg, ${from}, ${to})`
    : `radial-gradient(ellipse at 50% 30%, ${from}, ${to})`;
}

export function GradientStudio({
  /** Where "החלה" puts the gradient: the board's background, or a chosen element. */
  applyLabel,
  onApply,
  onPreview,
  current,
  of,
}: {
  applyLabel: string;
  /** Whose gradient it is ("הלוח", "התיבות"), when there are two on the page. */
  of?: string;
  onApply: (value: string | null) => void;
  /**
   * Shows what is being built on the board itself, without saving it.
   * Must be stable, or the effect below fires on every render.
   */
  onPreview?: (value: string | null) => void;
  current: string | null;
}) {
  const simple = useMemo(() => parseSimple(current), [current]);
  const [kind, setKind] = useState<"linear" | "radial">(simple?.kind ?? "linear");
  const [angle, setAngle] = useState(simple?.angle ?? DEFAULT_ANGLE);
  const [from, setFrom] = useState(simple?.from ?? "#0b1628");
  const [to, setTo] = useState(simple?.to ?? "#1b3054");
  // Anything the two-colour controls cannot express is kept verbatim here.
  const [advanced, setAdvanced] = useState(current && !simple ? current : "");

  // Follow the board when the gradient changes elsewhere (a preset, an undo).
  useEffect(() => {
    const parsed = parseSimple(current);
    if (parsed) {
      setKind(parsed.kind);
      setAngle(parsed.angle);
      setFrom(parsed.from);
      setTo(parsed.to);
      setAdvanced("");
    } else if (current) setAdvanced(current);
  }, [current]);

  const built = advanced.trim() ? advanced.trim() : build(kind, angle, from, to);
  const valid = isSafeGradient(built);
  // Every turn of a dial reaches the board. Nothing is written down: this
  // is the board wearing it, so the judgement is made on the wall and not
  // on a twenty-pixel strip in a side panel.
  /**
   * Only after the first deliberate change.
   *
   * The controls hold a default gradient before anybody touches them, and
   * previewing that would paint the board the moment this tab is opened -
   * an edit nobody asked for, on a board that was fine.
   */
  const [touched, setTouched] = useState(false);

  const previewing = Boolean(onPreview) && touched && valid && built !== current;
  useEffect(() => {
    if (!touched) return;
    onPreview?.(valid ? built : null);
  }, [built, valid, touched, onPreview]);

  // Leaving the control puts the board back to what is actually saved.
  useEffect(() => () => onPreview?.(null), [onPreview]);

  return (
    <div className="space-y-3">
      {/* the gradient being built, big enough to judge */}
      <div className="space-y-2">
        <div
          className="h-20 rounded-lg border shadow-inner"
          style={{ backgroundImage: valid ? built : undefined }}
        />
        {previewing && (
          // A state, not an explanation: in sight while it lasts.
          <p className="text-[11px] text-muted-foreground">
            כך זה נראה על הלוח עכשיו. עוד לא נשמר - ״{applyLabel}״ מקבע, ויציאה מכאן מחזירה את
            הקודם.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={() => onApply(built)} disabled={!valid}>
            <Check className="size-4" /> {applyLabel}
          </Button>
          <span className="text-xs text-muted-foreground">
            {valid ? "" : "הקוד אינו מעבר צבעים תקין"}
          </span>
        </div>
      </div>

      {/* the two-colour controls */}
      <div className="space-y-2">
        <Segments
          label={of ? `סוג מעבר הצבעים של ${of}` : "סוג מעבר הצבעים"}
          value={kind}
          onChange={(k) => {
            setTouched(true);
            setKind(k);
            setAdvanced("");
          }}
          options={[
            { id: "linear", name: "ישר" },
            { id: "radial", name: "מעגלי" },
          ]}
        />
        <ColourRow
          label="צבע ראשון"
          value={from}
          onChange={(hex) => {
            setTouched(true);
            setFrom(hex);
            setAdvanced("");
          }}
        />
        <ColourRow
          label="צבע שני"
          value={to}
          onChange={(hex) => {
            setTouched(true);
            setTo(hex);
            setAdvanced("");
          }}
        />
        {kind === "linear" && (
          <Range
            label={of ? `זווית מעבר הצבעים של ${of}` : "זווית מעבר הצבעים"}
            value={angle}
            min={0}
            max={360}
            step={5}
            show={(v) => `${v}°`}
            onChange={(v) => {
              setTouched(true);
              setAngle(v);
              setAdvanced("");
            }}
          />
        )}
      </div>

      {/* raw CSS, for anything the controls above cannot express */}
      <details className="rounded-md border bg-muted/40 p-2">
        <summary className="cursor-pointer text-xs font-medium">
          קוד צבעים מתקדם (שלושה צבעים, שקיפות, מעבר סביב נקודה…)
        </summary>
        <Input
          dir="ltr"
          value={advanced}
          onChange={(e) => {
            setTouched(true);
            setAdvanced(e.target.value);
          }}
          placeholder="כותבים כאן את קוד מעבר הצבעים, או מדביקים אותו"
          className={`mt-2 h-8 font-mono text-xs ${
            advanced && !isSafeGradient(advanced) ? "border-destructive" : ""
          }`}
          aria-label={of ? `מעבר הצבעים של ${of} (קוד)` : "קוד מעבר הצבעים"}
        />
        <Hint>
          מה שנכתב כאן נשמר בדיוק כפי שהוא. שינוי של אחד הבקרים שלמעלה מחליף אותו במעבר צבעים פשוט.
        </Hint>
      </details>
    </div>
  );
}

/* ------------------------------------------------ import / export UI -- */

/**
 * The old file of colours (צבעי בסיס, מעברי צבע and the shape of a board from
 * the tablets' editor) - "קובץ ישן" in the tools tab's "ייבוא וייצוא", under
 * the package of the whole board. An import asks first, from a file and from
 * pasted text alike; it adds and never deletes. (Its export of the gradients
 * alone is gone: nothing in the editor makes a gradient of its own but this
 * import, and "הכול" carries them.)
 */
export function TransferPanel({
  onExport,
  onImport,
}: {
  onExport: (what: "themes" | "gradients" | "all", how: "file" | "clipboard") => void;
  onImport: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const importAsked = async (body: string) => {
    const ok = await confirmAction({
      title: "לייבא מהקובץ?",
      description: 'צבעי הבסיס ומעברי הצבע יתווספו למה שקיים, בלי למחוק כלום. שם שכבר תפוס יקבל מספר. הכול נשאר טיוטה עד "שמור ושדר".',
      confirmLabel: "ייבוא",
      destructive: false,
    });
    if (!ok) return false;
    onImport(body);
    return true;
  };
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="text-xs font-medium text-muted-foreground">
          ייצוא - לגיבוי או להעברה לבית כנסת אחר
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "הכול + מבנה הלוח"],
              ["themes", "צבעי בסיס"],
            ] as const
          ).map(([what, label]) => (
            <Button
              key={what}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onExport(what, "file")}
            >
              <Download className="size-4" /> {label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onExport("all", "clipboard")}
          >
            העתקה (להדבקה במקום אחר)
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-medium text-muted-foreground">ייבוא קובץ ישן</div>
        <Hint>
          קובץ מעורך לוחות הברית מביא גם את מבנה הלוח: קשת או פינות, רקע, מרווחים, גודל טקסט ושם
          בית הכנסת. הכול נכנס לטיוטה עד "שמור ושדר".
        </Hint>
        <div className="flex flex-wrap items-center gap-2">
          <FileButton
            label="ייבוא קובץ ישן"
            ariaLabel="ייבוא קובץ ישן של צבעים"
            accept="application/json,.json"
            icon={<Upload className="size-4" aria-hidden />}
            onFiles={async ([file]) => void importAsked(await file.text())}
          />
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
            {open ? <X className="size-4" /> : null} {open ? "סגירה" : "או הדבקת טקסט"}
          </Button>
        </div>
        {open && (
          <div className="space-y-2">
            <textarea
              dir="ltr"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              aria-label="תוכן הקובץ לייבוא"
              placeholder="מדביקים כאן את כל התוכן של הקובץ"
              className="w-full rounded-md border bg-background p-2 font-mono text-xs"
            />
            <Button type="button" size="sm" disabled={!text.trim()} onClick={async () => { if (await importAsked(text)) setText(""); }}>
              ייבוא
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
