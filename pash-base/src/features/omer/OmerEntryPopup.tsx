import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getOmerBoardData, isOmerPopupEnabled, OMER_BLESSING } from "./utils/omerUtils";
import { Flame, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ─── localStorage helpers ────────────────────────────────── */

const POPUP_KEY = "omer_popup_dismissed_v1";
const CHECKLIST_KEY = "omer_checklist_v2";

function isDismissedToday(hebrewYear: number, day: number): boolean {
  try {
    const s = localStorage.getItem(POPUP_KEY);
    if (!s) return false;
    const p = JSON.parse(s);
    return p.year === hebrewYear && p.day === day;
  } catch {
    return false;
  }
}

function markDismissed(hebrewYear: number, day: number) {
  try {
    localStorage.setItem(POPUP_KEY, JSON.stringify({ year: hebrewYear, day }));
  } catch { /* ignore */ }
}

function isDayCounted(hebrewYear: number, day: number): boolean {
  try {
    const s = localStorage.getItem(CHECKLIST_KEY);
    if (!s) return false;
    const p = JSON.parse(s);
    return p.year === hebrewYear && Array.isArray(p.counted) && (p.counted as number[]).includes(day);
  } catch {
    return false;
  }
}

function markDayCounted(hebrewYear: number, day: number) {
  try {
    const s = localStorage.getItem(CHECKLIST_KEY);
    let counted: number[] = [];
    if (s) {
      const p = JSON.parse(s);
      if (p.year === hebrewYear) counted = Array.isArray(p.counted) ? [...p.counted] : [];
    }
    if (!counted.includes(day)) {
      counted.push(day);
      counted.sort((a, b) => a - b);
    }
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify({ year: hebrewYear, counted }));

    // Sync to Supabase (best-effort, don't block UI)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.auth.updateUser({
        data: { ...user.user_metadata, omer_checklist: { year: hebrewYear, counted } },
      });
    });
  } catch { /* ignore */ }
}

/* ─── Component ───────────────────────────────────────────── */

export function OmerEntryPopup() {
  const navigate = useNavigate();
  const boardData = useMemo(() => getOmerBoardData(), []);
  const { hebrewYear, currentDay, isInSeason, days } = boardData;
  const popupEnabled = isOmerPopupEnabled();

  const [open, setOpen] = useState(false);
  const [showBlessing, setShowBlessing] = useState(false);
  const [counted, setCounted] = useState(false);

  const todayEntry = useMemo(() => days.find((d) => d.isToday) ?? null, [days]);

  useEffect(() => {
    if (!popupEnabled) return;
    if (!isInSeason || !currentDay || !todayEntry) return;
    // Already dismissed today → don't show
    if (isDismissedToday(hebrewYear, currentDay)) return;
    // Already counted today → still show so they can see it, but mark counted=true
    if (isDayCounted(hebrewYear, currentDay)) setCounted(true);
    const t = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(t);
  }, [popupEnabled, isInSeason, currentDay, hebrewYear, todayEntry]);

  if (!popupEnabled) return null;
  if (!isInSeason || !currentDay || !todayEntry) return null;

  function handleClose() {
    markDismissed(hebrewYear, currentDay!);
    setOpen(false);
  }

  function handleCounted() {
    markDayCounted(hebrewYear, currentDay!);
    markDismissed(hebrewYear, currentDay!);
    setCounted(true);
    toast.success("יישר כוח! ספרת את ספירת העומר ✨", { duration: 3000 });
    setOpen(false);
  }

  function handleGoToOmer() {
    markDismissed(hebrewYear, currentDay!);
    setOpen(false);
    navigate("/omer");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className="max-w-sm p-0 overflow-hidden border-0 rounded-2xl"
        dir="rtl"
        style={{
          background: "linear-gradient(160deg, #1a1030 0%, #0f0a1e 100%)",
          boxShadow: "0 0 60px #c8a44d30, 0 20px 60px rgba(0,0,0,0.6)",
          fontFamily: "'Noto Serif Hebrew', 'David Libre', serif",
        }}
      >
        {/* Gold top border */}
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, transparent, #c8a44d, transparent)" }} />

        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleClose}
              className="text-[#c8a44d]/40 hover:text-[#c8a44d]/70 transition-colors"
              aria-label="סגור"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-[#c8a44d]/70 text-xs tracking-widest">
              <Flame className="h-3.5 w-3.5 text-orange-400" />
              <span>ספירת העומר</span>
            </div>
            <div className="w-4" />
          </div>

          {/* Today's count */}
          <div className="text-center space-y-1.5 py-2">
            <p
              className="text-4xl font-bold leading-tight tracking-wide"
              style={{ color: "#c8a44d", textShadow: "0 0 30px #c8a44d50" }}
            >
              {todayEntry.hebrewText}
            </p>
            <p className="text-base leading-relaxed" style={{ color: "#e8dcc8cc" }}>
              {todayEntry.countText}
            </p>
            <p className="text-sm italic" style={{ color: "#c8a44d99" }}>
              {todayEntry.sefira}
            </p>
          </div>

          {/* Blessing toggle */}
          <div className="space-y-2">
            <button
              onClick={() => setShowBlessing((p) => !p)}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs transition-colors"
              style={{
                border: "1px solid #c8a44d30",
                background: "#c8a44d08",
                color: "#c8a44dbb",
              }}
            >
              <span>{showBlessing ? "הסתר ברכה" : "הצג ברכה לספירה"}</span>
              {showBlessing ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showBlessing && (
              <div
                className="rounded-xl p-4 space-y-3 text-center"
                style={{ border: "1px solid #c8a44d20", background: "#1a1030cc" }}
              >
                <p className="text-xs tracking-widest" style={{ color: "#c8a44d60" }}>ברכה</p>
                <p className="text-sm leading-loose" style={{ color: "#e8dcc8cc" }}>{OMER_BLESSING}</p>
                <div style={{ borderTop: "1px solid #c8a44d20" }} className="pt-3">
                  <p className="text-base leading-loose font-bold" style={{ color: "#c8a44d" }}>
                    {todayEntry.countText}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-1">
            {counted ? (
              <div
                className="w-full py-3 rounded-xl text-sm font-semibold text-center flex items-center justify-center gap-2"
                style={{ background: "#c8a44d20", border: "1px solid #c8a44d50", color: "#c8a44d" }}
              >
                <Check className="h-4 w-4" />
                ספרתי היום ✓
              </div>
            ) : (
              <button
                onClick={handleCounted}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ background: "#c8a44d", color: "#0f0a1e" }}
              >
                ✓ ספרתי!
              </button>
            )}

            <button
              onClick={handleGoToOmer}
              className="w-full py-2.5 rounded-xl text-xs transition-colors"
              style={{
                border: "1px solid #c8a44d20",
                background: "transparent",
                color: "#c8a44d80",
              }}
            >
              פתח דף ספירת העומר
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
