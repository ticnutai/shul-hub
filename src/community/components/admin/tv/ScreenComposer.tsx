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
import { Fragment } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { BLOCKS, BLOCK_BY_ID } from "@/tv/blocks";
import type { BlockArea, BlockId, Screen, TvConfig } from "@/tv/config";
import { DAY_BLOCKS, dayScreen, place, readScreens } from "@/tv/screens";

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
  { title: "תוכן", ids: BLOCKS.filter((b) => !b.chrome && !DAY_BLOCKS.includes(b.id)).map((b) => b.id) },
];

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
}) {
  // A board that never opened the composer is read from its old fields, so
  // the first thing shown is the board as it is now, not an empty sheet.
  const screens = ordinaryScreens(config);
  const index = Math.min(current, screens.length - 1);
  const screen = screens[index];

  const write = (next: Screen[], goTo = index) =>
    onChange(next, Math.max(0, Math.min(goTo, next.length - 1)));

  const editScreen = (patch: Partial<Screen>) =>
    write(screens.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const toggle = (id: BlockId, on: boolean) =>
    editScreen({
      blocks: on
        ? [...screen.blocks, { block: id }]
        : screen.blocks.filter((b) => b.block !== id),
    });

  const setArea = (id: BlockId, area: string) =>
    editScreen({
      blocks: screen.blocks.map((b) =>
        b.block !== id ? b : area === "auto" ? { block: id } : { block: id, area: area as BlockArea },
      ),
    });

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

  const rows = place(screen.blocks);
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
                aria-current={i === index}
                onClick={() => onSelect(i, s)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition ${
                  i === index ? "border-primary ring-2 ring-primary ring-offset-1" : "hover:border-primary/50"
                }`}
              >
                <span className="tabular-nums text-xs text-muted-foreground">{i + 1}</span>
                <span>{s.name}</span>
                {empty(s) && (
                  <span className="rounded bg-amber-100 px-1 text-[10px] text-amber-900">לא יוצג</span>
                )}
                {screens.length > 1 && (
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`הסר את ${s.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      write(screens.filter((_, j) => j !== i), Math.max(0, i - 1));
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
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {ordinary > 1
              ? `${ordinary} מסכים — הלוח מתחלף ביניהם, וחץ בשלט מדלג.`
              : "מסך אחד — הלוח עומד. אין סיבוב ואין מה לדלג."}
            {" מה שמוצג בשבת ובחגים - בלשונית מועדים."}
            {shown < screens.length &&
              ` ${screens.length - shown === 1 ? "מסך אחד ריק ולא יוצג" : `${screens.length - shown} מסכים ריקים ולא יוצגו`} — סמנו בו תוכן, או הסירו אותו.`}
          </p>
        </div>

        {/* ------------------------------------------- name and seconds -- */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[10rem] flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="composer-name">
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
              <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="composer-seconds">
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

        {/* ------------------------------------------------- the sketch -- */}
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">
            איך זה יסתדר על המסך
          </div>
          <div
            dir="rtl"
            data-testid="composer-sketch"
            className="grid aspect-video gap-1.5 rounded-lg border bg-[#0b1628] p-2 text-[#f0c35c]"
            style={{ gridTemplateRows: "auto minmax(0,1fr) auto" }}
          >
            <Sketch ids={screen.blocks.filter((b) => BLOCK_BY_ID[b.block].zone === "top").map((b) => b.block)} />
            <div className="grid min-h-0 gap-1.5" style={{ gridAutoRows: "minmax(0,1fr)" }}>
              {rows.length === 0 ? (
                <div className="grid place-items-center rounded border border-dashed border-[#f0c35c]/30 text-[11px] opacity-60">
                  אין עדיין תוכן במסך הזה, ולכן הוא לא יוצג בלוח. סמנו תוכן מהרשימה.
                </div>
              ) : (
                rows.map((row, i) => (
                  <div key={i} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0,1fr))` }}>
                    {row.map((b) => (
                      <div
                        key={b.block}
                        className="min-w-0 truncate rounded border border-[#f0c35c]/35 bg-white/5 px-2 py-1 text-[11px]"
                      >
                        {BLOCK_BY_ID[b.block].name}
                        {b.area && <span className="opacity-60"> · נעוץ</span>}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
            <Sketch ids={screen.blocks.filter((b) => BLOCK_BY_ID[b.block].zone === "bottom").map((b) => b.block)} />
          </div>
        </div>
      </div>

      {/* --------------------------------------------------- the switches -- */}
      <div className="rounded-xl border bg-card p-3">
        <h4 className="text-sm font-semibold">מה יופיע במסך הזה</h4>
        <div className="mt-2 space-y-3">
          {GROUPS.map((group) => (
            <Fragment key={group.title}>
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {group.title}
              </div>
              <div className="space-y-1">
                {group.ids.map((id) => {
                  const spec = BLOCK_BY_ID[id];
                  const checked = on(id);
                  return (
                    <div key={id} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50">
                      <Switch
                        id={`block-${id}`}
                        checked={checked}
                        onCheckedChange={(v) => toggle(id, v)}
                        aria-label={spec.name}
                      />
                      <label htmlFor={`block-${id}`} className="min-w-0 flex-1 cursor-pointer">
                        <span className="block text-sm leading-tight">{spec.name}</span>
                        {spec.note && (
                          <span className="block text-[11px] leading-tight text-muted-foreground">{spec.note}</span>
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
        </p>
      </div>
    </div>
  );
}

/** The thin bars above and below; they carry a name and nothing else. */
function Sketch({ ids }: { ids: BlockId[] }) {
  if (!ids.length) return <div aria-hidden className="h-1" />;
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${ids.length}, minmax(0,1fr))` }}>
      {ids.map((id) => (
        <div key={id} className="truncate rounded border border-[#f0c35c]/25 px-2 py-0.5 text-[10px] opacity-80">
          {BLOCK_BY_ID[id].name}
        </div>
      ))}
    </div>
  );
}
