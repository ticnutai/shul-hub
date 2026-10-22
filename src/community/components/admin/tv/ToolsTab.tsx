/**
 * The tools tab: earlier versions, import and export, and import from Figma.
 * Part of the board editor (TvDesignPanel), which owns the draft and passes in what this tab needs.
 */
import { Hint } from "@/components/InfoTip";
import type { ComponentProps, Dispatch } from "react";
import { toast } from "sonner";
import { confirmAction } from "@/components/ConfirmDialog";
import type { TvConfig } from "@/tv/config";
import { FigmaImport } from "./FigmaImport";
import { TransferPanel } from "./GradientStudio";
import { TvVersions } from "./TvVersions";
import { WorkspaceTransfer } from "./WorkspaceTransfer";
import type { DraftAction } from "./draftState";
import { Section } from "./editorParts";
import { Folded } from "./Parts";

export function ToolsTab({ draft, view, edit, dispatch, shownVersion, setShownVersion, setBeforeAfter, showPreview, doExport, doImport, figmaHandoff }: {
  draft: TvConfig;
  view: TvConfig;
  edit: (key: string, update: (c: TvConfig) => TvConfig) => void;
  dispatch: Dispatch<DraftAction>;
  shownVersion: { id: string; label: string; config: TvConfig } | null;
  setShownVersion: (v: { id: string; label: string; config: TvConfig } | null) => void;
  setBeforeAfter: (on: boolean) => void;
  showPreview: () => void;
  doExport: ComponentProps<typeof TransferPanel>["onExport"];
  doImport: ComponentProps<typeof TransferPanel>["onImport"];
  figmaHandoff: ComponentProps<typeof FigmaImport>["handoff"];
}) {
  return (
    <>
      <Section
        id="tools-versions"
        title="גרסאות קודמות"
        hint="כל שמירה שומרת כאן את מה שהיה על המסכים לפניה (40 האחרונות). אפשר להציג גרסה בתצוגה המקדימה, ולהחזיר אותה כטיוטה - ואז 'שמור ושדר' מעלה אותה למסכים."
      >
        <TvVersions
          shown={shownVersion?.id ?? null}
          onShow={(v) => {
            setBeforeAfter(false);
            setShownVersion(v);
            if (v) showPreview();
          }}
          onRestore={async (config, label) => {
            const ok = await confirmAction({
              title: `להחזיר את הגרסה מ-${label} כטיוטה?`,
              description: 'היא תחליף את הטיוטה שעל המסך כאן. המסכים לא משתנים עד "שמור ושדר", ו"צעד אחורה" (Ctrl+Z) מחזיר.',
              confirmLabel: "שחזור",
              destructive: false,
            });
            if (!ok) return;
            setShownVersion(null);
            dispatch({ type: "edit", key: `restore-version:${label}`, update: () => config });
            toast.success(`הגרסה מ-${label} הוחזרה - בטיוטה עד "שמור ושדר"`);
          }}
        />
      </Section>

      {/*
        Every file in and out of the board, in one place: the package of the
        whole board first, then the old file of colours, then the colours of
        a design from פיגמה. (A selection of parts goes out and in from the
        list of parts, in the same words.)
      */}
      <div data-testid="board-transfer-section" className="scroll-mt-24">
        <Section id="tools-transfer" title="ייבוא וייצוא" hint="קובץ אחד עם כל הלוח - לגיבוי או להעברה; קובץ צבעים ישן; וצבעים מעיצוב בפיגמה. כל ייבוא נכנס לטיוטה עד &quot;שמור ושדר&quot;.">
          <h2 tabIndex={-1} className="sr-only">ייבוא וייצוא</h2>
          <WorkspaceTransfer config={draft} onImport={(config) => dispatch({ type: "edit", key: "workspace-import", update: () => config })} />
          <Folded label="קובץ ישן - צבעי בסיס, מעברי צבע ומבנה הלוח" testId="old-transfer">
            <TransferPanel onExport={doExport} onImport={doImport} />
          </Folded>
          <div className="space-y-2 rounded-xl border p-4" data-testid="figma-section">
            <h3 className="font-semibold">צבעים מפיגמה</h3>
            <Hint>קובץ הצבעים שמייצאים מפיגמה (תוכנת העיצוב) הופך לצבעי הבסיס של הלוח. בלי מפתח גישה ובלי חשבון - הקובץ נקרא כאן בדפדפן.</Hint>
            <FigmaImport config={view} onEdit={edit} handoff={figmaHandoff} />
          </div>
        </Section>
      </div>

    </>
  );
}
