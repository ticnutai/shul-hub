import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAVY = "text-[#1b2a4a]";
const GOLD_BG = "bg-[#d4af37]";
const GOLD_BORDER = "border-[#d4af37]";

interface TimePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hour: number;
  minute: number;
  onConfirm: (hour: number, minute: number) => void;
}

export function TimePickerDialog({ open, onOpenChange, hour, minute, onConfirm }: TimePickerDialogProps) {
  const [h, setH] = useState(hour);
  const [m, setM] = useState(minute);
  const hourRef = useRef<HTMLDivElement>(null);
  const minRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) { setH(hour); setM(minute); }
  }, [open, hour, minute]);

  // Scroll selected item into view on open
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      hourRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: "center" });
      minRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: "center" });
    }, 50);
    return () => clearTimeout(t);
  }, [open, h, m]);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("w-[340px] sm:w-[400px] p-0 gap-0 bg-white border-2", GOLD_BORDER)} dir="rtl">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className={cn("text-center text-lg font-bold", NAVY)}>בחר שעה</DialogTitle>
        </DialogHeader>

        {/* Preview */}
        <div className="text-center py-3" dir="ltr">
          <span className={cn("text-4xl font-mono font-bold tracking-wider tabular-nums", NAVY)}>
            {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}
          </span>
        </div>

        {/* Scrollable columns */}
        <div className="flex gap-2 px-4 pb-2" dir="ltr">
          {/* Hours */}
          <div className="flex-1 text-center">
            <p className={cn("text-xs font-medium mb-1", NAVY, "opacity-70")}>שעה</p>
            <div
              ref={hourRef}
              className={cn("h-[200px] overflow-y-auto rounded-lg border bg-white scrollbar-thin", GOLD_BORDER)}
            >
              {hours.map((v) => (
                <button
                  key={v}
                  type="button"
                  data-selected={v === h}
                  onClick={() => setH(v)}
                  className={cn(
                    "w-full py-2 text-center text-base font-mono tabular-nums transition-colors",
                    v === h
                      ? cn(GOLD_BG, "text-white font-bold")
                      : cn("hover:bg-[#f5ecd0]", NAVY)
                  )}
                >
                  {String(v).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>

          {/* Minutes */}
          <div className="flex-1 text-center">
            <p className={cn("text-xs font-medium mb-1", NAVY, "opacity-70")}>דקה</p>
            <div
              ref={minRef}
              className={cn("h-[200px] overflow-y-auto rounded-lg border bg-white scrollbar-thin", GOLD_BORDER)}
            >
              {minutes.map((v) => (
                <button
                  key={v}
                  type="button"
                  data-selected={v === m}
                  onClick={() => setM(v)}
                  className={cn(
                    "w-full py-1.5 text-center text-sm font-mono tabular-nums transition-colors",
                    v === m
                      ? cn(GOLD_BG, "text-white font-bold")
                      : cn("hover:bg-[#f5ecd0]", NAVY)
                  )}
                >
                  {String(v).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className={cn("flex gap-2 p-4 pt-2 border-t", GOLD_BORDER)}>
          <Button
            variant="ghost"
            className={cn("flex-1", NAVY)}
            onClick={() => onOpenChange(false)}
          >
            ביטול
          </Button>
          <Button
            className={cn("flex-1 text-white", GOLD_BG, "hover:bg-[#c4a030]")}
            onClick={() => { onConfirm(h, m); onOpenChange(false); }}
          >
            אישור
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
