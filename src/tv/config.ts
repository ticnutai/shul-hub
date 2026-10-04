import { normalizeFrameLooks, TITLE_STYLES, type FrameLooks, type TitleStyle } from "./frameLooks";
import { BUILTIN_DESIGNS, normalizeDesigns, type SavedDesign } from "./designs";
import { normalizeBackgrounds, type SavedBackground } from "./backgroundItem";
import { migratePainted } from "./paintedMigration";
import { skinToParts } from "./skinMigration";
import { DEFAULT_BOARD_FRAME_TUNE, normalizeBoardFrameTune, type BoardFrameTune } from "./boardFrame";
import { normalizeOccasions, type Occasion } from "./occasions";
import {
  DEFAULT_BACKGROUND_TUNE,
  DEFAULT_FRAME_STYLE,
  normalizeBackgroundTune,
  normalizeFrameStyle,
  type BackgroundTune,
  type FrameStyle,
} from "./layers";
import { normalizeCustomIllustrations, type CustomIllustration } from "./illustrated";
import type { SolarEvent } from "@community/lib/zmanim";
import type { EventAutoMode } from "@community/lib/specialDays";
import { DEVICE_CLASSES, type DeviceClass } from "./devices";
import {
  CUSTOM_GRADIENT_ID_RE,
  CUSTOM_THEME_ID_RE,
  isSafeFill,
  isSafeGradient,
  type TvGradient,
  isSafeCssValue,
  isSafeUrl,
  THEME_VARS,
  TV_FONTS,
  TV_THEMES,
  type ThemeVar,
  type TvFontId,
  type TvTheme,
} from "./themes";

/**
 * Everything an admin can change about the board, in one JSON document.
 *
 * Stored as a single row (tv_config) so a change is one realtime event and
 * the TV never sees half an update. `normalizeTvConfig` is deliberately
 * forgiving: a value written by a newer admin build, a removed option, or a
 * hand-edited row must still produce a working board, never a blank screen.
 */

export type SlideKind = "prayer" | "learning" | "announcements" | "shiurim" | "slideshow";

/**
 * The composer's vocabulary, declared here and nowhere else.
 *
 * The registry that gives these ids names and sizes lives in blocks.ts, next
 * to the elements it groups. Only the type names sit here, because the config
 * has to be able to describe a screen and blocks.ts has to be able to read
 * the config - putting the ids in blocks.ts would make that a circle.
 */
export type BuiltinBlockId =
  | "header"
  | "logo"
  | "clock"
  | "prayers"
  | "zmanim"
  | "announcements"
  | "shiurim"
  | "learning"
  | "slideshow"
  | "festival"
  | "shabbat"
  | "ticker"
  | "footer";

/**
 * A box the gabbai added by hand (TvConfig.customBoxes): a title and free
 * text, on/off and placed in the composer like any block, and dressed like
 * any box (frameLooks is keyed by the same id).
 */
export type CustomBlockId = `custom:${string}`;
export type BlockId = BuiltinBlockId | CustomBlockId;

export const CUSTOM_BLOCK_RE = /^custom:[a-z0-9]{4,16}$/;
export const isCustomBlock = (id: string): id is CustomBlockId => CUSTOM_BLOCK_RE.test(id);
/** A block the board knows: a built-in one, or a box of its own by a well-formed id. */
export const isKnownBlock = (id: unknown): id is BlockId =>
  typeof id === "string" && ((BLOCK_IDS as readonly string[]).includes(id) || isCustomBlock(id));

export interface CustomBox {
  id: CustomBlockId;
  title: string;
  /** Free text; line breaks are kept. */
  text: string;
}
export const MAX_CUSTOM_BOXES = 12;

export function newCustomBoxId(): CustomBlockId {
  return `custom:${Math.random().toString(36).slice(2, 10)}`;
}

export const BLOCK_IDS: readonly BuiltinBlockId[] = [
  "header", "logo", "clock", "prayers", "zmanim", "announcements",
  "shiurim", "learning", "slideshow", "festival", "shabbat", "ticker", "footer",
];

/** A pinned block's place. Absent means the layout decides. */
export type BlockArea = "right" | "left" | "wide";

export interface BlockEntry {
  block: BlockId;
  area?: BlockArea;
}

export interface Screen {
  id: string;
  name: string;
  /** How long it holds when there is more than one screen. */
  seconds: number;
  blocks: BlockEntry[];
  /**
   * The screen arranged by hand in the composer's sketch (screens.arrange):
   * its rows top to bottom, each with its blocks right to left, their widths
   * and the row's height. Absent: arranged by the blocks' areas, as before.
   */
  grid?: ScreenRow[];
}

/**
 * A hand arrangement kept under a name ("ערכת סידור"), to be put on any
 * screen of the board again: its blocks and how they stand.
 */
export interface SavedLayout {
  id: string;
  name: string;
  grid: ScreenRow[];
}

/** One row of a hand-arranged screen. */
export interface ScreenRow {
  /** Right to left, as on the wall; at most three. */
  blocks: BlockId[];
  /** One per block: its share of the row's width, as a fraction of the row's total. */
  widths: number[];
  /** Its share of the height, against the other rows (1 = as much as any other). */
  height: number;
}

export const SLIDE_KIND_LABELS: Record<SlideKind, string> = {
  prayer: "זמני תפילות",
  learning: "לימוד יומי ולוח שנה",
  announcements: "מודעות",
  shiurim: "שיעורים",
  slideshow: "מצגת תמונות",
};

/** The board's choice of days for the prayer times (TvConfig.prayerDays). */
export const PRAYER_DAYS = ["today", "week_today", "week_fixed"] as const;
export type PrayerDays = (typeof PRAYER_DAYS)[number];
export const PRAYER_DAYS_LABELS: Record<PrayerDays, { label: string; description: string }> = {
  today: { label: "היום בלבד", description: "רק התפילות של היום" },
  week_today: { label: "כל השבוע · היום ראשון", description: "היום, ואחריו הימים הבאים, יום אחרי יום" },
  week_fixed: { label: "כל השבוע · סדר קבוע", description: "חול, שישי, שבת - היום מסומן" },
};

export const SLIDE_LAYOUTS: Record<SlideKind, Array<{ id: string; label: string }>> = {
  prayer: [
    { id: "split", label: "מניינים + זמני היום" },
    { id: "next", label: "המניין הבא בגדול" },
    { id: "timeline", label: "ציר זמן" },
  ],
  learning: [
    { id: "cards", label: "כרטיסים" },
    { id: "hero", label: "פרשה בגדול" },
  ],
  announcements: [
    { id: "grid", label: "רשת (עד 4)" },
    { id: "spotlight", label: "אחת בכל פעם, בגדול" },
  ],
  shiurim: [
    { id: "list", label: "רשימה" },
    { id: "cards", label: "כרטיסים" },
  ],
  slideshow: [
    { id: "fade", label: "מעבר רך" },
    { id: "kenburns", label: "תנועה איטית (קן ברנס)" },
  ],
};

export interface TvSlideConfig {
  kind: SlideKind;
  enabled: boolean;
  seconds: number;
  layout: string;
}

export type AlertEvent = Extract<SolarEvent, "sof_zman_shma" | "sof_zman_tefila" | "sunset" | "candle">;

export const ALERT_EVENT_LABELS: Record<AlertEvent, string> = {
  sof_zman_shma: "סוף זמן קריאת שמע",
  sof_zman_tefila: "סוף זמן תפילה",
  sunset: "שקיעה",
  candle: "הדלקת נרות (בערב שבת)",
};

/**
 * Per-element look, set by clicking the element in the editor: text size,
 * colour and a nudge from its natural place. The nudge is in percent of the
 * screen (cqw / cqh), so it lands in the same relative spot on a TV, a
 * laptop or a phone.
 */
export interface ElementStyle {
  /** Text size multiplier, 0.5-2. */
  scale?: number;
  /** A safe colour (hex / rgb / hsl). */
  color?: string;
  /** Background colour behind the element (safe colour). */
  bg?: string;
  /** Font weight, 300-900. */
  weight?: number;
  /** 0.15-1. */
  opacity?: number;
  /**
   * Which themes this styling applies in. Absent = every theme (the default:
   * one change is meant to hold everywhere). A theme id = only while that
   * theme is the one on screen.
   */
  theme?: string;
  /** Offset in percent of the screen width / height, -50..50. */
  x?: number;
  y?: number;
}

/**
 * How the whole screen is arranged:
 *   rotate     one slide at a time, full width (the original board)
 *   split      a fixed side column (next minyan + zmanim) beside the slides
 *   dashboard  everything at once, no rotation - prayer times, a large clock,
 *              zmanim, an announcement and lessons, with a strip at the bottom
 *   illustrated  a whole painted board (curtain, stone tablets, carved wood...)
 *              with the day's times written into its frames - see
 *              illustrated.ts and `illustration` below
 *   medallion  the painted boards' arrangement - a clock in a medallion
 *              between two plaques, prayers and zmanim in two large frames,
 *              a strip below - built from ordinary frames (TvMedallion.tsx)
 */
export type ScreenLayout = "rotate" | "split" | "dashboard" | "illustrated" | "medallion";
export const SCREEN_LAYOUTS: ScreenLayout[] = ["rotate", "split", "dashboard", "illustrated", "medallion"];

/** Kinds of day that can have their own look (see dayLooks.ts), highest first. */
export const DAY_KINDS = ["shabbat", "festival", "roshChodesh", "friday"] as const;
export type DayKind = (typeof DAY_KINDS)[number];
/** A day's look: whatever it names replaces the ordinary; what it leaves out stays. */
export interface DayLook {
  screenLayout?: ScreenLayout;
  illustration?: string;
  theme?: string;
  /** A design - a ready one or one the admin saved (designs.ts) - put on for the day. */
  design?: string;
}

/** The painted boards the "illustrated" layout can draw (pictures in TvIllustrated.tsx). */
export const ILLUSTRATIONS = ["curtain", "stone", "wood", "modern"] as const;
export type IllustrationId = (typeof ILLUSTRATIONS)[number];
export type ClockStyle = "digital" | "analog" | "both";

/**
 * The designed frames ("skins") that once dressed a whole board at a stroke
 * are gone: what they were made of is a part of its own now - a frame for the
 * whole board (BOARD_FRAMES), a shape for the boxes, a background from the
 * gallery, a frame picture, a style for the titles (TITLE_STYLES). A board
 * saved with one is turned into those parts when it is read (skinToParts).
 */
export const LEGACY_SKINS = [
  "gold", "tablets", "parchment", "velvet", "pillars", "curtain", "sky", "wood",
  "arch", "hall", "crown", "heichal", "dome", "stone", "medallion", "printed",
] as const;

/**
 * A frame for the whole board, not for a box: columns at its sides, beams
 * above and below, a valance hung over it, a carved frame around the screen.
 * Drawn behind the boxes (tv.css, .tv-board-frame), with room made for it.
 */
export type BoardFrame = "columns" | "beams" | "heichal" | "parochet" | "curtain" | "carved" | "double-line" | "picture";
/** The ready ones; "picture" is a picture of the shul's own around the screen (boardFrameImage). */
export const BOARD_FRAMES: BoardFrame[] = ["columns", "beams", "heichal", "parochet", "curtain", "carved", "double-line"];

/**
 * A frame for the whole board the shul made its own: a ready one as it was
 * set (its size, place and sides), or a picture it uploaded - kept under a
 * name, renamed, updated and deleted like any of its own things.
 */
export interface MyBoardFrame {
  id: string;
  name: string;
  frame: BoardFrame;
  tune: BoardFrameTune;
  /** The picture, for a "picture" frame. */
  image: string | null;
}
export const MAX_MY_BOARD_FRAMES = 20;
const MY_BOARD_FRAME_ID = /^bf_[a-z0-9]{4,16}$/;
export const newMyBoardFrameId = () => `bf_${Math.random().toString(36).slice(2, 10)}`;

// How the name of a box is set - for every box (TvConfig.titleStyle) or one (frameLooks).
export { TITLE_STYLES, type TitleStyle };

export const CLOCK_STYLES: ClockStyle[] = ["digital", "analog", "both"];

/**
 * The shape of a panel's corners, over and above how round they are.
 *
 * "auto" leaves the skin's own silhouette alone - an arch stays an arch, a
 * dome stays a dome. Anything else replaces it on every panel of every skin:
 * a plain round corner, a squircle (the corner of a phone icon), a cut
 * corner, a corner scooped inwards, or a notch. They are CSS corner-shape
 * values; a browser without it still gets the roundness.
 */
export type FrameShape = "auto" | "round" | "squircle" | "bevel" | "scoop" | "notch" | "arch" | BoxShapeCut;
/**
 * Shapes of the whole box rather than of its corners: a capsule and an
 * ellipse (round, so a line and a shadow follow them as they are), and a
 * hexagon and an octagon (cut out, with the line drawn as a ring that
 * follows the cut - a border would be cut off with it). Their text is set in
 * from the cut so that it stays inside.
 */
export type BoxShapeCut =
  | "pill" | "ellipse" | "hexagon" | "octagon"
  // Silhouettes from TvShapes.tsx: a dome, an onion dome, a pointed arch, a scalloped plate.
  | "dome" | "onion" | "lancet" | "scallop";
export const BOX_SHAPE_CUTS: BoxShapeCut[] = ["pill", "ellipse", "hexagon", "octagon", "dome", "onion", "lancet", "scallop"];
export const FRAME_SHAPES: FrameShape[] = ["auto", "round", "squircle", "bevel", "scoop", "notch", "arch", ...BOX_SHAPE_CUTS];

/** What each shape is in CSS. */
export const CORNER_SHAPE: Record<Exclude<FrameShape, "auto">, string> = {
  round: "round",
  squircle: "superellipse(2)",
  bevel: "bevel",
  scoop: "scoop",
  notch: "notch",
  // The top as an arch, like the tablets: round corners, and its own radius
  // rule in tv.css (has-frame-arch), since no corner-shape draws an arch.
  arch: "round",
  // The whole box's shape (has-shape-*), not its corners'.
  pill: "round",
  ellipse: "round",
  hexagon: "round",
  octagon: "round",
  dome: "round",
  onion: "round",
  lancet: "round",
  scallop: "round",
};

/** How round a corner may be set to, in --u units. */
export const FRAME_RADIUS_MAX = 12;

/**
 * The air around the panels, in --u units (1 = one percent of the board's
 * height). Less air means taller panels and another row of times; more means
 * a calmer board. null leaves it to the layout and the style, which is what
 * every board had before this existed.
 */
export const SPACING_MAX = 10;
export const SPACING_EDGES = ["top", "bottom", "sides", "gap"] as const;
export type SpacingEdge = (typeof SPACING_EDGES)[number];

/**
 * How a ready-made background is written down: "backdrop:<id>".
 *
 * The rule lives here, with the validation that uses it, and not beside the
 * pictures - this module must not reach an image import. Everything that
 * loads a board loads this file, including the end-to-end tests, whose
 * transpiler reads a .jpg as JavaScript and stops at the first byte.
 */
export const BACKDROP_PREFIX = "backdrop:";

export function isBackdropRef(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(BACKDROP_PREFIX);
}

/**
 * The parts of a board one kind of screen may do differently.
 *
 * Deliberately not everything. The list of saved themes, the gradients in
 * the library, the Shabbat pictures, which slides exist - those are the
 * shul's, not a screen's, and letting them differ per screen would be three
 * libraries to keep in step for no gain. What is here is what somebody
 * actually stands in front of a screen and wants changed for that screen.
 */
export interface DeviceOverlay {
  screenLayout?: ScreenLayout;
  clockStyle?: ClockStyle;
  boardFrame?: BoardFrame | null;
  boardFrameTune?: BoardFrameTune;
  boardFrameImage?: string | null;
  titleStyle?: TitleStyle;
  /**
   * The painted board: which painting, and everything the panel beside it
   * writes - type size, minyanim per frame, the three inks, the picture
   * adjustments, the frame fills.
   *
   * A wall and a phone want different answers here more than almost
   * anywhere else: seven lines in a frame is right across a hall and far too
   * many in a hand. Left off this list, an edit aimed at one screen was run,
   * found to contain nothing the overlay recognised, and dropped - the
   * slider sprang back and the board did not move.
   */
  illustration?: string;
  illustratedStyle?: IllustratedStyle;
  frame?: TvConfig["frame"];
  spacing?: TvConfig["spacing"];
  /** A frame dressed apart from the others (frameLooks.ts). */
  frameLooks?: FrameLooks;
  /** The background's adjustments and every frame's dress (layers.ts). */
  backgroundTune?: BackgroundTune;
  frameStyle?: FrameStyle;
  theme?: string;
  themeOverrides?: Record<string, string>;
  backgroundGradient?: string | null;
  backgroundImage?: string | null;
  backgroundOverlay?: string | null;
  backgroundDim?: number;
  font?: TvFontId;
  textScale?: number;
  /** Title letter-spacing; listed in DEVICE_OVERLAY_KEYS, so a screen may set its own. */
  tracking?: number | null;
  /** The live count to the next minyan; also listed in DEVICE_OVERLAY_KEYS. */
  countdown?: TvConfig["countdown"];
  texts?: Record<string, string>;
  hidden?: string[];
  flipped?: FlipArea[];
  styles?: Record<string, ElementStyle>;
  header?: TvConfig["header"];
  ticker?: TvConfig["ticker"];
}

/** One logo on a board: a copy of its entry in the shared library. */
export interface BoardLogo {
  id: string;
  name: string;
  /** As drawn on a light board. */
  url: string;
  /** The same mark cut for a dark board, when it has one. */
  urlDark?: string;
}

export interface TvConfig {
  screenLayout: ScreenLayout;
  /**
   * Which painted board the "illustrated" layout shows: a built-in id or the
   * id of one of `customIllustrations`. Ignored by the other layouts.
   */
  illustration: string;
  /** Painted boards imported from a design-tokens file (pictures in storage). */
  customIllustrations: CustomIllustration[];
  /**
   * The admin's adjustments to the painted board: type size, how many
   * minyanim a frame shows, and the inks (null = the picture's own).
   */
  illustratedStyle: IllustratedStyle;
  /**
   * A look per kind of day. Replaced by `occasions` (each has a design);
   * still read, so a board that set one keeps it until it saves occasions.
   */
  dayLooks: Partial<Record<DayKind, DayLook>>;
  /**
   * Shabbat, the festivals and the shul's own days, in order of importance:
   * when each shows, what is on its screen, how it meets another (occasions.ts).
   * Empty until the gabbai saves them: the board then reads them from the
   * older settings below (shabbat, event*, dayLooks), so nothing changes by itself.
   */
  occasions: Occasion[];
  /**
   * The pictures of each special day (key from specialDays.ts → image URLs
   * in storage), shown in turn. A day without any gets the built-in designs
   * (EventSplash.tsx).
   */
  eventImages: Record<string, string[]>;
  /**
   * The built-in styles picked for each special day (ids from eventSlides.ts),
   * shown after its pictures. A day not listed gets the defaults.
   */
  eventStyles: Record<string, number[]>;
  /** Keep a special Shabbat or festival on the wall from candle lighting until it ends. */
  eventHold: boolean;
  /** Show the special day's picture and times on the board now and then, on the day. */
  eventSplash: boolean;
  /**
   * A special day nobody set up (see specialDays.specialDayFor): "full" shows
   * its built-in pictures, "info" a card with its name and times over the
   * board, "off" nothing - only days the gabbai set up are shown.
   */
  eventAuto: EventAutoMode;
  /** National days follow `eventAuto` too; otherwise only when set up. */
  eventNationalAuto: boolean;
  /**
   * What the special day's screen says: "full" - everything of that day (the
   * zmanim, the day's minyanim, its own times, the Torah reading); "short" -
   * its name, verse and own times only.
   */
  eventDetail: "full" | "short";
  /**
   * How long the day's screen holds before the board takes a turn, in
   * seconds, and the same again for the board.
   *
   * The day's screen used to be all or nothing: fifteen seconds in ninety
   * ("short"), or the whole board for the whole day. On chol hamoed that
   * meant a week where nobody could see the minyanim without walking up and
   * pressing an arrow. It takes turns now, and this is the length of a turn.
   *
   * Shabbat and festivals themselves are not affected: inside the holy
   * window the day's screen still holds the board, which is the point of it.
   */
  eventEverySeconds: number;
  /**
   * How many minyanim fit on one screen before the day takes another.
   *
   * A shul with twenty-two minyanim in a day does not fit on one screen, and
   * on the wall it simply ran off the bottom. Making the type smaller is the
   * wrong answer for a board read from the back of a hall, so the list takes
   * another screen - and this is where that line falls.
   *
   * It is a setting because the right number depends on the screen: a 1080p
   * television above the aron holds more than the old 1366x768 monitor on a
   * shelf, and only the person standing in front of it knows which he has.
   */
  prayerRowsPerScreen: number;
  /**
   * Which days' prayer times the board shows: today's alone (as it always
   * has), or the whole week - today first, or in the tabs' own order - one
   * day after another as the board turns. The board's own answer: the
   * website and the app have theirs in settings.minyan_days, because a wall
   * nobody taps is not a page somebody does. The order of the days is worked
   * out for both by planWeek (community/lib/week-schedule.ts).
   */
  prayerDays: PrayerDays;
  /**
   * Days that meet (a festival on Shabbat, Rosh Chodesh on Chanukah...):
   * "one" - one screen naming them all; "separate" - a screen for each, in turn.
   */
  eventCombine: "one" | "separate";
  clockStyle: ClockStyle;
  /** A frame for the whole board (BOARD_FRAMES); null - none. */
  boardFrame: BoardFrame | null;
  /** Where the board's frame stands and how big it is (boardFrame.ts). */
  boardFrameTune: BoardFrameTune;
  /** The picture of a "picture" frame: one the shul uploaded. */
  boardFrameImage: string | null;
  /** Frames for the whole board the shul made its own (MyBoardFrame). */
  myBoardFrames: MyBoardFrame[];
  /** How every box's name is set (TITLE_STYLES); a box can have its own (frameLooks). */
  titleStyle: TitleStyle;
  /**
   * The corners of every panel, when the admin wants to decide instead of
   * the skin. `top`/`bottom` are in --u units; null means "as the skin
   * draws it", and setting either one also drops the skin's own silhouette
   * (a clipped dome cannot show a corner radius).
   */
  frame: { shape: FrameShape; top: number | null; bottom: number | null };
  /**
   * `top`: between the header strip and the panels. `sides`: the margin at
   * the edges of the board. `gap`: between one panel and the next. null =
   * as the layout and the style draw it.
   */
  spacing: Record<SpacingEdge, number | null>;
  /**
   * Frames dressed apart from the rest: their own background, text, titles
   * and line (frameLooks.ts). Empty on every board until somebody sets one.
   */
  frameLooks: FrameLooks;
  /**
   * The board's background adjusted - brightness, colour, blur, a tint -
   * whatever the background is (layers.ts). Neutral until somebody moves it.
   */
  backgroundTune: BackgroundTune;
  /**
   * Every frame's own dress over whatever style draws it: a background, a
   * line, depth, or a picture of a frame (layers.ts). Neutral by default.
   */
  frameStyle: FrameStyle;
  /** A built-in theme id, or the id of one of `customThemes`. */
  theme: string;
  /** Themes the admin saved (from a built-in plus colour edits). */
  customThemes: TvTheme[];
  /**
   * Designs the admin saved: the look, or chosen parts of it - background,
   * frames, text, layout - under a name (designs.ts). The shul's library,
   * like the themes and gradients, so not something one screen may differ in.
   */
  designs: SavedDesign[];
  /** Gradients the admin saved, before there was a gallery; read into `backgrounds` once. */
  gradients: TvGradient[];
  /** The shul's own backgrounds, beside the ready-made ones in one gallery (backgrounds.ts). */
  backgrounds: SavedBackground[];
  /** Frame pictures the shul uploaded, kept beside the ready-made ones whether a box wears them or not. */
  frameUploads: string[];
  /**
   * Ready-made items this shul took off its lists (readyItems.ts): a design,
   * a theme, a background, a frame, a ready box - "design:<id>", "theme:<id>",
   * "bg:<id>", "frame:<id>", "box:<id>". Anything that can be added can be
   * deleted; a ready one is hidden rather than lost, and can be brought back.
   */
  hiddenReady: string[];
  /** A gradient behind the whole board; null = the theme's own background. */
  backgroundGradient: string | null;
  font: TvFontId;
  textScale: number;
  /**
   * How far apart the letters of a title are set, in em. null = as the skin
   * draws it, which is how every board reads until somebody moves this.
   *
   * It is here rather than inside a skin because it is the cheapest
   * hierarchy there is: a Hebrew title set wide reads as a title without
   * being bigger or louder, so it buys separation without spending
   * contrast - and contrast is the whole budget on a wall seen from thirty
   * metres. Titles only; body text set wide stops being readable at speed.
   */
  tracking: number | null;
  /** Live-editor colour overrides on top of the theme (CSS var -> colour). */
  themeOverrides: Record<string, string>;
  backgroundImage: string | null;
  /**
   * A colour or a gradient laid over the picture, at backgroundDim; null: the
   * theme's own colour, as the picture was always darkened.
   */
  backgroundOverlay: string | null;
  backgroundDim: number;
  slides: TvSlideConfig[];
  /**
   * The screens, once a gabbai has built them in the composer.
   *
   * Absent on every board that existed before the composer, which is the
   * point: `screens.ts` reads those from `slides` and `screenLayout` instead,
   * so nothing has to be converted and no wall depends on a migration having
   * gone right. A board only gets this field when somebody saves in the new
   * editor, and from then on it is what the board follows.
   */
  screens?: Screen[];
  /** Header extras. `logo`: the קרובים logo beside the synagogue name. */
  header: { parasha: boolean; dafYomi: boolean; logo: boolean };
  /**
   * The logos this board shows, chosen from the shared library (the
   * logo_library table) - the synagogue's own, a sponsor's. A copy of the
   * chosen entries rather than their ids, so a TV that is offline still has
   * them. Shown on every screen whose "לוגואים" switch is on.
   */
  logos: BoardLogo[];
  /**
   * What a frame does with content taller than itself (AutoScroll.tsx):
   * "off" keeps it as it was (a window of rows, cut at the edge); "pause"
   * scrolls it down and back with a stop at each end; "loop" runs it up as
   * an endless curtain. A frame whose content fits never moves.
   */
  overflow: { mode: "off" | "pause" | "loop"; speed: "slow" | "normal" };
  /** Arrangements saved in the composer, to be put on a screen again (SavedLayout). */
  layouts: SavedLayout[];
  /** Boxes added by hand: a title and free text each (CustomBox). */
  customBoxes: CustomBox[];
  alerts: {
    enabled: boolean;
    events: AlertEvent[];
    /** Pop the reminder this many minutes before, e.g. [30, 15, 5]. */
    leadMinutes: number[];
    /** How long each reminder stays on screen. */
    popupSeconds: number;
  };
  ticker: { enabled: boolean; text: string };
  /**
   * A live count to the next minyan, under the prayer times.
   *
   * Off unless it is switched on: a board that has run for months without it
   * keeps looking exactly as it did. What it adds is the one question a
   * person crossing the hall actually has - not "when is mincha" but "have I
   * missed it" - and a number that moves answers that faster than a time
   * they have to subtract from a clock.
   */
  countdown: { enabled: boolean };
  /**
   * The Shabbat screen: from candle lighting on Friday until the end of
   * Shabbat the board shows only it (see shabbat.ts).
   */
  shabbat: {
    enabled: boolean;
    endMinutesAfterSunset: number;
    /**
     * The pictures to show, in order: "art:<id>" for a built-in drawing
     * (ShabbatScene.SHABBAT_ART) or an https URL of an uploaded photo.
     * Never empty.
     */
    scenes: string[];
    /** Photos the admin uploaded for Shabbat (https URLs), selectable in `scenes`. */
    photos: string[];
    /** Rotate through `scenes`; otherwise only the first one is shown. */
    rotate: boolean;
    secondsPerScene: number;
  };
  slideshow: { images: Array<{ url: string; caption?: string }>; secondsPerImage: number };
  /**
   * Board-only wording, keyed by element (see EDITABLE in boardEdit.tsx):
   * "header.title" -> "בית הכנסת ...". A missing key shows the default text.
   */
  texts: Record<string, string>;
  /** Elements taken off the board: element keys, or "ann:<id>", "shiur:<id>", "minyan:<id>". */
  hidden: string[];
  /** Areas drawn mirror-wise (clock on the other side, panels swapped). */
  flipped: FlipArea[];
  /** Per-element look, keyed like `texts` (see ElementStyle). */
  styles: Record<string, ElementStyle>;
  /**
   * What each kind of screen does differently; see devices.ts.
   *
   * Absent or empty means "the same as everywhere else", which is what
   * every board is until somebody deliberately changes one screen. So the
   * ordinary edit stays one edit, applying to the wall, the laptop and the
   * phone at once, and only what is genuinely different is stored twice.
   */
  perDevice: Partial<Record<DeviceClass, DeviceOverlay>>;
  /**
   * Editor only, never stored: content edits (an announcement's text, a
   * minyan's name...) waiting for "שמור ושדר". normalizeTvConfig drops it.
   */
  _records?: RecordEdit[];
}

export const FLIP_AREAS = ["header", "prayer", "learning"] as const;
export type FlipArea = (typeof FLIP_AREAS)[number];

export type RecordTable = "announcements" | "shiurim" | "minyanim" | "settings";
export type RecordEdit =
  | { table: RecordTable; id: string; field: string; value: string | number }
  | { table: "announcements"; id: string; delete: true };

/** The painted board as drawn: no size change, 7 rows, the picture's own inks, no adjustments. */
export const DEFAULT_ILLUSTRATED_STYLE: IllustratedStyle = {
  scale: 1,
  rows: 7,
  ink: null,
  accent: null,
  clockInk: null,
  brightness: 1,
  saturation: 1,
  hue: 0,
  stoneTint: null,
  stoneTintStrength: 0.35,
  frameFill: null,
  frameFillOpacity: 0.5,
  frameDepth: 0,
  frameLine: null,
  frameLineWidth: 2,
  frameShape: "rect",
};

export const DEFAULT_TV_CONFIG: TvConfig = {
  perDevice: {},
  theme: "navy",
  font: "classic",
  textScale: 1,
  tracking: null,
  themeOverrides: {},
  backgroundImage: null,
  backgroundOverlay: null,
  backgroundDim: 0.55,
  slides: [
    { kind: "prayer", enabled: true, seconds: 20, layout: "split" },
    { kind: "learning", enabled: true, seconds: 15, layout: "cards" },
    { kind: "announcements", enabled: true, seconds: 18, layout: "grid" },
    { kind: "shiurim", enabled: true, seconds: 18, layout: "list" },
    { kind: "slideshow", enabled: false, seconds: 30, layout: "kenburns" },
  ],
  header: { parasha: true, dafYomi: true, logo: true },
  logos: [],
  overflow: { mode: "off", speed: "slow" },
  layouts: [],
  customBoxes: [],
  alerts: {
    enabled: true,
    events: ["sof_zman_shma", "sof_zman_tefila", "sunset", "candle"],
    leadMinutes: [30, 15, 5],
    popupSeconds: 40,
  },
  ticker: { enabled: false, text: "" },
  countdown: { enabled: false },
  shabbat: { enabled: true, endMinutesAfterSunset: 40, scenes: ["art:classic"], photos: [], rotate: false, secondsPerScene: 60 },
  slideshow: { images: [], secondsPerImage: 8 },
  texts: {},
  hidden: [],
  flipped: [],
  customThemes: [],
  designs: [],
  gradients: [],
  backgrounds: [],
  frameUploads: [],
  hiddenReady: [],
  backgroundGradient: null,
  styles: {},
  screenLayout: "rotate",
  illustration: "curtain",
  customIllustrations: [],
  illustratedStyle: DEFAULT_ILLUSTRATED_STYLE,
  dayLooks: {},
  occasions: [],
  eventImages: {},
  eventStyles: {},
  eventHold: true,
  eventSplash: true,
  eventAuto: "full",
  eventNationalAuto: false,
  eventDetail: "full",
  eventEverySeconds: 45,
  prayerRowsPerScreen: 14,
  prayerDays: "today",
  eventCombine: "one",
  clockStyle: "digital",
  frame: { shape: "auto", top: null, bottom: null },
  spacing: { top: null, bottom: null, sides: null, gap: null },
  frameLooks: {},
  backgroundTune: DEFAULT_BACKGROUND_TUNE,
  frameStyle: DEFAULT_FRAME_STYLE,
  boardFrame: null,
  boardFrameTune: DEFAULT_BOARD_FRAME_TUNE,
  boardFrameImage: null,
  myBoardFrames: [],
  titleStyle: "plain",
};

const KINDS = Object.keys(SLIDE_LAYOUTS) as SlideKind[];
const ALERT_EVENTS = Object.keys(ALERT_EVENT_LABELS) as AlertEvent[];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const str = (v: unknown, fallback: string, max = 500) => (typeof v === "string" ? v.slice(0, max) : fallback);
/** Element keys: letters, digits and . : _ - only (ids are UUIDs). */
const KEY_RE = /^[a-z0-9_.:-]{1,90}$/i;

function normalizeCustomThemes(raw: unknown): TvTheme[] {
  if (!Array.isArray(raw)) return [];
  const out: TvTheme[] = [];
  const seen = new Set<string>();
  for (const t of raw) {
    if (!isObj(t) || typeof t.id !== "string" || !CUSTOM_THEME_ID_RE.test(t.id) || seen.has(t.id)) continue;
    if (!isObj(t.vars)) continue;
    const vars = {} as Record<ThemeVar, string>;
    let complete = true;
    for (const v of THEME_VARS) {
      const value = t.vars[v];
      if (typeof value === "string" && isSafeCssValue(value)) vars[v] = value.trim();
      else complete = false;
    }
    if (!complete) continue;
    seen.add(t.id);
    out.push({
      id: t.id,
      name: str(t.name, "ערכה מותאמת", 40).trim() || "ערכה מותאמת",
      description: str(t.description, "", 80),
      light: bool(t.light, false),
      vars,
    });
    if (out.length >= 24) break;
  }
  return out;
}

/** Built-in Shabbat drawings (ids of ShabbatScene.SHABBAT_ART). */
export const SHABBAT_ART_IDS = ["classic", "kiddush", "jerusalem", "candles"] as const;

/**
 * The composer's screens, or nothing at all.
 *
 * `undefined` is meaningful here and is not the same as an empty array: it
 * means this board predates the composer and is still described by `slides`
 * and `screenLayout`, so `screens.ts` reads it from those. An empty array
 * would mean a gabbai saved a board with no screens on it, which the board
 * must not confuse with the far more common "never opened the composer".
 *
 * Anything unrecognised is dropped rather than repaired: a block id from a
 * future version, or a screen with nothing left on it after filtering, is
 * better absent than half-drawn on a wall.
 */
/** A hand arrangement, as stored: rows of known blocks, each block once, widths and heights in range. */
function normalizeGrid(raw: unknown): ScreenRow[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<BlockId>();
  const rows: ScreenRow[] = [];
  for (const r of raw.slice(0, 8)) {
    if (!isObj(r) || !Array.isArray(r.blocks)) continue;
    const blocks: BlockId[] = [];
    const widths: number[] = [];
    r.blocks.forEach((b, i) => {
      const id = b as BlockId;
      if (blocks.length >= 3 || !isKnownBlock(id) || seen.has(id)) return;
      seen.add(id);
      blocks.push(id);
      widths.push(num(Array.isArray(r.widths) ? r.widths[i] : undefined, 1, 0.1, 10));
    });
    if (blocks.length) rows.push({ blocks, widths, height: num(r.height, 1, 0.3, 4) });
  }
  return rows.length ? rows : undefined;
}

function normalizeMyBoardFrames(raw: unknown): MyBoardFrame[] {
  const out: MyBoardFrame[] = [];
  for (const f of Array.isArray(raw) ? raw : []) {
    if (!isObj(f) || typeof f.id !== "string" || !MY_BOARD_FRAME_ID.test(f.id) || out.some((o) => o.id === f.id)) continue;
    const image = typeof f.image === "string" && isSafeUrl(f.image) ? f.image : null;
    const frame = BOARD_FRAMES.includes(f.frame as BoardFrame) ? (f.frame as BoardFrame) : f.frame === "picture" && image ? "picture" : null;
    if (!frame) continue;
    out.push({
      id: f.id,
      name: (typeof f.name === "string" ? f.name.trim().slice(0, 40) : "") || "מסגרת שלי",
      frame,
      tune: normalizeBoardFrameTune(f.tune),
      image,
    });
    if (out.length >= MAX_MY_BOARD_FRAMES) break;
  }
  return out;
}

function normalizeCustomBoxes(raw: unknown): CustomBox[] {
  const out: CustomBox[] = [];
  for (const b of Array.isArray(raw) ? raw : []) {
    if (!isObj(b) || typeof b.id !== "string" || !isCustomBlock(b.id) || out.some((o) => o.id === b.id)) continue;
    out.push({
      id: b.id,
      title: typeof b.title === "string" ? b.title.trim().slice(0, 60) : "",
      text: typeof b.text === "string" ? b.text.slice(0, 800) : "",
    });
    if (out.length >= MAX_CUSTOM_BOXES) break;
  }
  return out;
}

function normalizeLayouts(raw: unknown): SavedLayout[] {
  const out: SavedLayout[] = [];
  for (const l of Array.isArray(raw) ? raw : []) {
    if (!isObj(l) || typeof l.id !== "string" || !KEY_RE.test(l.id) || out.some((o) => o.id === l.id)) continue;
    const grid = normalizeGrid(l.grid);
    const name = typeof l.name === "string" ? l.name.trim().slice(0, 40) : "";
    if (grid && name) out.push({ id: l.id.slice(0, 40), name, grid });
    if (out.length >= 12) break;
  }
  return out;
}

function normalizeScreens(raw: unknown): Screen[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const areas: BlockArea[] = ["right", "left", "wide"];
  const screens: Screen[] = [];

  for (const s of raw.slice(0, 12)) {
    if (!isObj(s)) continue;
    const seen = new Set<BlockId>();
    const blocks: BlockEntry[] = [];
    for (const b of Array.isArray(s.blocks) ? s.blocks.slice(0, 20) : []) {
      if (!isObj(b)) continue;
      const id = b.block as BlockId;
      // A block twice on one screen would draw twice and count twice.
      if (!isKnownBlock(id) || seen.has(id)) continue;
      seen.add(id);
      const area = areas.includes(b.area as BlockArea) ? (b.area as BlockArea) : undefined;
      blocks.push(area ? { block: id, area } : { block: id });
    }
    if (!blocks.length) continue;
    const grid = normalizeGrid(s.grid);
    screens.push({
      id: typeof s.id === "string" && KEY_RE.test(s.id) ? s.id.slice(0, 40) : `screen${screens.length + 1}`,
      name: typeof s.name === "string" && s.name.trim() ? s.name.trim().slice(0, 60) : `מסך ${screens.length + 1}`,
      seconds: num(s.seconds, 15, 0, 600),
      blocks,
      ...(grid ? { grid } : {}),
    });
  }
  return screens.length ? screens : undefined;
}

const HTTPS_URL = /^https:\/\/[^\s"'()<>]+$/i;

export function normalizeLogos(raw: unknown): BoardLogo[] {
  const out: BoardLogo[] = [];
  for (const l of Array.isArray(raw) ? raw : []) {
    if (!isObj(l) || typeof l.id !== "string" || typeof l.url !== "string" || !HTTPS_URL.test(l.url)) continue;
    if (out.some((o) => o.id === l.id)) continue;
    const logo: BoardLogo = { id: l.id.slice(0, 60), name: str(l.name, "לוגו", 60), url: l.url.slice(0, 600) };
    if (typeof l.urlDark === "string" && HTTPS_URL.test(l.urlDark)) logo.urlDark = l.urlDark.slice(0, 600);
    out.push(logo);
    if (out.length >= 6) break;
  }
  return out;
}

/**
 * The "לוגואים" switch arrived after boards had screens. A board saved before
 * it (no `logos` field yet) gets the switch on wherever the name is on, which
 * is where the one logo the board could show used to stand. From the first
 * save on, the switch is whatever the gabbai left it.
 */
function withLogoSwitch(screens: Screen[] | undefined, rawLogos: unknown): Screen[] | undefined {
  if (!screens || Array.isArray(rawLogos)) return screens;
  return screens.map((s) =>
    s.blocks.some((b) => b.block === "header") && !s.blocks.some((b) => b.block === "logo")
      ? { ...s, blocks: [...s.blocks, { block: "logo" as const }] }
      : s,
  );
}

function normalizeShabbatScenes(raw: unknown): string[] {
  const out: string[] = [];
  for (const s of Array.isArray(raw) ? raw : []) {
    if (typeof s !== "string" || out.includes(s)) continue;
    const art = s.startsWith("art:") && (SHABBAT_ART_IDS as readonly string[]).includes(s.slice(4));
    const photo = /^https:\/\/[^\s"'()<>]+$/i.test(s) && s.length <= 600;
    if (art || photo) out.push(s);
    if (out.length >= 30) break;
  }
  return out.length ? out : ["art:classic"];
}

export function normalizeGradients(raw: unknown): TvGradient[] {
  const out: TvGradient[] = [];
  const seen = new Set<string>();
  for (const g of Array.isArray(raw) ? raw : []) {
    if (!isObj(g) || typeof g.id !== "string" || !CUSTOM_GRADIENT_ID_RE.test(g.id) || seen.has(g.id)) continue;
    if (typeof g.value !== "string" || !isSafeGradient(g.value)) continue;
    const name = str(g.name, "", 40).trim();
    if (!name) continue;
    seen.add(g.id);
    out.push({ id: g.id, name, value: g.value.trim() });
    if (out.length >= 40) break;
  }
  return out;
}

export function normalizeElementStyle(raw: unknown, themes?: string[]): ElementStyle | null {
  if (!isObj(raw)) return null;
  const s: ElementStyle = {};
  if (typeof raw.scale === "number" && Number.isFinite(raw.scale) && raw.scale !== 1) s.scale = Math.min(2, Math.max(0.5, raw.scale));
  if (typeof raw.color === "string" && isSafeCssValue(raw.color)) s.color = raw.color.trim();
  if (typeof raw.bg === "string" && isSafeFill(raw.bg)) s.bg = raw.bg.trim();
  if (typeof raw.weight === "number" && Number.isFinite(raw.weight)) s.weight = Math.round(Math.min(900, Math.max(300, raw.weight)) / 100) * 100;
  if (typeof raw.opacity === "number" && Number.isFinite(raw.opacity) && raw.opacity < 1) s.opacity = Math.round(Math.min(1, Math.max(0.15, raw.opacity)) * 100) / 100;
  if (typeof raw.theme === "string" && raw.theme && (!themes || themes.includes(raw.theme))) s.theme = raw.theme;
  if (typeof raw.x === "number" && Number.isFinite(raw.x) && raw.x !== 0) s.x = Math.min(50, Math.max(-50, Math.round(raw.x * 10) / 10));
  if (typeof raw.y === "number" && Number.isFinite(raw.y) && raw.y !== 0) s.y = Math.min(50, Math.max(-50, Math.round(raw.y * 10) / 10));
  return Object.keys(s).length ? s : null;
}

function normalizeStyles(raw: unknown, themes: string[]): Record<string, ElementStyle> {
  const out: Record<string, ElementStyle> = {};
  if (!isObj(raw)) return out;
  for (const [k, v] of Object.entries(raw).slice(0, 200)) {
    // Keys are either one element ("header.title") or a family of them
    // ("kind:minyan" - every minyan row); both match KEY_RE.
    const s = KEY_RE.test(k) ? normalizeElementStyle(v, themes) : null;
    if (s) out[k] = s;
  }
  return out;
}

/** A corner setting from storage: unknown shapes and silly sizes are dropped. */
function normalizeFrame(raw: unknown, fallback: TvConfig["frame"]): TvConfig["frame"] {
  const r = (raw ?? {}) as Record<string, unknown>;
  const size = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(v, 0), FRAME_RADIUS_MAX) : null;
  return {
    shape: FRAME_SHAPES.includes(r.shape as FrameShape) ? (r.shape as FrameShape) : fallback.shape,
    top: size(r.top),
    bottom: size(r.bottom),
  };
}

/** Spacing from storage: only numbers, and only sane ones. */
function normalizeSpacing(raw: unknown): TvConfig["spacing"] {
  const r = (raw ?? {}) as Record<string, unknown>;
  const size = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(v, 0), SPACING_MAX) : null;
  return { top: size(r.top), bottom: size(r.bottom), sides: size(r.sides), gap: size(r.gap) };
}

export interface IllustratedStyle {
  /** Type size, 0.8–1.3 of what the picture was drawn for. */
  scale: number;
  /** Minyanim per frame, 4–10. */
  rows: number;
  ink: string | null;
  accent: string | null;
  clockInk: string | null;
  /** Picture adjustments ("התאמות תמונה", illustratedAdjust.ts). 1 / 0 / null = as painted. */
  brightness: number;
  saturation: number;
  hue: number;
  /** A colour over the stones (outside the frames), and how strong. */
  stoneTint: string | null;
  stoneTintStrength: number;
  /** The frames' own background colour, and how opaque. */
  frameFill: string | null;
  frameFillOpacity: number;
  /** How much the frames stand out, 0 (as painted) - 1. */
  frameDepth: number;
  /** A line around the frames, and how thick (0-6). */
  frameLine: string | null;
  frameLineWidth: number;
  /** The panels' shape for all of the above: rectangles, or arched like tablets. */
  frameShape: "rect" | "arch";
}


/**
 * Special-day pictures from storage: simple keys, https links only, up to 8
 * each. A single link (how the first version stored it) becomes a list of one.
 */
function normalizeEventImages(raw: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[a-z_]{2,40}$/.test(k)) continue;
    const list = (Array.isArray(v) ? v : [v])
      .filter((u): u is string => typeof u === "string")
      .map((u) => u.trim())
      .filter((u) => /^https:\/\//i.test(u) && isSafeUrl(u));
    const unique = [...new Set(list)].slice(0, 8);
    if (unique.length) out[k] = unique;
  }
  return out;
}

function normalizeEventStyles(raw: unknown): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[a-z_]{2,40}$/.test(k) || !Array.isArray(v)) continue;
    // An empty list is kept: "no built-in styles, only my pictures".
    out[k] = [...new Set(v.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 20))].slice(0, 12);
  }
  return out;
}

/** Day looks from storage: only known kinds, and only layouts, boards and themes that exist. */
function normalizeDayLooks(
  raw: unknown,
  themes: string[],
  illustrations: string[],
  designs: string[],
): TvConfig["dayLooks"] {
  const out: TvConfig["dayLooks"] = {};
  const r = (raw ?? {}) as Record<string, unknown>;
  for (const kind of DAY_KINDS) {
    const v = r[kind] as Record<string, unknown> | undefined;
    if (!v || typeof v !== "object") continue;
    const look: DayLook = {};
    if (SCREEN_LAYOUTS.includes(v.screenLayout as ScreenLayout)) look.screenLayout = v.screenLayout as ScreenLayout;
    if (typeof v.illustration === "string" && illustrations.includes(v.illustration)) look.illustration = v.illustration;
    if (typeof v.theme === "string" && themes.includes(v.theme)) look.theme = v.theme;
    if (typeof v.design === "string" && designs.includes(v.design)) look.design = v.design;
    if (Object.keys(look).length) out[kind] = look;
  }
  return out;
}

function normalizeIllustratedStyle(raw: unknown): IllustratedStyle {
  const r = (raw ?? {}) as Record<string, unknown>;
  const colour = (v: unknown) => (typeof v === "string" && isSafeCssValue(v) ? v.trim() : null);
  const n = (v: unknown, d: number, lo: number, hi: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
  const hex = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim() : null);
  const two = (v: number) => Math.round(v * 100) / 100;
  const d = DEFAULT_ILLUSTRATED_STYLE;
  return {
    scale: two(n(r.scale, 1, 0.8, 1.3)),
    rows: Math.round(n(r.rows, 7, 4, 10)),
    ink: colour(r.ink),
    accent: colour(r.accent),
    clockInk: colour(r.clockInk),
    brightness: two(n(r.brightness, d.brightness, 0.6, 1.4)),
    saturation: two(n(r.saturation, d.saturation, 0, 2)),
    hue: Math.round(n(r.hue, d.hue, -180, 180)),
    stoneTint: hex(r.stoneTint),
    stoneTintStrength: two(n(r.stoneTintStrength, d.stoneTintStrength, 0, 1)),
    frameFill: hex(r.frameFill),
    frameFillOpacity: two(n(r.frameFillOpacity, d.frameFillOpacity, 0, 1)),
    frameDepth: two(n(r.frameDepth, d.frameDepth, 0, 1)),
    frameLine: hex(r.frameLine),
    frameLineWidth: two(n(r.frameLineWidth, d.frameLineWidth, 0, 6)),
    frameShape: r.frameShape === "arch" ? "arch" : "rect",
  };
}

/**
 * A board read from storage, checked.
 *
 * There are no painted boards any more - a look is built from parts
 * (backgrounds, boxes and frames, text) and every part can be changed. A board
 * that still arrives painted (an old backup, a file from another shul) is put
 * onto the ready design that rebuilds its painting from parts, with what was
 * adjusted on the painting carried over (paintedMigration.ts); one whose
 * painting has no design becomes the medallion, the same arrangement drawn
 * with ordinary frames. A screen of its own that was painted, likewise.
 */
/**
 * What a screen shows is decided in the composer, block by block. Before it,
 * a list of slides switched each kind of content on or off - and the switch
 * outlived the composer: a block on a screen whose slide was off showed
 * nothing, and the two controls said different things. So the old switch is
 * read once, as the composer would say it - the block taken off the screens
 * where it showed nothing - and every slide is on from then on.
 */
const SLIDE_BLOCK: Record<SlideKind, BlockId> = {
  prayer: "prayers",
  learning: "learning",
  announcements: "announcements",
  shiurim: "shiurim",
  slideshow: "slideshow",
};

function retireSlideSwitches(c: TvConfig): TvConfig {
  const off = c.slides.filter((s) => !s.enabled).map((s) => SLIDE_BLOCK[s.kind]);
  if (!off.length || !c.screens?.length) return c;
  const strip = (s: Screen): Screen => {
    const grid = s.grid
      ?.map((r) => {
        const keep = r.blocks.map((b, i) => [b, r.widths[i]] as const).filter(([b]) => !off.includes(b));
        return { ...r, blocks: keep.map(([b]) => b), widths: keep.map(([, w]) => w) };
      })
      .filter((r) => r.blocks.length);
    const { grid: _g, ...rest } = s;
    return { ...rest, blocks: s.blocks.filter((b) => !off.includes(b.block)), ...(grid?.length ? { grid } : {}) };
  };
  return {
    ...c,
    screens: c.screens.map(strip),
    occasions: c.occasions?.map((o) => (o.screen ? { ...o, screen: strip(o.screen) } : o)),
    slides: c.slides.map((s) => ({ ...s, enabled: true })),
  };
}

export function normalizeTvConfig(raw: unknown): TvConfig {
  const c = retireSlideSwitches(normalizeStored(raw));
  if (c.screenLayout !== "illustrated" && !Object.values(c.perDevice).some((o) => o?.screenLayout === "illustrated")) return c;
  const moved = migratePainted(c);
  const perDevice = Object.fromEntries(
    Object.entries(moved.perDevice).map(([k, o]) => [k, o?.screenLayout === "illustrated" ? { ...o, screenLayout: "medallion" as const } : o]),
  ) as TvConfig["perDevice"];
  return { ...moved, screenLayout: moved.screenLayout === "illustrated" ? "medallion" : moved.screenLayout, perDevice };
}

function normalizeStored(stored: unknown): TvConfig {
  const d = DEFAULT_TV_CONFIG;
  // An old designed frame ("skin") becomes the parts it was made of.
  const raw = skinToParts(stored);
  if (!isObj(raw)) return structuredClone(d);

  const customThemes = normalizeCustomThemes(raw.customThemes);
  const designs = normalizeDesigns(raw.designs, normalizeStored);
  const customIllustrations = normalizeCustomIllustrations(raw.customIllustrations);
  const theme =
    TV_THEMES.some((t) => t.id === raw.theme) || customThemes.some((t) => t.id === raw.theme) ? String(raw.theme) : d.theme;
  const font = TV_FONTS.some((f) => f.id === raw.font) ? (raw.font as TvFontId) : d.font;

  // Slides: keep the admin's order, drop unknown kinds, append any kind a newer
  // default introduced so it can be switched on without a data migration.
  const seen = new Set<SlideKind>();
  const slides: TvSlideConfig[] = [];
  for (const s of Array.isArray(raw.slides) ? raw.slides : []) {
    if (!isObj(s) || !KINDS.includes(s.kind as SlideKind) || seen.has(s.kind as SlideKind)) continue;
    const kind = s.kind as SlideKind;
    const def = d.slides.find((x) => x.kind === kind)!;
    seen.add(kind);
    slides.push({
      kind,
      enabled: bool(s.enabled, def.enabled),
      seconds: num(s.seconds, def.seconds, 5, 300),
      layout: SLIDE_LAYOUTS[kind].some((l) => l.id === s.layout) ? String(s.layout) : def.layout,
    });
  }
  for (const def of d.slides) if (!seen.has(def.kind)) slides.push({ ...def });

  const overrides: Record<string, string> = {};
  if (isObj(raw.themeOverrides))
    for (const [k, v] of Object.entries(raw.themeOverrides)) if (typeof v === "string") overrides[k] = v.slice(0, 60);

  const header = isObj(raw.header) ? raw.header : {};
  const alerts = isObj(raw.alerts) ? raw.alerts : {};
  const ticker = isObj(raw.ticker) ? raw.ticker : {};
  const countdown = isObj(raw.countdown) ? raw.countdown : {};
  const shabbat = isObj(raw.shabbat) ? raw.shabbat : {};
  const slideshow = isObj(raw.slideshow) ? raw.slideshow : {};

  const leads = Array.isArray(alerts.leadMinutes)
    ? [...new Set(alerts.leadMinutes.filter((n): n is number => typeof n === "number" && n >= 1 && n <= 180))]
        .sort((a, b) => b - a)
        .slice(0, 5)
    : d.alerts.leadMinutes;

  return {
    theme,
    font,
    textScale: num(raw.textScale, d.textScale, 0.8, 1.3),
    tracking: raw.tracking === null || raw.tracking === undefined ? null : num(raw.tracking, 0, 0, 0.3),
    themeOverrides: overrides,
    // An uploaded picture, or one of the ready-made backdrops by name
    // (see backdrops.ts - stored by name so a rebuild cannot break it).
    backgroundImage:
      typeof raw.backgroundImage === "string" &&
      (raw.backgroundImage.startsWith("https://") || isBackdropRef(raw.backgroundImage))
        ? raw.backgroundImage
        : null,
    backgroundOverlay:
      typeof raw.backgroundOverlay === "string" && (isSafeGradient(raw.backgroundOverlay) || isSafeCssValue(raw.backgroundOverlay))
        ? raw.backgroundOverlay.trim()
        : null,
    backgroundDim: num(raw.backgroundDim, d.backgroundDim, 0, 0.95),
    slides,
    header: {
      parasha: bool(header.parasha, d.header.parasha),
      dafYomi: bool(header.dafYomi, d.header.dafYomi),
      logo: bool(header.logo, d.header.logo),
    },
    alerts: {
      enabled: bool(alerts.enabled, d.alerts.enabled),
      events: Array.isArray(alerts.events)
        ? alerts.events.filter((e): e is AlertEvent => ALERT_EVENTS.includes(e as AlertEvent))
        : d.alerts.events,
      leadMinutes: leads.length ? leads : d.alerts.leadMinutes,
      popupSeconds: num(alerts.popupSeconds, d.alerts.popupSeconds, 10, 300),
    },
    ticker: { enabled: bool(ticker.enabled, d.ticker.enabled), text: str(ticker.text, "", 400) },
    countdown: { enabled: bool(countdown.enabled, d.countdown.enabled) },
    shabbat: {
      enabled: bool(shabbat.enabled, d.shabbat.enabled),
      endMinutesAfterSunset: Math.round(num(shabbat.endMinutesAfterSunset, d.shabbat.endMinutesAfterSunset, 18, 90)),
      scenes: normalizeShabbatScenes(shabbat.scenes),
      photos: normalizeShabbatScenes(shabbat.photos).filter((s) => !s.startsWith("art:")),
      rotate: bool(shabbat.rotate, d.shabbat.rotate),
      secondsPerScene: Math.round(num(shabbat.secondsPerScene, d.shabbat.secondsPerScene, 10, 3600)),
    },
    slideshow: {
      images: (Array.isArray(slideshow.images) ? slideshow.images : [])
        .filter((i): i is Record<string, unknown> => isObj(i) && typeof i.url === "string" && i.url.startsWith("https://"))
        .slice(0, 40)
        .map((i) => ({ url: String(i.url), caption: typeof i.caption === "string" ? i.caption.slice(0, 120) : undefined })),
      secondsPerImage: num(slideshow.secondsPerImage, d.slideshow.secondsPerImage, 3, 60),
    },
    texts: Object.fromEntries(
      Object.entries(isObj(raw.texts) ? raw.texts : {})
        .filter((e): e is [string, string] => KEY_RE.test(e[0]) && typeof e[1] === "string")
        .slice(0, 200)
        .map(([k, v]) => [k, v.slice(0, 300)]),
    ),
    hidden: [...new Set((Array.isArray(raw.hidden) ? raw.hidden : []).filter((k): k is string => typeof k === "string" && KEY_RE.test(k)))].slice(0, 300),
    flipped: FLIP_AREAS.filter((a) => Array.isArray(raw.flipped) && raw.flipped.includes(a)),
    customThemes,
    designs,
    gradients: normalizeGradients(raw.gradients),
    backgrounds: normalizeBackgrounds(raw.backgrounds, normalizeGradients(raw.gradients)),
    hiddenReady: [
      ...new Set(
        (Array.isArray(raw.hiddenReady) ? raw.hiddenReady : []).filter(
          (k): k is string => typeof k === "string" && /^(design|theme|bg|frame|box|boardframe|shape|title):[a-z0-9_-]{1,60}$/i.test(k),
        ),
      ),
    ].slice(0, 300),
    frameUploads: [
      ...new Set(
        (Array.isArray(raw.frameUploads) ? raw.frameUploads : [])
          .filter((u): u is string => typeof u === "string" && /^https:\/\/[^\s"'()<>]{1,500}$/.test(u.trim()))
          .map((u) => u.trim()),
      ),
    ].slice(0, 40),
    backgroundGradient: typeof raw.backgroundGradient === "string" && isSafeGradient(raw.backgroundGradient) ? raw.backgroundGradient.trim() : null,
    styles: normalizeStyles(raw.styles, [...TV_THEMES.map((t) => t.id), ...customThemes.map((t) => t.id)]),
    screenLayout: SCREEN_LAYOUTS.includes(raw.screenLayout as ScreenLayout) ? (raw.screenLayout as ScreenLayout) : d.screenLayout,
    screens: withLogoSwitch(normalizeScreens(raw.screens), raw.logos),
    logos: normalizeLogos(raw.logos),
    layouts: normalizeLayouts(raw.layouts),
    customBoxes: normalizeCustomBoxes(raw.customBoxes),
    overflow: {
      mode: isObj(raw.overflow) && ["pause", "loop"].includes(raw.overflow.mode as string) ? (raw.overflow.mode as "pause" | "loop") : "off",
      speed: isObj(raw.overflow) && raw.overflow.speed === "normal" ? "normal" : "slow",
    },
    customIllustrations,
    illustratedStyle: normalizeIllustratedStyle(raw.illustratedStyle),
    frameLooks: normalizeFrameLooks(raw.frameLooks),
    backgroundTune: normalizeBackgroundTune(raw.backgroundTune),
    frameStyle: normalizeFrameStyle(raw.frameStyle),
    dayLooks: normalizeDayLooks(
      raw.dayLooks,
      [...TV_THEMES.map((t) => t.id), ...customThemes.map((t) => t.id)],
      [...ILLUSTRATIONS, ...customIllustrations.map((i) => i.id)],
      [...BUILTIN_DESIGNS.map((x) => x.id), ...designs.map((x) => x.id)],
    ),
    eventImages: normalizeEventImages(raw.eventImages),
    occasions: normalizeOccasions(raw.occasions, BLOCK_IDS, (s) => normalizeScreens([s])?.[0]),
    eventStyles: normalizeEventStyles(raw.eventStyles),
    eventSplash: raw.eventSplash !== false,
    eventAuto: raw.eventAuto === "info" || raw.eventAuto === "off" ? raw.eventAuto : "full",
    eventNationalAuto: raw.eventNationalAuto === true,
    eventDetail: raw.eventDetail === "short" ? "short" : "full",
    eventEverySeconds: num(raw.eventEverySeconds, d.eventEverySeconds, 10, 600),
    prayerRowsPerScreen: num(raw.prayerRowsPerScreen, d.prayerRowsPerScreen, 4, 60),
    prayerDays: (PRAYER_DAYS as readonly string[]).includes(raw.prayerDays as string) ? (raw.prayerDays as PrayerDays) : "today",
    eventCombine: raw.eventCombine === "separate" ? "separate" : "one",
    eventHold: raw.eventHold !== false,
    illustration:
      (ILLUSTRATIONS as readonly string[]).includes(raw.illustration as string) ||
      customIllustrations.some((i) => i.id === raw.illustration)
        ? String(raw.illustration)
        : d.illustration,
    clockStyle: CLOCK_STYLES.includes(raw.clockStyle as ClockStyle) ? (raw.clockStyle as ClockStyle) : d.clockStyle,
    boardFrame:
      BOARD_FRAMES.includes(raw.boardFrame as BoardFrame) ||
      (raw.boardFrame === "picture" && typeof raw.boardFrameImage === "string" && isSafeUrl(raw.boardFrameImage))
        ? (raw.boardFrame as BoardFrame)
        : d.boardFrame,
    boardFrameImage: typeof raw.boardFrameImage === "string" && isSafeUrl(raw.boardFrameImage) ? raw.boardFrameImage : null,
    myBoardFrames: normalizeMyBoardFrames(raw.myBoardFrames),
    titleStyle: TITLE_STYLES.includes(raw.titleStyle as TitleStyle) ? (raw.titleStyle as TitleStyle) : d.titleStyle,
    boardFrameTune: normalizeBoardFrameTune(raw.boardFrameTune),
    frame: normalizeFrame(raw.frame, d.frame),
    spacing: normalizeSpacing(raw.spacing),
    perDevice: normalizePerDevice(raw.perDevice),
  };
}

/**
 * The per-screen overlays, kept only where they say something.
 *
 * An overlay with nothing in it is dropped rather than stored, so that
 * "does this screen differ" is answerable by looking, and a board nobody
 * has customised per screen carries no trace of the feature at all.
 */
function normalizePerDevice(raw: unknown): TvConfig["perDevice"] {
  if (!isObj(raw)) return {};
  const out: TvConfig["perDevice"] = {};
  for (const device of DEVICE_CLASSES) {
    const layer = raw[device];
    if (!isObj(layer)) continue;
    const kept: DeviceOverlay = {};
    for (const [k, v] of Object.entries(layer)) {
      if (v === undefined) continue;
      if (!(k in DEVICE_OVERLAY_KEYS)) continue;
      // The painted board's own settings carry colours that end up in CSS,
      // so a screen's copy is checked exactly as the board's is. Everything
      // else on this list is written by the editor and read straight back.
      (kept as Record<string, unknown>)[k] =
        k === "illustratedStyle"
          ? normalizeIllustratedStyle(v)
          : k === "frameLooks"
            ? normalizeFrameLooks(v)
            : k === "backgroundTune"
              ? normalizeBackgroundTune(v)
              : k === "frameStyle"
                ? normalizeFrameStyle(v)
                : k === "boardFrameTune"
                  ? normalizeBoardFrameTune(v)
                  : v;
    }
    if (Object.keys(kept).length > 0) out[device] = kept;
  }
  return out;
}

/** Guards normalizePerDevice against a stray key from an older board. */
const DEVICE_OVERLAY_KEYS: Record<keyof DeviceOverlay, true> = {
  screenLayout: true, clockStyle: true, boardFrame: true, boardFrameTune: true, boardFrameImage: true, titleStyle: true, frame: true, spacing: true,
  theme: true, themeOverrides: true, backgroundGradient: true, backgroundImage: true, backgroundOverlay: true,
  backgroundDim: true, font: true, textScale: true, tracking: true, texts: true, hidden: true,
  flipped: true, styles: true, header: true, ticker: true, countdown: true,
  illustration: true, illustratedStyle: true, frameLooks: true, backgroundTune: true, frameStyle: true,
};

/**
 * The board as one kind of screen sees it: the shared settings, with that
 * screen's differences laid over them.
 *
 * The result is an ordinary TvConfig, which is the point - everything
 * downstream (the board, the themes, the styles, the editor's preview)
 * carries on knowing nothing about screens.
 *
 * Two merge rules, and the difference between them matters:
 *
 *   The things keyed by element - the wording, the per-element styling,
 *   the colour overrides - merge key by key. "A shorter title on a phone"
 *   should change that one title and leave everything else following the
 *   board, and deleting the key puts it back.
 *
 *   Everything else replaces wholesale, including the lists of what is
 *   hidden and what is flipped. A list cannot merge: if the board hides a
 *   panel and this screen wants it back, no union of two lists can say so.
 *   The editor writes the whole list, so this stays invisible.
 */
export function configForDevice(config: TvConfig, device: DeviceClass | null): TvConfig {
  const layer = device ? config.perDevice?.[device] : undefined;
  if (!layer || Object.keys(layer).length === 0) return config;
  const { texts, styles, themeOverrides, ...rest } = layer;
  return {
    ...config,
    ...rest,
    texts: texts ? { ...config.texts, ...texts } : config.texts,
    styles: styles ? { ...config.styles, ...styles } : config.styles,
    themeOverrides: themeOverrides
      ? { ...config.themeOverrides, ...themeOverrides }
      : config.themeOverrides,
  };
}

/** Does this screen differ from the board at all? */
export function deviceHasOverrides(config: TvConfig, device: DeviceClass): boolean {
  return Object.keys(config.perDevice?.[device] ?? {}).length > 0;
}

/**
 * Makes an edit apply to one screen instead of to the board.
 *
 * The editor is full of functions of the shape (config) => config: pick a
 * theme, hide a panel, retype a title. None of them know that screens
 * exist and none of them should have to. So the edit is run against the
 * board as that screen sees it, and what came out different is kept as
 * that screen's overlay.
 *
 * That means a new control added to the editor next year can be scoped to
 * one screen without anybody remembering to make it so.
 */
export function editForDevice(
  config: TvConfig,
  device: DeviceClass | null,
  edit: (c: TvConfig) => TvConfig,
): TvConfig {
  if (!device) return edit(config);
  const after = edit(configForDevice(config, device));
  const layer = overlayFrom(config, after);
  const perDevice = { ...config.perDevice };
  if (Object.keys(layer).length === 0) delete perDevice[device];
  else perDevice[device] = layer;
  // What a screen may have of its own goes into its overlay; everything else
  // is the board's, whichever screen is being looked at - the libraries (a
  // background kept, a design saved, an upload), the slides, the occasions,
  // the logos. Those were dropped here, silently, while the editor said
  // "נשמר": with the television chosen, a background kept in the gallery
  // was gone.
  const shared: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(after)) {
    if (k in DEVICE_OVERLAY_KEYS || k === "perDevice") continue;
    shared[k] = v;
  }
  return { ...config, ...(shared as Partial<TvConfig>), perDevice, _records: after._records };
}

/** What `after` says that the shared board does not. */
function overlayFrom(base: TvConfig, after: TvConfig): DeviceOverlay {
  const layer: DeviceOverlay = {};
  const set = <K extends keyof DeviceOverlay>(k: K, v: DeviceOverlay[K]) => {
    layer[k] = v;
  };

  for (const key of Object.keys(DEVICE_OVERLAY_KEYS) as (keyof DeviceOverlay)[]) {
    if (key === "texts" || key === "styles" || key === "themeOverrides") continue;
    const a = (after as unknown as Record<string, unknown>)[key];
    const b = (base as unknown as Record<string, unknown>)[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) set(key, a as never);
  }

  // Keyed by element, so only the elements that differ are kept - a screen
  // with one shorter title should not carry a copy of every other title.
  const texts = differingKeys(base.texts, after.texts, () => "");
  if (texts) set("texts", texts);
  const themeOverrides = differingKeys(base.themeOverrides, after.themeOverrides, () => "");
  if (themeOverrides) set("themeOverrides", themeOverrides);
  const styles = differingKeys(base.styles, after.styles, () => ({}) as ElementStyle);
  if (styles) set("styles", styles);

  return layer;
}

/**
 * The entries of `after` that differ from `base`.
 *
 * A key the edit removed is kept as `cleared()` rather than dropped: the
 * overlay is laid over the board, so leaving it out would bring the board's
 * value back, and "no styling on the phone" has to be sayable.
 */
function differingKeys<T>(
  base: Record<string, T>,
  after: Record<string, T>,
  cleared: () => T,
): Record<string, T> | undefined {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(after)) {
    if (JSON.stringify(v) !== JSON.stringify(base[k])) out[k] = v;
  }
  for (const k of Object.keys(base)) {
    if (!(k in after)) out[k] = cleared();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Which cut of a logo to draw: a mark cut for light boards disappears on a
 * navy one, so a logo with a dark-board cut uses it there.
 */
export function logoCut(logo: BoardLogo, lightBoard: boolean): string {
  return lightBoard || !logo.urlDark ? logo.url : logo.urlDark;
}
