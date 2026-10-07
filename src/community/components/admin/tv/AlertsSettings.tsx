/**
 * The countdown reminders, in one place: when they come (which times, and in
 * which steps), how they look (colours, shape, size, where on the board), and
 * the count to the next minyan beside them. A picture of the card stands at
 * the side and changes with every choice; "דוגמה על הלוח" shows it on the
 * board's preview, at the step chosen.
 */
import { useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { BellRing } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ALERT_EVENT_LABELS, DEFAULT_ALERT_LOOK, type AlertEvent, type AlertLook, type TvConfig } from "@/tv/config";
import { themeStyle } from "@/tv/themes";
import { ALERT_ICONS, ALERT_PRESETS, alertLookVars, formatCountdown } from "@/tv/zmanAlerts";
import { ColorPick } from "./ColorPick";

type Edit = (key: string, update: (c: TvConfig) => TvConfig) => void;
export type AlertExample = "board" | "panel" | "chip";

const STYLES: [AlertLook["style"], string][] = [
  ["theme", "צבעי הלוח"], ["night", "לילה וזהב"], ["gold", "זהב בהיר"], ["parchment", "קלף"], ["crimson", "אדום דחוף"], ["custom", "צבעים שלי"],
];
const SHAPES: [AlertLook["shape"], string][] = [["rounded", "פינות מעוגלות"], ["square", "ישר"], ["pill", "אליפסה"], ["arch", "קשת"]];
const SIZES: [AlertLook["size"], string][] = [["small", "קטן"], ["medium", "בינוני"], ["large", "גדול"]];
const POSITIONS: [AlertLook["position"], string][] = [["top", "למעלה"], ["center", "באמצע"], ["bottom", "למטה"]];
const DIMS: [AlertLook["dim"], string][] = [["strong", "מוחשך"], ["soft", "מוחשך מעט"], ["none", "בלי החשכה"]];
const ICONS: [AlertLook["icon"], string][] = [["hourglass", "שעון חול"], ["clock", "שעון"], ["candle", "נר"], ["none", "בלי סמל"]];

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map(([v, name]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
            className={`rounded-md border px-2.5 py-1 text-sm transition ${value === v ? "border-primary bg-primary/10 font-medium text-primary" : "hover:border-primary/50"}`}>
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

function Minutes({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint: string }) {
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <span className="min-w-[9rem]">{label}</span>
      <Input type="number" min={0} max={120} value={value} aria-label={label} className="h-8 w-20"
        onChange={(e) => e.target.value !== "" && onChange(Math.max(0, Math.min(120, Math.round(Number(e.target.value)))))} />
      <span className="text-xs text-muted-foreground">{value ? hint : "כבוי"}</span>
    </label>
  );
}

function LeadMinutes({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const [adding, setAdding] = useState("");
  const add = () => {
    const n = Number(adding);
    if (!Number.isInteger(n) || n < 1 || n > 180) return toast.error("הזינו מספר דקות בין 1 ל-180");
    onChange([...new Set([...value, n])].sort((a, b) => b - a).slice(0, 5));
    setAdding("");
  };
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      הכרטיס קופץ לפני:
      {value.map((m) => (
        <span key={m} className="inline-flex items-center gap-1 rounded-full border bg-secondary px-2.5 py-0.5">
          {m} דק׳
          <button type="button" aria-label={`הסרת התראה של ${m} דקות`} onClick={() => onChange(value.filter((x) => x !== m))} className="text-muted-foreground hover:text-foreground">×</button>
        </span>
      ))}
      {value.length < 5 && (
        <span className="inline-flex items-center gap-1">
          <Input type="number" min={1} max={180} value={adding} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} className="h-8 w-20" aria-label="דקות להתראה נוספת" />
          <Button type="button" variant="outline" size="sm" onClick={add}>הוספה</Button>
        </span>
      )}
    </div>
  );
}

export function AlertsSettings({ config, countdown, edit, onExample }: {
  config: TvConfig;
  /** The count to the next minyan, as the screen being edited has it. */
  countdown: boolean;
  edit: Edit;
  onExample: (what: AlertExample) => void;
}) {
  const a = config.alerts;
  const look = a.look;
  const staged = a.mode === "staged";
  const setAlerts = (key: string, patch: Partial<TvConfig["alerts"]>) => edit(`al-${key}`, (c) => ({ ...c, alerts: { ...c.alerts, ...patch } }));
  const setLook = (patch: Partial<AlertLook>) => edit(`al-look:${Object.keys(patch).join(",")}`, (c) => ({ ...c, alerts: { ...c.alerts, look: { ...c.alerts.look, ...patch } } }));
  // Steps in order: setting one keeps the others around it in order.
  const setStage = (k: keyof TvConfig["alerts"]["stages"], v: number) => {
    const s = { ...a.stages, [k]: v };
    if (k === "highlight") { if (s.panel > v && v) s.panel = v; if (s.board > (s.panel || v) && v) s.board = s.panel || v; }
    if (k === "panel") { if (v > s.highlight && s.highlight) s.highlight = v; if (s.board > v && v) s.board = v; }
    if (k === "board") { if (v > s.panel && s.panel) s.panel = v; if (v > s.highlight && s.highlight) s.highlight = v; }
    setAlerts("stages", { stages: s });
  };
  const colours = look.style === "custom" ? look.colors : look.style === "theme" ? null : ALERT_PRESETS[look.style];

  return (
    <div className="space-y-5" data-testid="alerts-settings">
      {/* ------------------------------------------------------------ when */}
      <section className="space-y-3" aria-label="מתי">
        <h4 className="text-sm font-semibold">מתי</h4>
        <label className="flex items-center gap-3">
          <Switch checked={a.enabled} onCheckedChange={(on) => setAlerts("on", { enabled: on })} aria-label="תזכורות פעילות" />
          תזכורות פעילות
          <span className="text-xs text-muted-foreground">(בשבת ובחג הן כבויות)</span>
        </label>
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">לפני אילו זמנים</div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {(Object.keys(ALERT_EVENT_LABELS) as AlertEvent[]).map((e) => (
              <label key={e} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-primary" checked={a.events.includes(e)}
                  onChange={(ev) => setAlerts(`ev:${e}`, { events: ev.target.checked ? [...a.events, e] : a.events.filter((x) => x !== e) })} />
                {ALERT_EVENT_LABELS[e]}
              </label>
            ))}
          </div>
        </div>
        <Choice label="איך זה מתקדם" value={a.mode} onChange={(m) => setAlerts("mode", { mode: m })}
          options={[["staged", "בשלבים - ככל שהזמן מתקרב, התזכורת גדלה"], ["pulse", "כרטיס שקופץ לרגע בדקות שבוחרים"]]} />
        {staged ? (
          <div className="space-y-2 rounded-lg border p-3" data-testid="alert-stages">
            <Minutes label="1. סימון הזמן ברשימה" value={a.stages.highlight} onChange={(v) => setStage("highlight", v)} hint="דקות לפני: הזמן מודגש בזמני היום" />
            <Minutes label="2. ספירה במקום התפילות" value={a.stages.panel} onChange={(v) => setStage("panel", v)} hint="דקות לפני: ספירה לאחור במקום רשימת התפילות" />
            <Minutes label="3. ספירה על כל הלוח" value={a.stages.board} onChange={(v) => setStage("board", v)} hint="דקות לפני: כרטיס גדול על הלוח, עד שהזמן מגיע" />
            <p className="text-xs text-muted-foreground">0 מדלג על השלב. השלבים תמיד בסדר: הסימון קודם, אחר כך הספירה במקום התפילות, ובסוף הספירה על כל הלוח.</p>
          </div>
        ) : (
          <div className="space-y-2 rounded-lg border p-3">
            <LeadMinutes value={a.leadMinutes} onChange={(leads) => setAlerts("leads", { leadMinutes: leads })} />
            <label className="flex flex-wrap items-center gap-2 text-sm">
              הכרטיס נשאר על המסך
              <Input type="number" min={10} max={180} step={5} value={a.popupSeconds} aria-label="משך הצגת הכרטיס בשניות" className="h-8 w-20"
                onChange={(e) => e.target.value && setAlerts("sec", { popupSeconds: Math.max(10, Math.min(180, Number(e.target.value))) })} />
              שניות. בין הכרטיסים - פס קטן עם ספירה בתחתית הלוח.
            </label>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ look */}
      <section className="space-y-3" aria-label="איך זה נראה">
        <h4 className="text-sm font-semibold">איך זה נראה</h4>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
          <div className="space-y-3">
            <Choice label="צבעים" value={look.style} options={STYLES} onChange={(v) => setLook({ style: v })} />
            {look.style === "custom" && (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="flex items-center gap-1.5">רקע <ColorPick label="רקע התזכורת" value={look.colors.bg} onChange={(c) => setLook({ colors: { ...look.colors, bg: c } })} /></span>
                <span className="flex items-center gap-1.5">כתב <ColorPick label="כתב התזכורת" value={look.colors.text} onChange={(c) => setLook({ colors: { ...look.colors, text: c } })} /></span>
                <span className="flex items-center gap-1.5">ספרות ומסגרת <ColorPick label="ספרות ומסגרת התזכורת" value={look.colors.accent} onChange={(c) => setLook({ colors: { ...look.colors, accent: c } })} /></span>
              </div>
            )}
            <Choice label="צורה" value={look.shape} options={SHAPES} onChange={(v) => setLook({ shape: v })} />
            <Choice label="גודל" value={look.size} options={SIZES} onChange={(v) => setLook({ size: v })} />
            <Choice label="מיקום הכרטיס על הלוח" value={look.position} options={POSITIONS} onChange={(v) => setLook({ position: v })} />
            <Choice label="הלוח מאחורי הכרטיס" value={look.dim} options={DIMS} onChange={(v) => setLook({ dim: v })} />
            <Choice label="סמל" value={look.icon} options={ICONS} onChange={(v) => setLook({ icon: v })} />
            {JSON.stringify(look) !== JSON.stringify(DEFAULT_ALERT_LOOK) && (
              <button type="button" className="text-xs underline" onClick={() => setLook(DEFAULT_ALERT_LOOK)}>חזרה למראה הרגיל</button>
            )}
          </div>
          {/* The card itself, small, in the board's letters and the look chosen. */}
          <div className="space-y-2">
            <div className="tv-frame overflow-hidden rounded-lg border" style={{ height: "auto", aspectRatio: "16 / 9" }} data-testid="alert-look-preview" dir="rtl">
              <div className="tv-root is-layout-rotate"
                style={{ ...themeStyle({ theme: config.theme, customThemes: config.customThemes, overrides: config.themeOverrides, font: config.font }), ...alertLookVars(look), position: "relative", width: "100%", height: "100%" } as CSSProperties}>
                <div className="tv-alert-backdrop" data-position={look.position} data-dim={look.dim} style={{ animation: "none" }}>
                  <div className="tv-alert-card" data-shape={look.shape} style={{ animation: "none" }}>
                    {ALERT_ICONS[look.icon] && <div className="tv-alert-icon">{ALERT_ICONS[look.icon]}</div>}
                    <div className="tv-alert-title">סוף זמן קריאת שמע</div>
                    <div className="tv-alert-countdown">{formatCountdown(8 * 60 + 42)}</div>
                    <div className="tv-alert-sub">בעוד 9 דקות · בשעה 09:33</div>
                  </div>
                </div>
              </div>
            </div>
            {colours && <p className="text-[11px] text-muted-foreground">גם הספירה במקום התפילות והפס הקטן מקבלים את אותם צבעים.</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" disabled={!a.enabled} onClick={() => onExample("board")}>
                <BellRing className="size-4" aria-hidden /> דוגמה על הלוח
              </Button>
              {staged && a.stages.panel > 0 && (
                <Button type="button" variant="outline" size="sm" disabled={!a.enabled} onClick={() => onExample("panel")}>דוגמה: במקום התפילות</Button>
              )}
              {!staged && (
                <Button type="button" variant="outline" size="sm" disabled={!a.enabled} onClick={() => onExample("chip")}>דוגמה: הפס הקטן</Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- next minyan count */}
      <section className="space-y-2 border-t pt-4" aria-label="ספירה לתפילה הבאה">
        <h4 className="text-sm font-semibold">ספירה לתפילה הבאה</h4>
        <label className="flex items-center gap-3">
          <Switch checked={countdown} onCheckedChange={(on) => edit("cd-on", (c) => ({ ...c, countdown: { ...c.countdown, enabled: on } }))} aria-label="ספירה לתפילה הבאה" />
          שורה מתחת לזמני התפילות שסופרת כמה נשאר למניין הבא
        </label>
        <p className="text-xs text-muted-foreground">פועלת בפריסת "לוח מלא". זו לא תזכורת לסוף זמן - רק ספירה למניין הבא, בשורה קטנה.</p>
      </section>
    </div>
  );
}
