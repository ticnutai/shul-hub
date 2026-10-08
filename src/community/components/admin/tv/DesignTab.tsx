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
import { SubPart } from "./Parts";
import type { DraftAction } from "./draftState";
import { CopyBoxLook, DesignTopics, Section } from "./editorParts";

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
  return (
    <>
      {/*
        The topics side by side, always in sight: a click jumps to its
        section. With them, which box the boxes, frames and text are for -
        chosen once here rather than in three pickers of their own.
      */}
      <div
        className="sticky top-16 z-[5] space-y-2 rounded-xl border-2 border-primary/40 bg-background/95 p-3 shadow-sm backdrop-blur min-[1700px]:col-span-2"
        data-testid="parts-scope"
      >
        <DesignTopics />
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">התיבות, המסגרות והטקסט של:</span>
          <select
            aria-label="התיבות, המסגרות והטקסט של"
            value={partTarget}
            onChange={(e) => setPartTarget(e.target.value)}
            className="h-9 min-w-48 flex-1 rounded-md border bg-background px-2 text-sm"
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
        {partTarget.startsWith("frame:") && (
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
        title="1. ערכות"
        hint="ערכה ממלאת בלחיצה אחת את החלקים שכתובים מתחתיה (רקע, תיבות, מסגרות, טקסט, פריסה); אחר כך כל חלק משתנה לבד למטה. מה ששלכם - עורכים ומוחקים; ערכה מוכנה - מסתירים ב-✕ ומחזירים מתי שרוצים."
      >
        <div className="space-y-5">
          <SubPart title="התחלה מחדש" hint="לוח ריק שבונים צעד אחרי צעד, הלוח הרגיל של המערכת, או מחיקת הכול.">
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
        title="2. רקע"
        hint="מה שמאחורי הלוח: צבע, מעבר צבעים או תמונה (מוכנה או שלכם, עם צבע או מעבר מעליה), סליידרים לכל אחד, ושמירה בגלריה."
      >
        <BackgroundLayer {...layerProps} />
      </Section>

      <Section
        id="design-boxes"
        title="3. תיבות"
        hint="הצורה של התיבה והרקע שלה - לכל התיבות או לתיבה שנבחרה למעלה."
      >
        <FramesLayer {...layerProps} target={partTarget} part="shape" />
        <FramesLayer {...layerProps} target={partTarget} part="background" />
      </Section>

      <Section
        id="design-frames"
        title="4. מסגרות"
        hint="מסגרת ללוח כולו (עמודים, פרוכת...), קו מסביב לתיבה וכמה היא בולטת, ומסגרת מיוחדת לתיבה מהגלריה (או מסגרת משלכם)."
      >
        <FramesLayer {...layerProps} target={partTarget} part="frames" />
      </Section>

      <Section
        id="design-text"
        title="5. טקסט"
        hint="גופן, גודל, צבעים וסגנון הכותרת - לכל הלוח או לתיבה שנבחרה למעלה, ואם רוצים - לחלק מסוים בה (השעה, כותרת...)."
      >
        <TextLayer {...layerProps} target={partTarget} />
      </Section>

      <Section
        id="design-elements"
        title="6. חלקים חופשיים"
        hint="עמודים, עיטורים, מסגרות, תיבות, טקסט ותמונות - כל אחד שכבה משלו מעל הלוח: גרירה, שינוי גודל, קיבוץ, נעילה, סדר שכבות וספרייה של חלקים שמורים. בערכה מחלקים - זו הפריסה שלה."
      >
        <ElementsEditor config={view} onEdit={edit} textToolsElsewhere={textToolsElsewhere} />
      </Section>
    </>
  );
}
