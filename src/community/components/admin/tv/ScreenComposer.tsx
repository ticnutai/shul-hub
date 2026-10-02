/**
 * Choosing the screens, and what stands on each.
 *
 * The question a gabbai actually asks is "one screen or several?", and until
 * now no setting answered it. `screenLayout` decided it as a side effect -
 * illustrated and dashboard merge everything into one picture, rotate and
 * split take turns - so the list of slides said four things were on the board
 * while the board showed one, and an arrow on the remote moved nothing. Here
 * the number of screens is the question, asked directly.
 *
 * Every switch below is built from BLOCKS. None of them is written out here,
 * and that is deliberate: a hand-written list of controls is exactly where a
 * new block gets forgotten and a removed one lingers, which is how the board
 * ended up with four names for the panel of prayer times. Add a block to the
 * registry and its switch appears here; the test beside the registry refuses
 * a block that belongs to no one.
 *
 * Placement is one field, not two modes. A block with no `area` is placed by
 * the layout; give it an area and it is pinned. There is no second system to
 * fall out of step with the first, because pinned and automatic are the same
 * field present or absent.
 */
import { Fragment, useMemo, useRef, useState } from "react";
import { BookmarkPlus, CalendarDays, Plus, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { BLOCKS, BLOCK_BY_ID } from "@/tv/blocks";
import type { BlockArea, BlockId, SavedLayout, Screen, TvConfig } from "@/tv/config";
import { DAY_BLOCKS, dayScreen, readScreens } from "@/tv/screens";
import { CARD_BLOCK, nextDateOf, occasionScreenOf, readOccasions, type Occasion } from "@/tv/occasions";
import { arrange, gridOf, tracks } from "@/tv/grid";
import { resolveElementStyle, setElementStyle, styleTargetKey } from "@/tv/boardEdit";
import { SketchEditor, SKETCH_HINT } from "./SketchEditor";

const AREA_LABELS: Record<"auto" | BlockArea, string> = {
  auto: "אוטומטי",
  right: "ימין",
  left: "שמאל",
  wide: "רוחב מלא",
};

/**
 * The blocks, in the order the registry lists them, grouped for the eye.
 * Shabbat and the day's screen are not among them: they are occasions, set
 * in their own tab with everything else about them (occasions.ts).
 */
const GROUPS: { title: string; ids: BlockId[] }[] = [
  { title: "קבוע על כל מסך", ids: BLOCKS.filter((b) => b.chrome).map((b) => b.id) },
  {
    title: "תוכן",
    ids: BLOCKS.filter((b) => !b.chrome && !DAY_BLOCKS.includes(b.id)).map((b) => b.id),
  },
];

/** On an occasion's screen: its card, a block of its own, first. */
const OCCASION_GROUPS: { title: string; ids: BlockId[] }[] = [GROUPS[0], { title: "המועד", ids: [CARD_BLOCK] }, GROUPS[1]];

const DAY_MS = 86_400_000;
/** How far ahead an occasion stands beside the board's screens. */
const OCCASION_DAYS_AHEAD = 7;

/**
 * The occasions of the coming days (Shabbat, a festival, the shul's own), each
 * with its day - shown beside the board's screens, so the screen of a day is
 * built where every screen is built. Only those that have a screen at all.
 */
function upcomingOccasions(config: TvConfig, today: Date): { occasion: Occasion; day: Date; inDays: number }[] {
  const cache = new Map();
  return readOccasions(config)
    .filter((o) => o.enabled && o.display !== "off")
    .flatMap((occasion) => {
      const day = nextDateOf(occasion, today, cache);
      if (!day) return [];
      const inDays = Math.round((day.getTime() - today.getTime()) / DAY_MS);
      return inDays >= 0 && inDays < OCCASION_DAYS_AHEAD ? [{ occasion, day, inDays }] : [];
    })
    .sort((a, b) => a.day.getTime() - b.day.getTime())
    .slice(0, 6);
}

const whenLabel = (inDays: number) => (inDays === 0 ? "היום" : inDays === 1 ? "מחר" : `בעוד ${inDays} ימים`);

/** The ordinary screens: a board's old Shabbat and day screens are occasions now. */
function ordinaryScreens(config: TvConfig): Screen[] {
  const all = readScreens(config)
    .filter((s) => !dayScreen(s))
    .map((s) => ({ ...s, blocks: s.blocks.filter((b) => !DAY_BLOCKS.includes(b.block)) }));
  return all.length ? all : readScreens({ ...config, screens: [] }).filter((s) => !dayScreen(s));
}

export function ScreenComposer({
  config,
  current,
  onChange,
  onSelect,
  onLayouts,
  onEdit,
  onOccasion,
}: {
  config: TvConfig;
  /** Which screen is open for editing; the composer keeps this in the parent. */
  current: number;
  onChange: (screens: Screen[], current: number) => void;
  /**
   * Opening another screen to look at it. Not an edit: it used to go through
   * onChange and so marked the board as changed ("יש שינויים שלא נשמרו")
   * when nothing had been.
   */
  onSelect: (current: number, screen: Screen) => void;
  /** The board's saved arrangements changed (a kit saved or removed). */
  onLayouts: (layouts: SavedLayout[]) => void;
  /**
   * An edit to the board itself, from the sketch: its air above and below the
   * panels, and the strip's size - the same settings, and the same undo
   * steps, as the sliders and the board's own editor.
   */
  onEdit: (key: string, update: (c: TvConfig) => TvConfig) => void;
  /**
   * An occasion's screen opened (null: back to the board's screens), with the
   * day it is for - the preview goes there, since that screen shows only then.
   */
  onOccasion?: (occasion: Occasion | null, day: Date | null) => void;
}) {
  // A board that never opened the composer is read from its old fields, so
  // the first thing shown is the board as it is now, not an empty sheet.
  const screens = ordinaryScreens(config);
  const index = Math.min(current, screens.length - 1);

  // The occasions of the coming days stand beside the screens; one may be open.
  const [today] = useState(() => new Date());
  const upcoming = useMemo(() => upcomingOccasions(config, today), [config, today]);
  const [occasionId, setOccasionId] = useState<string | null>(null);
  const opened = upcoming.find((u) => u.occasion.id === occasionId) ?? null;
  const occasion = opened?.occasion ?? null;
  const screen = occasion ? occasionScreenOf(occasion) : screens[index];

  const write = (next: Screen[], goTo = index) =>
    onChange(next, Math.max(0, Math.min(goTo, next.length - 1)));

  /**
   * An edit to the screen open: one of the board's, or an occasion's - kept on
   * the occasion (its first edit gives it a screen of its own, from what it
   * showed until then). Its card never leaves it: without the card it would
   * not be the occasion's screen.
   */
  const editScreen = (patch: Partial<Screen>) => {
    if (!occasion) return write(screens.map((s, i) => (i === index ? { ...s, ...patch } : s)));
    const id = occasion.id;
    onEdit(`occasion-screen:${id}:${Object.keys(patch).join(",")}`, (c) => ({
      ...c,
      occasions: readOccasions(c).map((o) => {
        if (o.id !== id) return o;
        const next = { ...occasionScreenOf(o), ...patch };
        return next.blocks.some((b) => b.block === CARD_BLOCK) ? { ...o, screen: next } : o;
      }),
    }));
  };
  /** Back to the card over the whole board, as before it was arranged. */
  const unarrange = () => {
    if (!occasion) return;
    const id = occasion.id;
    onEdit(`occasion-screen:${id}:reset`, (c) => ({
      ...c,
      occasions: readOccasions(c).map((o) => (o.id === id ? { ...o, screen: null } : o)),
    }));
  };

  const toggle = (id: BlockId, on: boolean) =>
    editScreen({
      blocks: on ? [...screen.blocks, { block: id }] : screen.blocks.filter((b) => b.block !== id),
    });

  // A "מיקום" chosen in the list is the automatic arrangement again: a hand one would ignore it.
  const setArea = (id: BlockId, area: string) =>
    editScreen({
      blocks: screen.blocks.map((b) =>
        b.block !== id
          ? b
          : area === "auto"
          ? { block: id }
          : { block: id, area: area as BlockArea },
      ),
      grid: undefined,
    });
  const [sketchMessage, setSketchMessage] = useState(SKETCH_HINT);
  const [kitName, setKitName] = useState<string | null>(null);

  /** The screen as it stands now, kept under a name. */
  const saveKit = () => {
    const name = (kitName ?? "").trim();
    if (!name) return;
    const kit: SavedLayout = {
      id: `layout${Date.now().toString(36)}`,
      name: name.slice(0, 40),
      grid: gridOf(rows),
    };
    onLayouts([...config.layouts.filter((l) => l.name !== kit.name), kit].slice(-12));
    setKitName(null);
    setSketchMessage(
      `הסידור נשמר כערכה «${kit.name}». אפשר להחיל אותה על כל מסך, גם אחרי שינויים.`,
    );
  };
  /**
   * A kit put on the screen: its blocks on (and the screen's other content
   * off), standing as they were saved. The bars stay as the screen has them.
   */
  const applyKit = (kit: SavedLayout) => {
    const chrome = screen.blocks.filter((b) => BLOCK_BY_ID[b.block].chrome);
    // An occasion's card stays on its screen: a kit without it gets it on top.
    const keepCard = occasion && !kit.grid.some((r) => r.blocks.includes(CARD_BLOCK));
    const grid = keepCard ? [{ blocks: [CARD_BLOCK], widths: [1], height: 1 }, ...kit.grid] : kit.grid;
    const content = grid.flatMap((r) => r.blocks).map((block) => ({ block }));
    editScreen({ blocks: [...chrome, ...content], grid });
    setSketchMessage(`הוחלה הערכה «${kit.name}» על "${screen.name}".`);
  };
  const removeKit = (kit: SavedLayout) => {
    if (!window.confirm(`למחוק את הערכה «${kit.name}»? המסכים שכבר מסודרים לפיה לא ישתנו.`)) return;
    onLayouts(config.layouts.filter((l) => l.id !== kit.id));
    setSketchMessage(`הערכה «${kit.name}» נמחקה.`);
  };

  const addScreen = () => {
    const n = screens.length + 1;
    write(
      [
        ...screens,
        {
          id: `screen${n}`,
          name: `מסך ${n}`,
          seconds: 15,
          // A new screen starts with the bars, so it is never blank on a wall.
          blocks: BLOCKS.filter((b) => b.chrome).map((b) => ({ block: b.id })),
        },
      ],
      screens.length,
    );
  };

  const rows = arrange(screen.blocks, screen.grid);
  /**
   * A screen of only the bars has nothing between them, and the board skips
   * it rather than show an empty frame for its seconds. It used to skip it
   * without a word here, so a board saved with three screens turned two on
   * the wall and nothing said why.
   */
  const empty = (s: Screen) => !s.blocks.some((b) => !BLOCK_BY_ID[b.block].chrome);
  const shown = screens.filter((s) => !empty(s)).length;
  // The ordinary rotation: what the wall does on a weekday with no festival.
  const ordinary = screens.filter((s) => !empty(s) && !dayScreen(s)).length;
  const on = (id: BlockId) => screen.blocks.some((b) => b.block === id);
  const areaOf = (id: BlockId) => screen.blocks.find((b) => b.block === id)?.area ?? "auto";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]" data-testid="screen-composer">
      <div className="space-y-4">
        {/* ------------------------------------------------ the screens -- */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {screens.map((s, i) => (
              <button
                key={s.id + i}
                type="button"
                aria-current={!occasion && i === index}
                onClick={() => {
                  if (occasion) {
                    setOccasionId(null);
                    onOccasion?.(null, null);
                  }
                  onSelect(i, s);
                }}
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition ${
                  !occasion && i === index
                    ? "border-primary ring-2 ring-primary ring-offset-1"
                    : "hover:border-primary/50"
                }`}
              >
                <span className="tabular-nums text-xs text-muted-foreground">{i + 1}</span>
                <span>{s.name}</span>
                {empty(s) && (
                  <span className="rounded bg-amber-100 px-1 text-[10px] text-amber-900">
                    לא יוצג
                  </span>
                )}
                {screens.length > 1 && (
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`הסר את ${s.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      write(
                        screens.filter((_, j) => j !== i),
                        Math.max(0, i - 1),
                      );
                    }}
                    className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </span>
                )}
              </button>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addScreen}>
              <Plus className="size-4" /> מסך
            </Button>
            {upcoming.map(({ occasion: o, day, inDays }) => (
              <button
                key={o.id}
                type="button"
                aria-current={occasion?.id === o.id}
                data-testid="occasion-screen-tab"
                data-occasion={o.id}
                onClick={() => {
                  setOccasionId(o.id);
                  onOccasion?.(o, day);
                }}
                title={`המסך של ${o.name} - מופיע רק ביום שלו (${whenLabel(inDays)})`}
                className={`flex items-center gap-2 rounded-lg border border-amber-400/70 bg-amber-50 px-3 py-1.5 text-sm text-amber-950 transition dark:bg-amber-950/30 dark:text-amber-100 ${
                  occasion?.id === o.id ? "ring-2 ring-amber-500 ring-offset-1" : "hover:border-amber-500"
                }`}
              >
                <CalendarDays className="size-3.5" aria-hidden />
                <span>{o.name}</span>
                <span className="rounded bg-amber-200/80 px-1 text-[10px] text-amber-950">{whenLabel(inDays)}</span>
              </button>
            ))}
          </div>
          {occasion ? (
            <p className="mt-2 text-xs text-muted-foreground" data-testid="occasion-screen-note">
              {`המסך של ${occasion.name}: מופיע רק ביום שלו, ${whenLabel(opened!.inDays)}. מסדרים אותו כמו כל מסך - מה יופיע ואיפה; `}
              {`"כרטיס המועד" הוא השם, התאריך, הזמנים והתמונות, ומה שבתוכו נקבע בלשונית מועדים.`}
              {occasion.screen ? (
                <button type="button" className="mr-1 underline underline-offset-2 hover:text-foreground" onClick={unarrange}>
                  ביטול הסידור - חזרה לכרטיס על כל הלוח
                </button>
              ) : (
                " עד שתשנו כאן משהו, הכרטיס מכסה את כל הלוח, כמו עד עכשיו."
              )}
            </p>
          ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            {ordinary > 1
              ? `${ordinary} מסכים — הלוח מתחלף ביניהם, וחץ בשלט מדלג.`
              : "מסך אחד — הלוח עומד. אין סיבוב ואין מה לדלג."}
            {" מועדים של הימים הקרובים עומדים כאן ליד המסכים, כל אחד עם המסך שלו."}
            {shown < screens.length &&
              ` ${
                screens.length - shown === 1
                  ? "מסך אחד ריק ולא יוצג"
                  : `${screens.length - shown} מסכים ריקים ולא יוצגו`
              } — סמנו בו תוכן, או הסירו אותו.`}
          </p>
          )}
        </div>

        {/* ------------------------------------------- name and seconds -- */}
        {!occasion && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[10rem] flex-1">
            <label
              className="mb-1 block text-xs font-medium text-muted-foreground"
              htmlFor="composer-name"
            >
              שם המסך
            </label>
            <Input
              id="composer-name"
              value={screen.name}
              onChange={(e) => editScreen({ name: e.target.value })}
            />
          </div>
          {screens.length > 1 && !empty(screen) && (
            <div className="w-28">
              <label
                className="mb-1 block text-xs font-medium text-muted-foreground"
                htmlFor="composer-seconds"
              >
                שניות
              </label>
              <Input
                id="composer-seconds"
                type="number"
                min={3}
                max={600}
                value={screen.seconds}
                onChange={(e) => editScreen({ seconds: Number(e.target.value) || 15 })}
              />
            </div>
          )}
        </div>
        )}

        {/* ------------------------------------------------- the sketch -- */}
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">
            איך זה יסתדר על המסך
          </div>
          <div
            dir="rtl"
            data-testid="composer-sketch"
            // A size container: the air drawn inside it is in cqh, a share of the board's height.
            className="grid aspect-video gap-1.5 rounded-lg border bg-[#0b1628] p-2 text-[#f0c35c] [container-type:size]"
            style={{ gridTemplateRows: "auto minmax(0,1fr) auto" }}
          >
            <Sketch
              ids={screen.blocks
                .filter((b) => BLOCK_BY_ID[b.block].zone === "top")
                .map((b) => b.block)}
            />
            {rows.length === 0 ? (
              <div className="grid place-items-center rounded border border-dashed border-[#f0c35c]/30 text-[11px] opacity-60">
                אין עדיין תוכן במסך הזה, ולכן הוא לא יוצג בלוח. סמנו תוכן מהרשימה.
              </div>
            ) : (
              <SketchEditor
                key={screen.id}
                rows={rows}
                manual={Boolean(screen.grid)}
                onChange={(grid) => editScreen({ grid })}
                onMessage={setSketchMessage}
                spacing={{
                  top: config.spacing.top,
                  bottom: config.spacing.bottom,
                  // What the board leaves when nothing is set (tv.css).
                  fallback:
                    config.screenLayout === "medallion"
                      ? { top: 2.4, bottom: 2.4 }
                      : { top: 2.6, bottom: 1.6 },
                }}
                onSpacing={(edge, value) =>
                  onEdit(`spacing.${edge}`, (c) => ({
                    ...c,
                    spacing: { ...c.spacing, [edge]: value },
                  }))
                }
              />
            )}
            <Sketch
              ids={screen.blocks
                .filter((b) => BLOCK_BY_ID[b.block].zone === "bottom")
                .map((b) => b.block)}
              // The strip is a strip of its own on the medallion and the full board;
              // elsewhere this bar is the row of dots, and its size would change nothing.
              strip={
                config.screenLayout !== "medallion" && config.screenLayout !== "dashboard"
                  ? undefined
                  : {
                      scale: resolveElementStyle(config, "dash.strip")?.scale ?? 1,
                      onScale: (scale) => {
                        onEdit("style:scale:dash.strip", (c) =>
                          setElementStyle(c, styleTargetKey(c, "dash.strip"), { scale }),
                        );
                        setSketchMessage(
                          `גובה שורת הפרשה והנרות: ${
                            scale === 1 ? "רגיל" : `פי ${scale}`
                          }. להזזתה למקום אחר - "עריכה ישירה בלוח".`,
                        );
                      },
                    }
              }
            />
          </div>
          {rows.length > 0 && (
            <div className="mt-1.5 space-y-2">
              <p
                role="status"
                aria-live="polite"
                data-testid="sketch-status"
                className="min-h-[2.4em] text-[11px] leading-snug text-muted-foreground"
              >
                {sketchMessage}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 px-2 text-[11px]"
                  title="שומר את הסידור של המסך הזה בשם, כדי להחיל אותו שוב על כל מסך"
                  onClick={() =>
                    setKitName(kitName === null ? `סידור ${config.layouts.length + 1}` : null)
                  }
                >
                  <BookmarkPlus className="size-3" /> שמירה כערכה
                </Button>
                {screen.grid && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 px-2 text-[11px]"
                    title="מבטל את הסידור הידני של המסך הזה; המסגרות יסודרו לפי ה'מיקום' שברשימה"
                    onClick={() => {
                      editScreen({ grid: undefined });
                      setSketchMessage(
                        "חזרה לסידור האוטומטי: המסגרות מסודרות לפי ה'מיקום' שברשימה.",
                      );
                    }}
                  >
                    <RotateCcw className="size-3" /> סידור אוטומטי
                  </Button>
                )}
              </div>
              {kitName !== null && (
                <div className="mt-1.5 flex items-center gap-2">
                  <Input
                    value={kitName}
                    onChange={(e) => setKitName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveKit()}
                    aria-label="שם הערכה"
                    className="h-8 text-sm"
                    maxLength={40}
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-8"
                    onClick={saveKit}
                    disabled={!kitName.trim()}
                  >
                    שמירה
                  </Button>
                </div>
              )}
              {config.layouts.length > 0 && (
                <div className="mt-2" data-testid="layout-kits">
                  <div className="mb-1 text-[11px] font-medium text-muted-foreground">
                    ערכות סידור - לחיצה מחילה על המסך הזה
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {config.layouts.map((kit) => (
                      <div key={kit.id} className="group relative">
                        <button
                          type="button"
                          onClick={() => applyKit(kit)}
                          title={`החלת «${kit.name}» על "${screen.name}": ${kit.grid
                            .flatMap((r) => r.blocks)
                            .map((b) => BLOCK_BY_ID[b].name)
                            .join(", ")}`}
                          className="flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-xs hover:border-primary"
                        >
                          <KitThumb kit={kit} />
                          {kit.name}
                        </button>
                        <button
                          type="button"
                          aria-label={`מחיקת הערכה ${kit.name}`}
                          onClick={() => removeKit(kit)}
                          className="absolute -left-1.5 -top-1.5 hidden size-4 place-items-center rounded-full bg-destructive text-[10px] text-destructive-foreground group-hover:grid"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --------------------------------------------------- the switches -- */}
      <div className="rounded-xl border bg-card p-3">
        <h4 className="text-sm font-semibold">מה יופיע במסך הזה</h4>
        <div className="mt-2 space-y-3">
          {(occasion ? OCCASION_GROUPS : GROUPS).map((group) => (
            <Fragment key={group.title}>
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {group.title}
              </div>
              <div className="space-y-1">
                {group.ids.map((id) => {
                  const spec = BLOCK_BY_ID[id];
                  const checked = on(id);
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50"
                    >
                      <Switch
                        id={`block-${id}`}
                        checked={checked}
                        // The card is what makes it the occasion's screen.
                        disabled={id === CARD_BLOCK}
                        onCheckedChange={(v) => toggle(id, v)}
                        aria-label={spec.name}
                      />
                      <label htmlFor={`block-${id}`} className="min-w-0 flex-1 cursor-pointer">
                        <span className="block text-sm leading-tight">{spec.name}</span>
                        {spec.note && (
                          <span className="block text-[11px] leading-tight text-muted-foreground">
                            {spec.note}
                          </span>
                        )}
                      </label>
                      {checked && spec.zone === "main" && (
                        <select
                          aria-label={`מיקום של ${spec.name}`}
                          value={areaOf(id)}
                          onChange={(e) => setArea(id, e.target.value)}
                          className="rounded border bg-background px-1 py-0.5 text-[11px]"
                        >
                          {Object.entries(AREA_LABELS).map(([v, label]) => (
                            <option key={v} value={v}>
                              {label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </Fragment>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          בלי מיקום — הפריסה מסדרת לבד לפי מה שסומן. עם מיקום — נעוץ שם, והשאר מסתדרים סביבו.
          {screen.grid &&
            " המסך הזה מסודר ביד בשרטוט; בחירת מיקום כאן מחזירה אותו לסידור האוטומטי."}
        </p>
      </div>
    </div>
  );
}

/**
 * The thin bars above and below; they carry a name. The strip below
 * ("שורת הפרשה והנרות") can be made taller or shorter by dragging its upper
 * edge - its size on the board, the same setting as the board's own editor;
 * where it stands is moved there, on the board.
 */
function Sketch({
  ids,
  strip,
}: {
  ids: BlockId[];
  strip?: { scale: number; onScale: (scale: number) => void };
}) {
  const start = useRef<{ y: number; scale: number } | null>(null);
  if (!ids.length) return <div aria-hidden className="h-1" />;
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${ids.length}, minmax(0,1fr))` }}
    >
      {ids.map((id) => {
        const sized = strip && id === "footer";
        return (
          <div
            key={id}
            data-sketch-bar={id}
            className="relative min-w-0 rounded border border-[#f0c35c]/25 px-2 text-[10px] opacity-80"
            style={{ paddingBlock: sized ? `${Math.round(2 * strip.scale * 10) / 10}px` : "2px" }}
          >
            {/* The name is cut, not the bar: the handle on its edge stands half outside it. */}
            <span className="block truncate">
              {BLOCK_BY_ID[id].name}
              {sized && strip.scale !== 1 && <span className="ms-1 opacity-60">×{strip.scale}</span>}
            </span>
            {sized && (
              <div
                data-sketch-handle="strip"
                role="separator"
                aria-orientation="horizontal"
                aria-label="גובה שורת הפרשה והנרות"
                title="גררו למעלה כדי להגדיל את השורה, למטה כדי להקטין; לחיצה כפולה - רגיל"
                className="absolute left-[12%] right-[12%] -top-[6px] z-10 h-2.5 cursor-ns-resize rounded bg-[#f0c35c]/0 hover:bg-[#f0c35c]/70"
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  start.current = { y: e.clientY, scale: strip.scale };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  const s = start.current;
                  if (!s) return;
                  // 40 px of drag is the strip's whole size again; up is bigger.
                  const next =
                    Math.round(Math.min(2, Math.max(0.5, s.scale + (s.y - e.clientY) / 40)) * 20) /
                    20;
                  if (next !== strip.scale) strip.onScale(next);
                }}
                onPointerUp={(e) => {
                  start.current = null;
                  if (e.currentTarget.hasPointerCapture(e.pointerId))
                    e.currentTarget.releasePointerCapture(e.pointerId);
                }}
                onPointerCancel={() => {
                  start.current = null;
                }}
                onDoubleClick={() => strip.onScale(1)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** A kit's arrangement in miniature: its rows and their proportions. */
function KitThumb({ kit }: { kit: SavedLayout }) {
  return (
    <span
      aria-hidden
      className="grid h-[27px] w-12 shrink-0 gap-[2px] rounded-sm bg-[#0b1628] p-[2px]"
      style={{ gridTemplateRows: tracks(kit.grid.map((r) => r.height)) }}
    >
      {kit.grid.map((r, i) => (
        <span key={i} className="grid gap-[2px]" style={{ gridTemplateColumns: tracks(r.widths) }}>
          {r.blocks.map((b) => (
            <span key={b} className="rounded-[1px] bg-[#f0c35c]/60" />
          ))}
        </span>
      ))}
    </span>
  );
}
