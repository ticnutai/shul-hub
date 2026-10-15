/**
 * The design tab: kits, background, boxes, frames, text and free parts - for the whole board or one box chosen at its top.
 * Part of the board editor (TvDesignPanel), which owns the draft and passes in what this tab needs.
 */
import type { Dispatch } from "react";
import { DEFAULT_TV_CONFIG, type TvConfig } from "@/tv/config";
import { blankBoard, standardBoard } from "@/tv/blankBoard";
import { allFrameIds, frameLabel, type FrameId } from "@/tv/frameLooks";
import { BlankBoardStarter, type BuildStep } from "./BlankBoardStarter";
import { DesignLibrary } from "./DesignLibrary";
import { ElementsEditor } from "./ElementsEditor";
import { BackgroundLayer, FramesLayer, TextLayer, type LayerProps } from "./LayerEditors";
import { Folded, SubPart } from "./Parts";
import type { DraftAction } from "./draftState";
import { CopyBoxLook, DesignTopics, SELECT_CLASS, Section } from "./editorParts";
import { showDesignTopic, useDesignTopics } from "./designTopics";
import { useElementEditing } from "@/tv/elementEditing";
import { KindPicker } from "./KindPicker";
import { Notice } from "./Notice";
import { isPartsBoard } from "./PartLooks";

export function DesignTab({ draft, scoped, view, edit, dispatch, partTarget, setPartTarget, wholeBoardOnly, setComposerScreen, setGuide, layerProps, textToolsElsewhere }: {
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
}) {
  const { view: topicsView, topic } = useDesignTopics();
  // A board of parts: the topics dress the parts chosen on it, not the boxes of an ordinary board.
  const parts = isPartsBoard(view);
  const editing = useElementEditing();
  const selected = editing?.selected ?? [];
  /** One topic at a time: the others stay drawn (what was typed in them stays), only hidden. */
  const away = (id: string) => topicsView === "switch" && topic !== id;
  return (
    <>
      {/*
        The topics side by side, always in sight: a click shows its
        section (or jumps to it, with all of them down the page). With them, which box the boxes, frames and text are for -
        chosen once here rather than in three pickers of their own.
      */}
      <div
        className="space-y-2 rounded-xl border-2 border-primary/40 bg-background/95 p-3 shadow-sm backdrop-blur sm:sticky sm:top-16 sm:z-[5] min-[1700px]:col-span-2"
        data-testid="parts-scope"
      >
        <DesignTopics />
        {parts ? (
          <div className="space-y-1" data-testid="parts-scope-kinds">
            <p className="text-xs">
              <span className="font-semibold">הלוח בנוי מחלקים:</span> התיבות, המסגרות והטקסט כאן חלים על החלקים שבוחרים בלוח, או על כל החלקים מסוג אחד:
            </p>
            <KindPicker elements={view.elements} selected={selected} select={(ids) => editing?.select(ids)} onKind={() => {}} testId="scope-by-kind" />
          </div>
        ) : (<>
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
        <p className="text-[11px] text-muted-foreground">"•" - לתיבה יש עיצוב משלה.</p>
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
        hint="ערכה ממלאת בלחיצה אחת את החלקים שכתובים מתחתיה (רקע, תיבות, מסגרות, טקסט, פריסה); אחר כך כל חלק משתנה לבד למטה. מה ששלכם - עורכים ומוחקים; ערכה מוכנה - מסתירים ב-✕ ומחזירים מתי שרוצים."
      >
        <div className="space-y-5">
          <SubPart title="התחלה מחדש" hint='לוח ריק שבונים צעד אחרי צעד, הלוח הבסיסי של המערכת, או מחיקת הכול. כל לוח חדש בנוי מחלקים - כל תוכן בקונטיינר משלו. (יש גם "איפוס הערכה הנוכחית" - בלשונית פריסה.)'>
            <BlankBoardStarter
              unavailable={
                wholeBoardOnly
                  ? 'התחלה מחדש היא ללוח כולו: בחרו למעלה "כל המסכים", וצאו מעיצוב המועד, כדי להשתמש בה.'
                  : null
              }
              // Straight onto the board, past the scope: starting over is the whole board's.
              onCreate={(blocks) => {
                dispatch({ type: "edit", key: "start-over:blank", update: (c) => blankBoard(c, blocks) });
                setComposerScreen(0);
                setGuide([]);
              }}
              onStandard={() => dispatch({ type: "edit", key: "start-over:standard", update: (c) => standardBoard(c) })}
              onWipe={() => dispatch({ type: "edit", key: "start-over:wipe", update: () => structuredClone(DEFAULT_TV_CONFIG) })}
            />
          </SubPart>
          <DesignLibrary config={view} onEdit={edit} />
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
    </>
  );
}
