import { Button } from "@/components/ui/button";
import { useDisplayMode } from "@/contexts/DisplayModeContext";

interface ViewModeToggleProps {
  seferId: number;
}

export const ViewModeToggle = ({ seferId: _seferId }: ViewModeToggleProps) => {
  const { displaySettings, updateDisplaySettings } = useDisplayMode();
  const safeSettings = displaySettings || { mode: 'compact' as const, pasukCount: 10 };

  return (
    <div className="inline-flex items-center" dir="rtl">
      <div className="inline-flex items-center gap-2 rounded-2xl border border-accent/30 bg-card/95 p-1.5 shadow-sm">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => updateDisplaySettings({ mode: "compact" })}
          aria-label="שאלות ומפרשים"
          aria-pressed={safeSettings.mode === "compact"}
          title="שאלות ומפרשים"
          className={`h-9 whitespace-nowrap rounded-xl border px-2.5 text-[11px] font-bold leading-none shadow-sm transition-all sm:px-3.5 sm:text-xs ${
            safeSettings.mode === "compact"
              ? "border-accent bg-transparent text-primary shadow-[0_0_0_1px_hsl(var(--accent)/0.12)] hover:bg-transparent"
              : "border-transparent bg-transparent text-primary/85 shadow-none hover:border-accent/35 hover:bg-accent/5"
          }`}
        >
          שאלות ומפרשים
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => updateDisplaySettings({ mode: "luxury" })}
          aria-label="חומש ומפרשים"
          aria-pressed={safeSettings.mode === "luxury"}
          title="חומש ומפרשים"
          className={`h-9 whitespace-nowrap rounded-xl border px-2.5 text-[11px] font-bold leading-none shadow-sm transition-all sm:px-3.5 sm:text-xs ${
            safeSettings.mode === "luxury"
              ? "border-accent bg-transparent text-primary shadow-[0_0_0_1px_hsl(var(--accent)/0.12)] hover:bg-transparent"
              : "border-transparent bg-transparent text-primary/85 shadow-none hover:border-accent/35 hover:bg-accent/5"
          }`}
        >
          חומש ומפרשים
        </Button>
      </div>

    </div>
  );
};
