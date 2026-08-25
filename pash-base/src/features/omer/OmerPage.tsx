import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Bell, BellOff, ChevronDown, ChevronUp, Star, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getOmerBoardData,
  isOmerPopupEnabled,
  OMER_AFTER_BLESSING,
  OMER_BLESSING,
  OMER_POPUP_ENABLED_KEY,
  formatDayMonth,
} from "./utils/omerUtils";
import { useOmerChecklist } from "./hooks/useOmerChecklist";
import { useOmerReminders } from "./hooks/useOmerReminders";
import { Switch } from "@/components/ui/switch";

/* ─── Sefirot week labels ─────────────────────────────────── */
const WEEK_NAMES = ["חסד", "גבורה", "תפארת", "נצח", "הוד", "יסוד", "מלכות"];

/* ─── Main page ───────────────────────────────────────────── */
export default function OmerPage() {
  const navigate = useNavigate();
  const boardData = useMemo(() => getOmerBoardData(), []);
  const { hebrewYear, currentDay, isInSeason, startDate, endDate, days } = boardData;

  const { counted, toggleDay, markToday, isCounted, stats } = useOmerChecklist(
    hebrewYear,
    currentDay,
  );
  const { config, permission, isNative, enable, disable, updateTime } = useOmerReminders(
    startDate,
    endDate,
  );

  const [showBlessing, setShowBlessing] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [reminderHour, setReminderHour] = useState(config.hour);
  const [reminderMinute, setReminderMinute] = useState(config.minute);
  const [popupEnabled, setPopupEnabled] = useState(() => isOmerPopupEnabled());

  // Keep local time inputs in sync with config
  useEffect(() => {
    setReminderHour(config.hour);
    setReminderMinute(config.minute);
  }, [config.hour, config.minute]);

  const todayEntry = days.find((d) => d.isToday) ?? null;
  const todayCounted = currentDay !== null && isCounted(currentDay);

  /* ─── Scroll today into view ─────────────────────────────── */
  const todayRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  /* ─── Format reminder time ───────────────────────────────── */
  const timeStr = `${String(config.hour).padStart(2, "0")}:${String(config.minute).padStart(2, "0")}`;

  async function handleReminderToggle() {
    if (config.enabled) {
      await disable();
    } else {
      await enable(reminderHour, reminderMinute);
    }
  }

  async function handleTimeChange(h: number, m: number) {
    setReminderHour(h);
    setReminderMinute(m);
    await updateTime(h, m);
  }

  function handlePopupToggle(enabled: boolean) {
    setPopupEnabled(enabled);
    try {
      localStorage.setItem(OMER_POPUP_ENABLED_KEY, String(enabled));
    } catch {
      // Ignore storage errors; UI state is still updated for this session.
    }
  }

  /* ─── Page ───────────────────────────────────────────────── */
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#0f0a1e] text-[#e8dcc8] overflow-x-hidden"
      style={{ fontFamily: "'Noto Serif Hebrew', 'David Libre', serif" }}
    >
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-[#0f0a1e]/95 border-b border-[#c8a44d]/20 backdrop-blur-sm px-4 py-3">
        <div
          className="flex items-center justify-between max-w-2xl mx-auto"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-[#c8a44d]/70 hover:text-[#c8a44d] transition-colors text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>חזרה</span>
          </button>
          <h1
            className="text-xl font-bold tracking-wide"
            style={{ color: "#c8a44d", textShadow: "0 0 20px #c8a44d40" }}
          >
            ✡ ספירת העומר
          </h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pb-24 space-y-6 pt-4">

        {/* ── Season info ── */}
        <div className="text-center text-xs text-[#c8a44d]/50 tracking-wide">
          {new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long" }).format(startDate)}
          {" — "}
          {new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" }).format(endDate)}
        </div>

        {/* ── Today section (only in season) ── */}
        {isInSeason && todayEntry ? (
          <div className="rounded-2xl border border-[#c8a44d]/40 bg-gradient-to-b from-[#1a1030] to-[#110d22] p-5 space-y-4 shadow-[0_0_40px_#c8a44d15]">
            {/* Count display */}
            <div className="text-center space-y-1">
              <p className="text-[#c8a44d]/60 text-sm">היום</p>
              <p
                className="text-4xl font-bold leading-tight"
                style={{ color: "#c8a44d", textShadow: "0 0 30px #c8a44d60" }}
              >
                {todayEntry.hebrewText}
              </p>
              <p className="text-base text-[#e8dcc8]/80 leading-relaxed">{todayEntry.countText}</p>
              <p className="text-sm text-[#c8a44d]/70 italic mt-1">{todayEntry.sefira}</p>
            </div>

            {/* Blessing toggle */}
            <div className="space-y-2">
              <button
                onClick={() => setShowBlessing((p) => !p)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-[#c8a44d]/25 bg-[#c8a44d]/5 hover:bg-[#c8a44d]/10 transition-colors text-sm text-[#c8a44d]/80"
              >
                <span>{showBlessing ? "הסתר ברכה" : "הצג ברכה"}</span>
                {showBlessing ? (
                  <ChevronUp className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
                )}
              </button>

              {showBlessing && (
                <div className="rounded-xl border border-[#c8a44d]/20 bg-[#1a1030]/80 p-4 space-y-3 text-center">
                  <p className="text-sm text-[#e8dcc8]/60 tracking-widest uppercase">ברכה</p>
                  <p className="text-base leading-loose text-[#e8dcc8]">{OMER_BLESSING}</p>
                  <div className="border-t border-[#c8a44d]/15 pt-3">
                    <p className="text-base leading-loose text-[#c8a44d]/90 font-bold">{todayEntry.countText}</p>
                  </div>
                  <div className="border-t border-[#c8a44d]/15 pt-3">
                    <p className="text-sm leading-loose text-[#e8dcc8]/70">{OMER_AFTER_BLESSING}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Mark today button */}
            <button
              onClick={() => (todayCounted ? toggleDay(currentDay!) : markToday())}
              className={cn(
                "w-full py-3 rounded-xl font-semibold text-sm transition-all border",
                todayCounted
                  ? "bg-[#c8a44d]/20 border-[#c8a44d]/50 text-[#c8a44d]"
                  : "bg-[#c8a44d] border-[#c8a44d] text-[#0f0a1e] hover:brightness-110",
              )}
            >
              {todayCounted ? (
                <span className="flex items-center justify-center gap-2">
                  <Check className="h-4 w-4" />
                  ספרתי היום ✓
                </span>
              ) : (
                "סמן כספרתי היום"
              )}
            </button>
          </div>
        ) : (
          /* Not in season */
          <div className="rounded-2xl border border-[#c8a44d]/20 bg-[#1a1030] p-6 text-center space-y-2">
            <p className="text-[#c8a44d] text-lg font-semibold">ספירת העומר</p>
            <p className="text-[#e8dcc8]/60 text-sm">
              ספירת העומר תתחיל ב‑
              {new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long" }).format(startDate)}
            </p>
          </div>
        )}

        {/* ── Stats bar ── */}
        {isInSeason && (
          <div className="rounded-xl border border-[#c8a44d]/20 bg-[#1a1030] px-4 py-3 flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-[#e8dcc8]/70">
              <Flame className="h-4 w-4 text-orange-400" />
              <span>רצף {stats.streak}</span>
            </div>
            <div className="flex-1">
              <div className="h-2 rounded-full bg-[#c8a44d]/15 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#c8a44d]/70 to-[#c8a44d] transition-all"
                  style={{ width: `${stats.percentage}%` }}
                />
              </div>
            </div>
            <div className="text-[#e8dcc8]/70">
              {stats.totalCounted}
              <span className="text-[#c8a44d]/40">/49</span>
            </div>
          </div>
        )}

        {/* ── 49-day board ── */}
        <div className="space-y-3">
          <h2 className="text-[#c8a44d]/80 text-sm text-center tracking-widest">לוח ספירת העומר</h2>

          {/* Week rows */}
          {WEEK_NAMES.map((weekName, weekIdx) => {
            const weekDays = days.slice(weekIdx * 7, weekIdx * 7 + 7);
            return (
              <div key={weekIdx} className="space-y-1">
                {/* Week label */}
                <p className="text-[10px] text-[#c8a44d]/40 text-center tracking-widest">
                  שבוע {weekIdx + 1} — {weekName}
                </p>
                <div className="grid grid-cols-7 gap-1">
                  {weekDays.map((entry) => {
                    const done = isCounted(entry.day);
                    return (
                      <button
                        key={entry.day}
                        ref={entry.isToday ? (todayRef as React.RefObject<HTMLButtonElement>) : undefined}
                        onClick={() => toggleDay(entry.day)}
                        className={cn(
                          "relative flex flex-col items-center justify-center aspect-square rounded-lg border text-center transition-all select-none",
                          "text-[10px] sm:text-xs",
                          // Today
                          entry.isToday &&
                            "border-[#c8a44d] shadow-[0_0_12px_#c8a44d50] bg-gradient-to-b from-[#c8a44d]/20 to-[#c8a44d]/10",
                          // Counted (and not today)
                          !entry.isToday && done && "border-[#c8a44d]/30 bg-[#c8a44d]/8",
                          // Missed (past, not counted)
                          !entry.isToday && entry.isPast && !done && "border-red-900/40 bg-red-950/20",
                          // Future
                          entry.isFuture && !done && "border-[#c8a44d]/10 bg-[#1a1030]/50 opacity-60",
                          // Default
                          !entry.isToday && !entry.isPast && !entry.isFuture && "border-[#c8a44d]/15 bg-[#1a1030]/40",
                        )}
                        title={`יום ${entry.day} — ${entry.sefira}`}
                      >
                        {/* Day number */}
                        <span
                          className={cn(
                            "font-bold leading-none",
                            entry.isToday ? "text-[#c8a44d]" : done ? "text-[#c8a44d]/80" : "text-[#e8dcc8]/50",
                          )}
                        >
                          {entry.day}
                        </span>
                        {/* Date */}
                        <span className="text-[8px] text-[#e8dcc8]/30 leading-none mt-0.5">
                          {formatDayMonth(entry.gregorianDate)}
                        </span>
                        {/* Counted indicator */}
                        {done && (
                          <span className="absolute top-0.5 right-0.5 text-[8px] text-[#c8a44d]">✓</span>
                        )}
                        {/* Today indicator */}
                        {entry.isToday && (
                          <span className="absolute bottom-0.5 left-0.5">
                            <Star className="h-2 w-2 text-[#c8a44d] fill-[#c8a44d]" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Reminders section ── */}
        <div className="rounded-xl border border-[#c8a44d]/20 bg-[#1a1030] overflow-hidden">
          <button
            onClick={() => setRemindersOpen((p) => !p)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-[#e8dcc8]/80 hover:bg-[#c8a44d]/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              {config.enabled ? (
                <Bell className="h-4 w-4 text-[#c8a44d]" />
              ) : (
                <BellOff className="h-4 w-4 text-[#e8dcc8]/40" />
              )}
              <span>
                תזכורת יומית{config.enabled ? ` — ${timeStr}` : " — כבויה"}
              </span>
            </div>
            {remindersOpen ? (
              <ChevronUp className="h-4 w-4 text-[#c8a44d]/50" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[#c8a44d]/50" />
            )}
          </button>

          {remindersOpen && (
            <div className="border-t border-[#c8a44d]/10 px-4 py-4 space-y-4">
              {!isNative && (
                <p className="text-xs text-[#e8dcc8]/40 text-center">
                  תזכורות זמינות ביישום Android בלבד
                </p>
              )}

              {isNative && (
                <>
                  {/* Time picker */}
                  <div className="flex items-center justify-center gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <label className="text-[10px] text-[#c8a44d]/50">שעה</label>
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={reminderHour}
                        onChange={(e) => handleTimeChange(Number(e.target.value), reminderMinute)}
                        className="w-16 text-center bg-[#0f0a1e] border border-[#c8a44d]/25 rounded-lg px-2 py-1.5 text-[#e8dcc8] text-base"
                      />
                    </div>
                    <span className="text-[#c8a44d] text-xl mt-4">:</span>
                    <div className="flex flex-col items-center gap-1">
                      <label className="text-[10px] text-[#c8a44d]/50">דקות</label>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={reminderMinute}
                        onChange={(e) => handleTimeChange(reminderHour, Number(e.target.value))}
                        className="w-16 text-center bg-[#0f0a1e] border border-[#c8a44d]/25 rounded-lg px-2 py-1.5 text-[#e8dcc8] text-base"
                      />
                    </div>
                  </div>

                  {/* Permission denied warning */}
                  {permission === "denied" && (
                    <p className="text-xs text-amber-400/80 text-center bg-amber-950/30 rounded-lg p-2">
                      הרשאת התראות נדחתה — אנא הפעל בהגדרות המכשיר
                    </p>
                  )}

                  {/* Toggle button */}
                  <button
                    onClick={handleReminderToggle}
                    className={cn(
                      "w-full py-2.5 rounded-xl font-semibold text-sm transition-all border",
                      config.enabled
                        ? "bg-transparent border-red-800/50 text-red-400/80 hover:bg-red-950/30"
                        : "bg-[#c8a44d] border-[#c8a44d] text-[#0f0a1e] hover:brightness-110",
                    )}
                  >
                    {config.enabled ? "כבה תזכורת" : "הפעל תזכורת"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Entry popup preference ── */}
        <div className="rounded-xl border border-[#c8a44d]/20 bg-[#1a1030] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-right">
              <p className="text-sm text-[#e8dcc8]/85">פופאפ ספירת העומר בכניסה</p>
              <p className="text-xs text-[#e8dcc8]/50 mt-1">
                כשהאפשרות פעילה, תופיע תזכורת קצרה בכניסה לאפליקציה בעונת העומר.
              </p>
            </div>
            <Switch
              checked={popupEnabled}
              onCheckedChange={handlePopupToggle}
              aria-label="הפעלת פופאפ ספירת העומר"
            />
          </div>
        </div>

      </div>
    </div>
  );
}
