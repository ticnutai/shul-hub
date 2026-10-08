/**
 * The tools tab: earlier versions, import and export, and import from Figma.
 * Part of the board editor (TvDesignPanel), which owns the draft and passes in what this tab needs.
 */
import type { ComponentProps, Dispatch } from "react";
import { toast } from "sonner";
import type { TvConfig } from "@/tv/config";
import { FigmaImport } from "./FigmaImport";
import { TransferPanel } from "./GradientStudio";
import { TvVersions } from "./TvVersions";
import { WorkspaceTransfer } from "./WorkspaceTransfer";
import type { DraftAction } from "./draftState";
import { Section } from "./editorParts";

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
          onRestore={(config, label) => {
            setShownVersion(null);
            dispatch({ type: "edit", key: `restore-version:${label}`, update: () => config });
            toast.success(`הגרסה מ-${label} הוחזרה כטיוטה. "שמור ושדר" מעלה אותה למסכים; "צעד אחורה" (Ctrl+Z) מחזיר.`);
          }}
        />
      </Section>

      <div data-testid="board-transfer-section" className="scroll-mt-24 rounded-xl border p-4 space-y-4">
        <h2 tabIndex={-1} className="font-semibold">ייבוא וייצוא</h2>
        <WorkspaceTransfer config={draft} onImport={(config) => dispatch({ type: "edit", key: "workspace-import", update: () => config })} />
        <TransferPanel onExport={doExport} onImport={doImport} />
      </div>

      <Section
        title="ייבוא מפיגמה"
        hint="קובץ המשתנים (Variables) של פיגמה הופך לצבעי הבסיס של הלוח. בלי טוקן ובלי חשבון - הקובץ נקרא כאן בדפדפן."
      >
        <FigmaImport config={view} onEdit={edit} handoff={figmaHandoff} />
      </Section>

    </>
  );
}
