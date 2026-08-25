import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, Check, LibraryBig } from "lucide-react";
import { ALL_COMMENTATORS, CommentatorConfig, CommentaryMode } from "@/hooks/useCommentaries";

interface CommentaryPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configs: CommentatorConfig[];
  onSave: (configs: CommentatorConfig[]) => void;
}

const MODE_LABELS: Record<CommentaryMode, string> = {
  off: "כבוי",
  inline: "תמיד",
  click: "לחיצה",
};

const MODE_CYCLE: Record<CommentaryMode, CommentaryMode> = {
  off: "inline",
  inline: "click",
  click: "off",
};

export function CommentaryPickerDialog({
  open,
  onOpenChange,
  configs,
  onSave,
}: CommentaryPickerDialogProps) {
  // Local copy we edit before saving
  const [local, setLocal] = useState<CommentatorConfig[]>(() =>
    [...configs].sort((a, b) => a.order - b.order)
  );

  // Reset local state whenever the dialog opens
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        setLocal([...configs].sort((a, b) => a.order - b.order));
      }
      onOpenChange(isOpen);
    },
    [configs, onOpenChange]
  );

  const toggleMode = (id: string) => {
    setLocal((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, mode: MODE_CYCLE[c.mode] } : c
      )
    );
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    setLocal((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next.map((c, i) => ({ ...c, order: i }));
    });
  };

  const moveDown = (index: number) => {
    setLocal((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next.map((c, i) => ({ ...c, order: i }));
    });
  };

  const handleSave = () => {
    onSave(local.map((c, i) => ({ ...c, order: i })));
    onOpenChange(false);
  };

  const activeCount = local.filter((c) => c.mode !== "off").length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal={false}>
      <DialogContent
        data-testid="commentary-picker-dialog"
        overlayClassName="bg-transparent backdrop-blur-none"
        className="w-[calc(100vw-24px)] max-w-md gap-0 overflow-hidden rounded-[28px] border-2 border-[#d8ad4a] bg-white p-0 text-[#102a56] shadow-[0_26px_90px_rgba(2,8,23,0.58)] sm:w-full [&>button]:right-auto [&>button]:left-4 [&>button]:top-4 [&>button]:rounded-full [&>button]:bg-white/10 [&>button]:p-1.5 [&>button]:text-white [&>button]:opacity-100 [&>button:hover]:bg-[#d8ad4a] [&>button:hover]:text-[#102a56]"
        dir="rtl"
      >
        <DialogHeader data-testid="commentary-picker-header" className="border-b-2 border-[#d8ad4a] bg-[#0b234b] px-6 pb-5 pt-5 text-right">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#d8ad4a] bg-white text-[#c59428] shadow-[0_4px_16px_rgba(216,173,74,0.25)]">
              <LibraryBig className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-right text-xl font-extrabold text-white">בחירת מפרשים</DialogTitle>
              <p className="mt-1 text-right text-xs leading-5 text-white/75">
                בחר אילו פירושים יוצגו ובאיזה סדר
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="bg-white px-3 py-4 sm:px-5">
        <div className="commentary-picker-scrollbar max-h-[58vh] space-y-2.5 overflow-y-auto px-1 pb-1">
          {local.map((config, index) => {
            const isActive = config.mode !== "off";
            return (
              <div
                key={config.id}
                data-commentary-option={config.id}
                className={cn(
                  "group flex min-h-[72px] items-center gap-2.5 rounded-2xl border px-3 py-3 shadow-sm transition-all duration-200",
                  isActive
                    ? "border-[#d8ad4a] bg-[#fdf9ef] shadow-[0_5px_18px_rgba(11,35,75,0.10)]"
                    : "border-[#d8e0eb] bg-white hover:border-[#d8ad4a]/60 hover:bg-[#f7f9fc]"
                )}
              >
                {/* Order arrows */}
                <div className="flex shrink-0 flex-col gap-1 rounded-xl bg-[#edf1f7] p-1 shadow-inner">
                  <button
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    aria-label={`העבר את ${config.hebrewName} למעלה`}
                    className="flex h-6 w-6 items-center justify-center rounded-lg text-[#49617f] transition-colors hover:bg-[#d8ad4a] hover:text-[#0b234b] disabled:opacity-20"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => moveDown(index)}
                    disabled={index === local.length - 1}
                    aria-label={`העבר את ${config.hebrewName} למטה`}
                    className="flex h-6 w-6 items-center justify-center rounded-lg text-[#49617f] transition-colors hover:bg-[#d8ad4a] hover:text-[#0b234b] disabled:opacity-20"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Order badge */}
                <span className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  isActive ? "bg-[#d8ad4a] text-[#0b234b]" : "bg-[#e7ecf3] text-[#61728a]"
                )}>
                  {isActive ? index + 1 : "–"}
                </span>

                {/* Commentator name — click to cycle mode */}
                <button
                  onClick={() => toggleMode(config.id)}
                  className="min-w-0 flex-1 rounded-xl px-1 py-2 text-right text-base font-extrabold transition-colors"
                  style={{ color: isActive ? "#0b234b" : "#61728a" }}
                >
                  {config.hebrewName}
                </button>

                {/* Mode badge */}
                <button
                  onClick={() => toggleMode(config.id)}
                  className={cn(
                    "min-w-[58px] shrink-0 rounded-full border px-2.5 py-1.5 text-[11px] font-bold shadow-sm transition-all",
                    config.mode === "inline" &&
                      "border-[#d8ad4a] bg-[#d8ad4a] text-[#0b234b]",
                    config.mode === "click" &&
                      "border-[#0b234b] bg-[#0b234b] text-white",
                    config.mode === "off" &&
                      "border-[#cbd5e1] bg-white text-[#61728a]"
                  )}
                >
                  {MODE_LABELS[config.mode]}
                </button>
              </div>
            );
          })}
        </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#d8ad4a]/55 bg-[#eef2f7] px-4 py-3.5 sm:px-6">
          <span className="rounded-full border border-[#d8ad4a]/45 bg-white px-3 py-1.5 text-xs font-semibold text-[#0b234b] shadow-sm">
            {activeCount > 0 ? `${activeCount} מפרשים פעילים` : "כל המפרשים כבויים"}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-10 rounded-xl border-[#0b234b]/25 bg-white px-4 text-[#0b234b] hover:bg-[#e5eaf1]">
              ביטול
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="h-10 gap-1.5 rounded-xl border border-[#d8ad4a] bg-[#0b234b] px-5 text-white shadow-md shadow-[#0b234b]/25 hover:bg-[#12376f]"
            >
              <Check className="h-3.5 w-3.5" />
              שמור
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
