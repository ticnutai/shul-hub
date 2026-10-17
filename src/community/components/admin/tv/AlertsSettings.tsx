/**
 * The countdown reminders, in one place: when they come (which times, in
 * which steps - for every time, or a time with minutes of its own), a
 * simulation that runs the board's preview up to a time through those steps,
 * how they look (colours, shape, size, where on the board), and the count to
 * the next minyan beside them. A picture of the card stands at the side and
 * changes with every choice.
 */
import { useState, type CSSProperties } from "react";
import { Pause, Play, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ALERT_EVENT_LABELS, DEFAULT_ALERT_LOOK, type AlertEvent, type AlertLook, type AlertMinutes, type TvConfig } from "@/tv/config";
import { themeStyle } from "@/tv/themes";
import { ALERT_ICONS, ALERT_PRESETS, alertLookVars, formatCountdown } from "@/tv/zmanAlerts";
import { alertTimeline, whatShows, type SimSpeed, type TimelineMark } from "@/tv/alertDemo";
import type { AlertSimulation } from "./alertSimulation";
import { ColourRow, Segments, Stepper, SwitchRow } from "./editorParts";
import { itemChipClass } from "./Notice";
import { ChipRemove } from "./ReadyShelf";

type Edit = (key: string, update: (c: TvConfig) => TvConfig) => void;
/** A connected screen the simulation can be sent to: is it on now, and does its app show it (1.40 and on). */
export interface ExampleScreen { id: string; name: string; online: boolean; shows: boolean }

/** A time's name, without the note that candle lighting is on Friday. */
const eventName = (e: AlertEvent) => ALERT_EVENT_LABELS[e].replace(" (בערב שבת)", "");
const hhmm = (d: Date) => d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });

const STYLES: [AlertLook["style"], string][] = [
  ["theme", "צבעי הלוח"], ["night", "לילה וזהב"], ["gold", "זהב בהיר"], ["parchment", "קלף"], ["crimson", "אדום דחוף"], ["custom", "צבעים שלי"],
];
const SHAPES: [AlertLook["shape"], string][] = [["rounded", "פינות מעוגלות"], ["square", "ישר"], ["pill", "אליפסה"], ["arch", "קשת"]];
const SIZES: [AlertLook["size"], string][] = [["small", "קטן"], ["medium", "בינוני"], ["large", "גדול"]];
const POSITIONS: [AlertLook["position"], string][] = [["top", "למעלה"], ["center", "באמצע"], ["bottom", "למטה"]];
const DIMS: [AlertLook["dim"], string][] = [["strong", "מוחשך"], ["soft", "מוחשך מעט"], ["none", "בלי החשכה"]];
const ICONS: [AlertLook["icon"], string][] = [["hourglass", "שעון חול"], ["clock", "שעון"], ["candle", "נר"], ["none", "בלי סמל"]];

/** A choice of a few, under its name: the editor's one Segments. */
function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <Segments label={label} value={value} onChange={onChange} options={options.map(([id, name]) => ({ id, name }))} />
    </div>
  );
}

function Minutes({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="min-w-[9rem]">{label}</span>
      <Stepper label={label} value={value} min={0} max={120} step={1} format={(v) => (v ? `${v} דקות` : "כבוי")} onChange={onChange} />
      <span className="text-xs text-muted-foreground">{value ? hint : "השלב כבוי"}</span>
    </div>
  );
}

function LeadMinutes({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const [adding, setAdding] = useState(10);
  const add = () => onChange([...new Set([...value, adding])].sort((a, b) => b - a).slice(0, 5));
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      הכרטיס קופץ לפני:
      {value.map((m) => (
        <span key={m} className={itemChipClass("text-sm")}>
          {m} דקות
          <ChipRemove label={`הסרת התזכורת של ${m} דקות`} onClick={() => onChange(value.filter((x) => x !== m))} />
        </span>
      ))}
      {value.length < 5 && (
        <span className="inline-flex items-center gap-1">
          <Stepper label="דקות לתזכורת נוספת" value={adding} min={1} max={180} step={1} format={(v) => `${v} דקות`} onChange={setAdding} />
          <Button type="button" variant="outline" size="sm" onClick={add}>הוספה</Button>
        </span>
      )}
    </div>
  );
}

export function AlertsSettings({ config, countdown, edit, simulation, screens = [], onSend }: {
  config: TvConfig;
  /** The count to the next minyan, as the screen being edited has it. */
  countdown: boolean;
  edit: Edit;
  /** The simulation on the board's preview (alertSimulation.ts); without it, none shown. */
  simulation?: AlertSimulation;
  /** The connected screens the simulation can be sent to ("all" - every one). */
  screens?: ExampleScreen[];
  onSend?: (to: string) => void;
}) {
  const a = config.alerts;
  const look = a.look;
  const staged = a.mode === "staged";
  const setAlerts = (key: string, patch: Partial<TvConfig["alerts"]>) => edit(`al-${key}`, (c) => ({ ...c, alerts: { ...c.alerts, ...patch } }));
  const setLook = (patch: Partial<AlertLook>) => edit(`al-look:${Object.keys(patch).join(",")}`, (c) => ({ ...c, alerts: { ...c.alerts, look: { ...c.alerts.look, ...patch } } }));

  // Whose minutes are edited: every time's, or one time's own. A time no longer chosen is every time's again.
  const [chosenTarget, setTarget] = useState<AlertEvent | "all">("all");
  const target = chosenTarget !== "all" && a.events.includes(chosenTarget) ? chosenTarget : "all";
  const own = target === "all" ? undefined : a.own[target];
  const mins: AlertMinutes = own ?? { stages: a.stages, leadMinutes: a.leadMinutes };
  const setMins = (key: string, patch: Partial<AlertMinutes>) =>
    target === "all"
      ? setAlerts(key, patch)
      : setAlerts(`own:${target}:${key}`, { own: { ...a.own, [target]: { ...mins, ...patch } } });
  const setOwn = (on: boolean) => {
    if (target === "all") return;
    const rest = { ...a.own };
    delete rest[target];
    setAlerts(`own:${target}`, { own: on ? { ...rest, [target]: { stages: a.stages, leadMinutes: a.leadMinutes } } : rest });
  };
  const choose = (t: AlertEvent | "all") => {
    setTarget(t);
    // The simulation runs up to the time being worked on.
    if (t !== "all") simulation?.setEvent(t);
  };
  // Steps in order: setting one keeps the others around it in order.
  const setStage = (k: keyof AlertMinutes["stages"], v: number) => {
    const s = { ...mins.stages, [k]: v };
    if (k === "highlight") { if (s.panel > v && v) s.panel = v; if (s.board > (s.panel || v) && v) s.board = s.panel || v; }
    if (k === "panel") { if (v > s.highlight && s.highlight) s.highlight = v; if (s.board > v && v) s.board = v; }
    if (k === "board") { if (v > s.panel && s.panel) s.panel = v; if (v > s.highlight && s.highlight) s.highlight = v; }
    setMins("stages", { stages: s });
  };
  const colours = look.style === "custom" ? look.colors : look.style === "theme" ? null : ALERT_PRESETS[look.style];

  return (
    <div className="space-y-5" data-testid="alerts-settings">
      {/* ------------------------------------------------------------ when */}
      <section className="space-y-3" aria-label="מתי">
        <h4 className="text-sm font-semibold">מתי</h4>
        <SwitchRow label="תזכורות פעילות" note="בשבת ובחג הן כבויות" ariaLabel="תזכורות פעילות" checked={a.enabled} onChange={(on) => setAlerts("on", { enabled: on })} />
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
        <div className="space-y-2 rounded-lg border p-3" data-testid="alert-minutes">
          {a.events.length > 0 && (
            <label className="flex flex-wrap items-center gap-2 text-sm">
              הדקות של:
              <select aria-label="הדקות של" className="h-8 rounded-md border bg-background px-2 text-sm" value={target}
                onChange={(e) => choose(e.target.value as AlertEvent | "all")}>
                <option value="all">כל הזמנים</option>
                {a.events.map((e) => (
                  <option key={e} value={e}>{eventName(e)}{a.own[e] ? " (דקות משלו)" : ""}</option>
                ))}
              </select>
            </label>
          )}
          {target !== "all" && (
            <SwitchRow label={`דקות משלו ל${eventName(target)}`} note={own ? "רק לזמן הזה" : "כרגע כמו כל הזמנים"} ariaLabel="דקות משלו לזמן הזה" checked={Boolean(own)} onChange={setOwn} />
          )}
          {(target === "all" || own) && (staged ? (
            <div className="space-y-2" data-testid="alert-stages">
              <Minutes label="1. סימון הזמן ברשימה" value={mins.stages.highlight} onChange={(v) => setStage("highlight", v)} hint="דקות לפני: הזמן מודגש בזמני היום" />
              <Minutes label="2. ספירה במקום התפילות" value={mins.stages.panel} onChange={(v) => setStage("panel", v)} hint="דקות לפני: ספירה לאחור במקום רשימת התפילות" />
              <Minutes label="3. ספירה על כל הלוח" value={mins.stages.board} onChange={(v) => setStage("board", v)} hint="דקות לפני: כרטיס גדול על הלוח, עד שהזמן מגיע" />
              <p className="text-xs text-muted-foreground">0 מדלג על השלב. השלבים תמיד בסדר: הסימון קודם, אחר כך הספירה במקום התפילות, ובסוף הספירה על כל הלוח.</p>
            </div>
          ) : (
            <LeadMinutes value={mins.leadMinutes} onChange={(leads) => setMins("leads", { leadMinutes: leads })} />
          ))}
          {!staged && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              הכרטיס נשאר על המסך
              <Stepper label="משך הצגת הכרטיס בשניות" value={a.popupSeconds} min={10} max={180} step={5} format={(v) => `${v} שניות`}
                onChange={(v) => setAlerts("sec", { popupSeconds: v })} />
              בין הכרטיסים - פס קטן עם ספירה בתחתית הלוח.
            </div>
          )}
          {target === "all" && a.events.some((e) => a.own[e]) && (
            <p className="text-xs text-muted-foreground">
              עם דקות משלהם: {a.events.filter((e) => a.own[e]).map(eventName).join(", ")}.
            </p>
          )}
        </div>
        {simulation && a.enabled && <Simulation alerts={a} sim={simulation} screens={screens} onSend={onSend} />}
      </section>

      {/* ------------------------------------------------------------ look */}
      <section className="space-y-3" aria-label="איך זה נראה">
        <h4 className="text-sm font-semibold">איך זה נראה</h4>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
          <div className="space-y-3">
            <Choice label="צבעים" value={look.style} options={STYLES} onChange={(v) => setLook({ style: v })} />
            {look.style === "custom" && (
              <div className="grid max-w-xs gap-2">
                <ColourRow label="רקע התזכורת" value={look.colors.bg} onChange={(c) => setLook({ colors: { ...look.colors, bg: c } })} />
                <ColourRow label="כתב התזכורת" value={look.colors.text} onChange={(c) => setLook({ colors: { ...look.colors, text: c } })} />
                <ColourRow label="ספרות ומסגרת התזכורת" value={look.colors.accent} onChange={(c) => setLook({ colors: { ...look.colors, accent: c } })} />
              </div>
            )}
            <Choice label="צורה" value={look.shape} options={SHAPES} onChange={(v) => setLook({ shape: v })} />
            <Choice label="גודל" value={look.size} options={SIZES} onChange={(v) => setLook({ size: v })} />
            <Choice label="מיקום הכרטיס על הלוח" value={look.position} options={POSITIONS} onChange={(v) => setLook({ position: v })} />
            <Choice label="הלוח מאחורי הכרטיס" value={look.dim} options={DIMS} onChange={(v) => setLook({ dim: v })} />
            <Choice label="סמל" value={look.icon} options={ICONS} onChange={(v) => setLook({ icon: v })} />
            {JSON.stringify(look) !== JSON.stringify(DEFAULT_ALERT_LOOK) && (
              <Button type="button" variant="link" size="sm" className="h-7 px-0 text-xs" onClick={() => setLook(DEFAULT_ALERT_LOOK)}>חזרה למראה הרגיל</Button>
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
            <p className="text-[11px] text-muted-foreground">את התזכורת על הלוח עצמו, בכל שלב, רואים בהדמיה שבקטע "מתי".</p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- next minyan count */}
      <section className="space-y-2 border-t pt-4" aria-label="ספירה לתפילה הבאה">
        <h4 className="text-sm font-semibold">ספירה לתפילה הבאה</h4>
        <SwitchRow
          label="שורה מתחת לזמני התפילות שסופרת כמה נשאר למניין הבא"
          ariaLabel="ספירה לתפילה הבאה"
          checked={countdown}
          onChange={(on) => edit("cd-on", (c) => ({ ...c, countdown: { ...c.countdown, enabled: on } }))}
        />
        <p className="text-xs text-muted-foreground">פועלת בפריסת "לוח מלא". זו לא תזכורת לסוף זמן - רק ספירה למניין הבא, בשורה קטנה.</p>
      </section>
    </div>
  );
}

/**
 * The steps before a time on a line - when each comes, in minutes before it -
 * and where the simulation stands; a step is a button that jumps the board's
 * preview to it.
 */
function Timeline({ marks, from, position, onJump }: { marks: TimelineMark[]; from: number; position: number | null; onJump: (minutes: number) => void }) {
  // Right to left, as the page reads: the start on the right, the time itself on the left.
  const at = (minutes: number) => `${(Math.min(from, Math.max(0, from - minutes)) / from) * 100}%`;
  return (
    <div className="space-y-2" data-testid="alert-timeline">
      <div className="relative mx-2 h-4" aria-hidden>
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-border" />
        {marks.map((m) => (
          <span key={m.minutes} className={`absolute top-1/2 size-2.5 -translate-y-1/2 translate-x-1/2 rounded-full ${m.minutes ? "bg-primary" : "bg-destructive"}`} style={{ right: at(m.minutes) }} title={m.label} />
        ))}
        {position !== null && (
          <span className="absolute -top-0.5 h-5 w-1 translate-x-1/2 rounded bg-amber-500" style={{ right: at(position) }} data-testid="timeline-now" />
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {marks.map((m) => (
          <Button key={m.minutes} type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => onJump(m.minutes)}>
            {m.minutes ? `${m.minutes} דקות לפני: ${m.label}` : m.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * The simulation: the board's preview run up to a time through its steps -
 * played, paused, faster, or jumped to a step - and sent to a connected
 * screen from where it stands.
 */
function Simulation({ alerts, sim, screens, onSend }: { alerts: TvConfig["alerts"]; sim: AlertSimulation; screens: ExampleScreen[]; onSend?: (to: string) => void }) {
  if (!sim.event || !sim.at) {
    return (
      <p className="text-xs text-muted-foreground" data-testid="alert-simulation">
        אין {sim.dayNote} זמן מהזמנים שנבחרו שאפשר להדגים (הדלקת נרות - רק בערב שבת).
      </p>
    );
  }
  const { marks, from } = alertTimeline(alerts, sim.event);
  const left = sim.moment ? Math.round((sim.at.getTime() - sim.moment.getTime()) / 1000) : null;
  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3" data-testid="alert-simulation">
      <div className="text-sm font-medium">
        הדמיה על הלוח: {eventName(sim.event)} {sim.dayNote} בשעה <span dir="ltr">{hhmm(sim.at)}</span>
        {alerts.own[sim.event] ? " (דקות משלו)" : ""}
      </div>
      <Timeline marks={marks} from={from} position={left === null ? null : left / 60} onJump={sim.jump} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={sim.playing ? sim.pause : sim.play}>
          {sim.playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          {sim.playing ? "השהיית ההדמיה" : sim.moment ? "המשך ההדמיה" : "הפעלת ההדמיה"}
        </Button>
        {sim.moment && (
          <Button type="button" variant="ghost" size="sm" onClick={sim.stop}>
            סיום - חזרה לזמן אמת
          </Button>
        )}
        <Segments
          label="מהירות ההדמיה"
          value={String(sim.speed)}
          onChange={(v) => sim.setSpeed(Number(v) as SimSpeed)}
          options={[{ id: "1", name: "רגיל" }, { id: "10", name: "פי 10" }, { id: "60", name: "פי 60" }]}
        />
      </div>
      <p className="text-xs text-muted-foreground" data-testid="simulation-readout">
        {sim.moment && left !== null
          ? `${left > 0 ? `נשארו ${formatCountdown(left)}` : "הזמן עבר"} · על הלוח: ${whatShows(alerts, sim.event, sim.at, sim.moment)}`
          : `ההדמיה מתחילה ${from} דקות לפני ${eventName(sim.event)} ורצה עד דקה אחריו, על התצוגה של הלוח. לחיצה על שלב קופצת אליו.`}
      </p>
      {onSend && <SendToScreen screens={screens} onSend={onSend} />}
    </div>
  );
}

/**
 * The simulation on a connected screen too: the board itself, its clock
 * running from where the simulation stands, at its speed, marked "דוגמה" -
 * and what to expect of the screen chosen.
 */
function SendToScreen({ screens, onSend }: { screens: ExampleScreen[]; onSend: (to: string) => void }) {
  const [screen, setScreen] = useState("");
  const chosen = screens.find((s) => s.id === screen);
  const old = screen === "all" ? screens.filter((s) => !s.shows) : chosen && !chosen.shows ? [chosen] : [];
  return (
    <div className="space-y-1 border-t pt-2" data-testid="alert-example-screen">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-2">
          גם על מסך מחובר:
          <select aria-label="מסך מחובר להדמיה" className="h-8 rounded-md border bg-background px-2 text-sm" value={screen} disabled={!screens.length}
            onChange={(e) => setScreen(e.target.value)}>
            <option value="">בחירת מסך</option>
            {screens.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.online ? "" : " (לא מחובר עכשיו)"}</option>
            ))}
            {screens.length > 1 && <option value="all">כל המסכים</option>}
          </select>
        </label>
        <Button type="button" variant="outline" size="sm" disabled={!screen} onClick={() => onSend(screen)}>
          <Send className="size-4" aria-hidden /> שליחה למסך
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {!screens.length
          ? 'אין מסך מאושר - מצמידים מסך בלשונית "מסכים מחוברים".'
          : 'ההדמיה רצה על המסך מהרגע שבו היא עומדת כאן ובאותה מהירות, עד קצת אחרי הזמן (עד דקה), עם הכיתוב "דוגמה". אחר כך המסך חוזר לעצמו. ההגדרות כפי שהן כאן - גם לפני שמירה.'}
        {old.length > 0 && ` ${old.map((s) => s.name).join(", ")}: האפליקציה ישנה - יופיע רק הסבר שצריך לעדכן אותה לגרסה 1.40.`}
        {chosen && !chosen.online && " המסך הזה לא מחובר עכשיו - ההדמיה תופיע כשיתחבר, אם זה יהיה בדקה וחצי הקרובה."}
      </p>
    </div>
  );
}
