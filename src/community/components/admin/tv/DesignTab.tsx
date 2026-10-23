/**
 * The design tab: kits, background, boxes, frames, text and free parts - for the whole board or one box chosen at its top.
 * Part of the board editor (TvDesignPanel), which owns the draft and passes in what this tab needs.
 */
import { Hint, InfoTip } from "@/components/InfoTip";
import type { Dispatch } from "react";
import { toast } from "sonner";
import type { TvConfig } from "@/tv/config";
import { blankBoard } from "@/tv/blankBoard";
import type { SavedDesign } from "@/tv/designs";
import { WIPE_GROUPS, wipeGroups } from "@/tv/wipeGroups";
import { allFrameIds, frameLabel, type FrameId } from "@/tv/frameLooks";
import { BlankBoardStarter, type BuildStep } from "./BlankBoardStarter";
import { DesignLibrary } from "./DesignLibrary";
import { LibraryContext, type LibraryEdit } from "./libraryEdit";
import { useTvLibraryOrder } from "./useTvLibrary";
import { CATALOG_CATEGORIES } from "@/tv/catalogCategories";
import { ElementsEditor } from "./ElementsEditor";
import { BackgroundLayer, FramesLayer, TextLayer, type LayerProps } from "./LayerEditors";
import { Folded, SubPart } from "./Parts";
import type { DraftAction } from "./draftState";
import { CopyBoxLook, DesignTopics, SELECT_CLASS, Section, EditorViewBar, TopicsViewToggle } from "./editorParts";
import { showDesignTopic, useDesignTopics } from "./designTopics";
import { useElementEditing } from "@/tv/elementEditing";
import { Notice } from "./Notice";
import { isPartsBoard } from "./PartLooks";

export function DesignTab({ draft, scoped, view, edit, dispatch, partTarget, setPartTarget, wholeBoardOnly, setComposerScreen, setGuide, layerProps, textToolsElsewhere, todayOccasions = [], onWearFor, topicsNav = true, allTopics = false }: {
  draft: TvConfig;
  scoped: TvConfig;
  view: TvConfig;
  edit: (key: string, update: (c: TvConfig) => TvConfig) => void;
  dispatch: Dispatch<DraftAction>;
  partTarget: string;
  setPartTarget: (v: string) => void;
  wholeBoardOnly: boolean;
  setComposerScreen: (i: number) => void;
  setGuide: (g: BuildStep[] | null) => void;
  layerProps: LayerProps;
  textToolsElsewhere: boolean;
  /** The occasions whose folders of kits open to begin with: the one whose page is edited, else today's. */
  todayOccasions?: string[];
  /** A kit of an occasion's folder made that occasion's, and its page opened (DesignLibrary). */
  onWearFor?: (occasionId: string, kit: SavedDesign) => void;
  /** The row of topics here: only when the editor goes around by tabs (a menu or a search has them already). */
  topicsNav?: boolean;
  /** Every topic in sight, each a title that opens (the folded layout): none hidden for another. */
  allTopics?: boolean;
}) {
  const { view: topicsView, topic } = useDesignTopics();
  // A board of parts: the topics dress the parts chosen on it, not the boxes of an ordinary board.
  const parts = isPartsBoard(view);
  const editing = useElementEditing();
  const selected = editing?.selected ?? [];
  /** One topic at a time: the others stay drawn (what was typed in them stays), only hidden. */
  const away = (id: string) => !allTopics && topicsView === "switch" && topic !== id;
  // The library's order is the gabbai's, on every board (written at once); until it is read, the board's own.
  const libraryOrder = useTvLibraryOrder();
  const library = libraryOrder.order ?? draft.library;
  const editLibrary: LibraryEdit = (key, change) =>
    libraryOrder.ready
      ? void libraryOrder.save(change(libraryOrder.current() ?? draft.library))
      : dispatch({ type: "edit", key: `library:${key}`, update: (c) => ({ ...c, library: change(c.library) }) });
  return (
    <LibraryContext.Provider value={{ library, edit: editLibrary }}>
      {/*
        The topics side by side, always in sight: a click shows its
        section (or jumps to it, with all of them down the page). With them, which box the boxes, frames and text are for -
        chosen once here rather than in three pickers of their own.
      */}
      <div
        className="space-y-2 rounded-xl border-2 border-primary/40 bg-background/95 p-3 shadow-sm backdrop-blur sm:sticky sm:top-16 sm:z-[5] min-[1700px]:col-span-2"
        data-testid="parts-scope"
      >
        {topicsNav && <DesignTopics withView={false} />}
        {/* How the editor looks, and what the topics apply to: one quiet line, not three. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground" data-testid="design-view-line">
          {topicsNav && <TopicsViewToggle />}
          <EditorViewBar />
          {parts && (
            // Choosing all of one kind is the list of parts' own (one row of it, not one here as well): a way there.
            <span className="flex flex-wrap items-center gap-x-1.5 sm:ms-auto" data-testid="parts-scope-kinds">
              <span className="font-semibold text-foreground">חל על: {selected.length ? `${selected.length} שנבחרו בלוח` : "מה שנבחר בלוח"}</span>
              ·
              <button type="button" className="font-medium text-primary underline underline-offset-2"
                onClick={() => { showDesignTopic("design-elements"); window.setTimeout(() => document.querySelector('[data-testid="elements-by-kind"]')?.scrollIntoView({ block: "center" }), 120); }}>
                בחירה לפי סוג
              </button>
              <InfoTip>הלוח בנוי מחלקים: התיבות, המסגרות והטקסט כאן חלים על החלקים שבוחרים בלוח, או על כל החלקים מסוג אחד ("בחירה לפי סוג").</InfoTip>
            </span>
          )}
        </div>
        {parts ? null : (<>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">התיבות, המסגרות והטקסט של:</span>
          <select
            aria-label="התיבות, המסגרות והטקסט של"
            value={partTarget}
            onChange={(e) => setPartTarget(e.target.value)}
            className={`${SELECT_CLASS} h-11 w-full min-w-0 flex-1 text-base sm:h-8 sm:min-w-48 sm:text-sm`}
          >
            <option value="frames">הכול - כל התיבות וכל הלוח</option>
            <optgroup label="תיבה אחת">
              {allFrameIds(draft.customBoxes).map((id) => (
                <option key={id} value={`frame:${id}`}>
                  {frameLabel(id, draft.customBoxes)}
                  {scoped.frameLooks[id] ? " •" : ""}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <Hint>"•" - לתיבה יש עיצוב משלה.</Hint>
        </>)}
        {!parts && partTarget.startsWith("frame:") && (
          <CopyBoxLook
            from={partTarget.slice(6) as FrameId}
            looks={scoped.frameLooks}
            customBoxes={draft.customBoxes}
            onCopy={(to, from) =>
              edit(`copy-look:${from}:${to.join(",")}`, (c) => {
                const look = c.frameLooks[from];
                const frameLooks = { ...c.frameLooks };
                for (const id of to) {
                  if (look) frameLooks[id] = structuredClone(look);
                  else delete frameLooks[id];
                }
                return { ...c, frameLooks };
              })
            }
          />
        )}
      </div>

      <Section
        id="design-sets"
        hidden={away("design-sets")}
        title="1. ערכות"
        hint={'ערכה ממלאת בלחיצה אחת את החלקים שכתובים מתחתיה (רקע, תיבות, מסגרות, טקסט, פריסה); אחר כך כל חלק משתנה לבד למטה. "שכפול לעריכה" יוצר עותק שלכם. מה ששלכם - עורכים ומוחקים; ערכה מוכנה - מסתירים ב-✕ ומחזירים מתי שרוצים. כל הערכות בתיקיות לפי נושא, וגם הערכות שלכם: גוררים ערכה לתיקייה (או "העברה לתיקייה" שמתחתיה), פותחים וסוגרים תיקיות, ומחפשים לפי שם או תגית. שינוי עותק לא משנה ערכות בלוחות אחרים.'}
        // "התחלה מחדש" on the title's own line: its two buttons at the far end, not a part of its own under it.
        aside={<>
          <span className="ms-auto flex items-center gap-1 text-xs font-medium text-muted-foreground">
            התחלה מחדש
            <InfoTip>{'לוח ריק שבונים צעד אחרי צעד (הבחירה הרגילה מסומנת מראש), או מחיקה של מה שבוחרים. כל לוח חדש בנוי מחלקים - כל תוכן בקונטיינר משלו. הכול טיוטה עד "שמור ושדר", ו"צעד אחורה" (Ctrl+Z) מחזיר. (יש גם "איפוס הערכה הנוכחית" - בלשונית פריסה.)'}</InfoTip>
          </span>
          {wholeBoardOnly ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="blank-board">
              ללוח כולו בלבד
              <InfoTip>התחלה מחדש היא ללוח כולו: בחרו למעלה "כל המסכים", וצאו מעיצוב המועד, כדי להשתמש בה.</InfoTip>
            </span>
          ) : (
            <BlankBoardStarter
              unavailable={null}
              // Straight onto the board, past the scope: starting over is the whole board's.
              onCreate={(blocks) => {
                dispatch({ type: "edit", key: "start-over:blank", update: (c) => blankBoard(c, blocks) });
                setComposerScreen(0);
                setGuide([]);
              }}
              onWipe={(groups) => {
                dispatch({ type: "edit", key: `start-over:wipe:${groups.join(",")}`, update: (c) => wipeGroups(c, groups) });
                toast.success(`נמחקו: ${WIPE_GROUPS.filter((g) => groups.includes(g.id)).map((g) => g.name).join(", ")}. זו טיוטה עד "שמור ושדר".`);
              }}
            />
          )}
        </>}
      >
        <div className="space-y-5">
          <DesignLibrary
            config={view}
            onEdit={edit}
            todayTopics={CATALOG_CATEGORIES.filter((t) => t !== "הכול" && todayOccasions.some((o) => o.includes(t)))}
            onWearFor={onWearFor}
          />
        </div>
      </Section>

      <Section
        id="design-background"
        hidden={away("design-background")}
        title="2. רקע"
        hint="מה שמאחורי הלוח: צבע, מעבר צבעים או תמונה (מוכנה או שלכם, עם צבע או מעבר מעליה), מחוונים לכל אחד, ושמירה בגלריה."
      >
        <BackgroundLayer {...layerProps} />
      </Section>

      <Section
        id="design-boxes"
        hidden={away("design-boxes")}
        title="3. תיבות"
        hint="הצורה של התיבה והרקע שלה - לכל התיבות או לתיבה שנבחרה למעלה."
      >
        <FramesLayer {...layerProps} target={partTarget} part="shape" />
        <FramesLayer {...layerProps} target={partTarget} part="background" />
      </Section>

      <Section
        id="design-frames"
        hidden={away("design-frames")}
        title="4. מסגרות"
        hint="מסגרת ללוח כולו (עמודים, פרוכת...), קו מסביב לתיבה וכמה היא בולטת, ומסגרת מיוחדת לתיבה מהגלריה (או מסגרת משלכם)."
      >
        <FramesLayer {...layerProps} target={partTarget} part="frames" />
      </Section>

      <Section
        id="design-text"
        hidden={away("design-text")}
        title="5. טקסט"
        hint="גופן, גודל, צבעים וסגנון הכותרת - לכל הלוח או לתיבה שנבחרה למעלה, ואם רוצים - לחלק מסוים בה (השעה, כותרת...)."
      >
        {parts ? (
          <div className="space-y-3">
            {/* The text bar is one, by the part chosen (and under the preview while editing on the board): a way there, not a second one. */}
            <Notice variant="neutral" data-testid="parts-text-note">
              הלוח בנוי מחלקים: צבע, גופן וגודל של טקסט משנים בחלונית של הטקסט שבחרתם. לכמה יחד - "כל הטקסטים" למעלה.{" "}
              <button type="button" className="font-medium text-primary underline underline-offset-2" onClick={() => showDesignTopic("design-elements")}>
                לכלי הטקסט
              </button>
            </Notice>
            <Folded label="הגופן של הלוח כולו (לטקסטים שאין להם גופן משלהם)" testId="parts-board-text">
              <TextLayer {...layerProps} target="frames" />
            </Folded>
          </div>
        ) : (
          <TextLayer {...layerProps} target={partTarget} />
        )}
      </Section>

      <Section
        id="design-elements"
        hidden={away("design-elements")}
        title="6. חלקים חופשיים"
        hint="עמודים, עיטורים, מסגרות, תיבות, טקסט ותמונות - כל אחד שכבה משלו מעל הלוח: גרירה, שינוי גודל, קיבוץ, נעילה, סדר שכבות וספרייה של חלקים שמורים. בערכה מחלקים - זו הפריסה שלה."
      >
        <ElementsEditor config={view} onEdit={edit} textToolsElsewhere={textToolsElsewhere} />
      </Section>
    </LibraryContext.Provider>
  );
}
