/**
 * Choosing and building a colour set for the prayer book, with a small page that shows it.
 * Split out of the prayer book's page (src/pages/Siddur.tsx).
 */
import { Loader2, Palette, Save, CloudUpload, Pencil, Copy } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { ColorPicker } from "@/components/ColorPicker";
import { DEFAULT_THEME_APPEARANCE, ThemeAppearanceControls } from "@/components/ThemeAppearanceControls";
import { useFontAndColorSettings } from "@/contexts/FontAndColorSettingsContext";
import { useUserRoles } from "@/hooks/useUserRoles";

import { SERIF, lineHeightCSS } from "./siddurText";
import { SIDDUR_PRESET_THEMES, SiddurTheme, normalizeSiddurTheme, siddurAppearance, siddurCardChrome, useSiddurTheme } from "./siddurTheme";

/* ─── SiddurPagePreview ──────────────────────────────────── */
export const PREVIEW_PRAYER = [
  "בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ",
  "מֶלֶךְ הָעוֹלָם אֲשֶׁר יָצַר",
  "אֶת הָאָדָם בְּחָכְמָה",
];
export const PREVIEW_INSTRUCTION = "הוראה: כוון לבך בברכה זו";

export const SiddurPagePreview = ({ theme, label = "תצוגה מקדימה" }: { theme: SiddurTheme; label?: string }) => {
  const { settings } = useFontAndColorSettings();
  const font = settings.siddurFont || "'Noto Serif Hebrew', serif";
  const size = Math.min(settings.siddurSize || 18, 18); // cap at 18 for preview
  const bold = settings.siddurBold;
  const lhVal = lineHeightCSS(settings.siddurLineHeight, settings.siddurLineHeightCustom);
  const headingColor = theme.headingColor ?? theme.accentColor;
  const instrColor   = theme.instructionColor ?? theme.textColor;
  const appearance = siddurAppearance(theme);

  // Resolve solid bg for gradients (use a fallback dark color)
  const solidBg = theme.bg.includes("gradient") || theme.bg.includes("linear")
    ? "#1a1a2e"
    : theme.bg;
  const solidHeaderBg = theme.headerBg.includes("gradient") || theme.headerBg.includes("linear")
    ? theme.accentColor + "cc"
    : theme.headerBg;

  return (
    <div
      className="flex flex-col h-full rounded-lg overflow-hidden"
      style={{ borderStyle: "solid", borderColor: `${theme.accentColor}44`, ...siddurCardChrome(theme) }}
    >
      {/* Preview label */}
      <div className="px-2 py-1 flex items-center justify-between flex-shrink-0"
        style={{ background: solidHeaderBg }}>
        <span style={{
          color: theme.accentColor,
          fontSize: "10px",
          fontFamily: "'Noto Serif Hebrew', serif",
          fontWeight: 700,
          letterSpacing: "0.03em",
        }}>
          ❧ {label} ❧
        </span>
        {/* Mini tab indicators */}
        <div className="flex gap-0.5">
          {["שחרית", "מנחה"].map((t, i) => (
            <span key={t} style={{
              fontSize: "7px",
              padding: "1px 5px",
              borderRadius: `${appearance.buttonRadius}px`,
              background: i === 0 ? theme.accentColor : "rgba(255,255,255,0.1)",
              color: i === 0 ? solidBg : theme.textColor,
              fontFamily: "'Noto Serif Hebrew', serif",
            }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Page body */}
      <div className="flex-1 p-2.5 space-y-1.5 overflow-hidden" style={{ background: solidBg }}>
        {/* Ornament title */}
        <div className="flex items-center justify-center gap-1 mb-1">
          <span style={{ color: theme.accentColor, fontSize: "9px" }}>❧</span>
          <span style={{
            color: theme.accentColor,
            fontSize: "10px",
            fontFamily: "'Noto Serif Hebrew', serif",
            fontWeight: 700,
          }}>שחרית</span>
          <span style={{ color: theme.accentColor, fontSize: "9px", transform: "scaleX(-1)", display: "inline-block" }}>❧</span>
        </div>
        {/* Divider */}
        <div style={{
          height: "1px",
          background: `linear-gradient(90deg, transparent, ${theme.accentColor}, transparent)`,
          marginBottom: "6px",
        }} />

        {/* Section card */}
        <div style={{
          background: theme.cardBg.includes("rgba") || theme.cardBg.includes("#")
            ? theme.cardBg
            : `${theme.accentColor}08`,
          borderStyle: "solid",
          borderColor: theme.cardBorder,
          ...siddurCardChrome(theme),
          padding: "6px 8px",
          direction: "rtl",
        }}>
          {/* Card heading */}
          <div className="flex items-center gap-1 mb-1">
            <span style={{
              display: "inline-block",
              width: "2px",
              height: "10px",
              borderRadius: "1px",
              background: headingColor,
              flexShrink: 0,
            }} />
            <span style={{
              color: headingColor,
              fontSize: `${Math.max(size * 0.78, 10)}px`,
              fontFamily: font,
              fontWeight: 700,
              lineHeight: 1.4,
            }}>ברכות השחר</span>
          </div>

          {/* Thin divider */}
          <div style={{ height: "1px", background: `${theme.accentColor}22`, margin: "4px 0" }} />

          {/* Prayer lines */}
          {PREVIEW_PRAYER.map((line, i) => (
            <p key={i} style={{
              color: theme.textColor,
              fontSize: `${size}px`,
              fontFamily: font,
              fontWeight: bold ? 700 : 400,
              lineHeight: lhVal,
              direction: "rtl",
              margin: 0,
            }}>{line}</p>
          ))}

          {/* Instruction line */}
          <div style={{ height: "1px", background: `${theme.accentColor}22`, margin: "4px 0" }} />
          <p style={{
            color: instrColor,
            fontSize: `${Math.max(size * 0.78, 9)}px`,
            fontFamily: font,
            fontStyle: "italic",
            fontWeight: theme.instructionBold === false ? 400 : 700,
            opacity: 0.85,
            lineHeight: 1.4,
            direction: "rtl",
            margin: 0,
          }}>{PREVIEW_INSTRUCTION}</p>

          {/* Closing prayer line */}
          <p style={{
            color: theme.textColor,
            fontSize: `${size}px`,
            fontFamily: font,
            fontWeight: bold ? 700 : 400,
            lineHeight: lhVal,
            direction: "rtl",
            margin: 0,
          }}>בָּרוּךְ אַתָּה יְיָ</p>
        </div>

        {/* Accent indicator */}
        <div className="flex items-center gap-1 mt-1">
          <span style={{ color: theme.accentColor, fontSize: "8px" }}>✦</span>
          <span style={{ color: theme.accentColor, fontSize: "8px", opacity: 0.6 }}>צבע הדגשה</span>
          <span style={{
            display: "inline-block",
            width: "18px",
            height: "8px",
            borderRadius: "3px",
            background: theme.accentColor,
          }} />
        </div>
      </div>
    </div>
  );
};

/* ─── ThemePicker ────────────────────────────────────────── */
export const COLOR_FIELDS: { key: keyof SiddurTheme; label: string; group: string; colorOnly?: boolean }[] = [
  // Header/tabs — independent container
  { key: "headerBg",           label: "רקע כותרת/טאבים",  group: "כותרת" },
  { key: "headerTextColor",    label: "טקסט כותרת",        group: "כותרת" },
  { key: "headerAccentColor",  label: "הדגשה בכותרת",      group: "כותרת", colorOnly: true },
  // Body
  { key: "bg",               label: "רקע דף",           group: "גוף הדף" },
  { key: "cardBg",           label: "רקע כרטיס",        group: "גוף הדף" },
  { key: "cardBorder",       label: "מסגרת כרטיס",      group: "גוף הדף" },
  { key: "textColor",        label: "טקסט תפילה",       group: "טקסט" },
  { key: "headingColor",     label: "כותרת מקטע",       group: "טקסט" },
  { key: "instructionColor", label: "הוראות / רוביקה",  group: "טקסט" },
  { key: "accentColor",      label: "צבע הדגשה (זהב)",  group: "הדגשה", colorOnly: true },
];

export const ThemePicker = () => {
  const { theme, setTheme, customTheme, customThemes, saveCustomTheme, previewTheme, publicThemes, publishTheme } = useSiddurTheme();
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"presets" | "custom">("presets");
  const [draft, setDraft] = useState<SiddurTheme>({ ...customTheme });
  const [editingThemeId, setEditingThemeId] = useState<string>(customTheme.id);
  const [hoverTheme, setHoverTheme] = useState<SiddurTheme | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  /** On a phone: the sheet folded to its header, so the whole page can be seen. */
  const [minimized, setMinimized] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  // Captures the saved theme at dialog-open time so we can revert on cancel
  const originalThemeRef = useRef<SiddurTheme>(theme);

  // Keep draft in sync when customTheme changes externally
  useEffect(() => { setDraft(prev => ({ ...prev, ...customTheme })); }, [customTheme]);

  // On open: snapshot current theme + position panel near top-right
  useEffect(() => {
    if (open) {
      originalThemeRef.current = theme;
      setPos({
        x: window.innerWidth < 640 ? 8 : Math.max(8, window.innerWidth - 644),
        y: window.innerWidth < 640 ? 8 : 64,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Mouse-drag logic
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      setPos({
        x: Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - 120)),
        y: Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 60)),
      });
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  const startDrag = (e: React.MouseEvent) => {
    if (window.innerWidth < 640) return;
    // Don't start drag when clicking interactive elements inside the handle
    if ((e.target as HTMLElement).closest("button, input")) return;
    e.preventDefault();
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setIsDragging(true);
  };

  // Cancel: revert page to saved theme and close
  const handleClose = () => {
    previewTheme(originalThemeRef.current);
    setDraft({ ...customTheme });
    setOpen(false);
  };

  const allThemes = [
    ...SIDDUR_PRESET_THEMES,
    ...publicThemes,
    ...customThemes.filter(custom => !publicThemes.some(t => t.id === custom.id)),
  ];

  // Mini-preview panel still shows hovered / draft theme
  const previewedTheme: SiddurTheme = tab === "custom" ? draft : (hoverTheme ?? theme);

  const buildCustomTheme = (): SiddurTheme => ({
    ...draft,
    name: draft.name.trim(),
    id: editingThemeId || "custom",
    emoji: "🎨",
    isCustom: true,
  });

  const saveCustom = async () => {
    const t = buildCustomTheme();
    if (!t.name) {
      setPublishError("יש להזין שם לערכת הנושא");
      return;
    }
    setPublishError("");
    try {
      const saved = await saveCustomTheme(t);
      setTheme(saved);
      setEditingThemeId(saved.id);
      setDraft(saved);
      originalThemeRef.current = saved;
      setOpen(false);
      toast.success("ערכת הנושא עודכנה ונשמרה");
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "שמירת ערכת הנושא נכשלה");
    }
  };

  const duplicateCustom = async () => {
    const requestedName = draft.name.trim();
    if (!draft.name.trim()) { setPublishError("יש להזין שם לערכת הנושא"); return; }
    const usedNames = new Set(customThemes.map(item => item.name));
    let uniqueName = requestedName;
    if (usedNames.has(uniqueName)) {
      let copyNumber = 2;
      uniqueName = `${requestedName} – עותק`;
      while (usedNames.has(uniqueName)) uniqueName = `${requestedName} – עותק ${copyNumber++}`;
    }
    const t = { ...buildCustomTheme(), name: uniqueName };
    setPublishError("");
    try {
      const saved = await saveCustomTheme(t, { duplicate: true });
      setTheme(saved);
      setEditingThemeId(saved.id);
      originalThemeRef.current = saved;
      setDraft(saved);
      setTab("presets");
      setHoverTheme(null);
      toast.success("נשמרה ערכה חדשה. אפשר ליצור ולשמור ערכות נוספות");
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "שכפול ערכת הנושא נכשל");
    }
  };

  const applyCustom = async () => {
    if (rolesLoading) {
      setPublishError("בודק הרשאת מנהל, נסה שוב בעוד רגע");
      return;
    }
    if (!isAdmin) {
      setPublishError("רק מנהל יכול לפרסם ערכת נושא לכל המשתמשים");
      return;
    }
    const t = buildCustomTheme();
    if (!t.name) {
      setPublishError("יש להזין שם לערכת הנושא");
      return;
    }
    setPublishing(true);
    setPublishError("");
    try {
      const published = await publishTheme(t);
      await saveCustomTheme(t);
      setTheme(published);
      originalThemeRef.current = published;
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "שגיאה לא ידועה";
      setPublishError(`הפרסום נכשל: ${message}`);
    } finally {
      setPublishing(false);
    }
  };

  const fieldVal = (key: keyof SiddurTheme): string =>
    (draft[key] as string | undefined) ?? "";

  // Update draft AND push live to the page immediately
  const updateDraft = (key: keyof SiddurTheme, value: string) => {
    const newDraft: SiddurTheme = { ...draft, [key]: value, isCustom: true };
    setDraft(newDraft);
    previewTheme(newDraft);
  };

  const groups = Array.from(new Set(COLOR_FIELDS.map(f => f.group)));

  // The editor chrome deliberately uses fixed, accessible colours. The draft theme
  // is applied only to the page/preview, so an experimental palette cannot hide controls.
  const editor = {
    bg: "#101b35",
    surface: "#172544",
    surfaceSoft: "rgba(255,255,255,0.07)",
    text: "#f8fafc",
    muted: "#cbd5e1",
    accent: "#d5aa45",
    border: "rgba(213,170,69,0.28)",
  };
  const mobileViewport = typeof window !== "undefined" && window.innerWidth < 640;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title="ערכת נושא"
        className="flex items-center justify-center h-8 w-8 rounded-lg transition-all hover:opacity-80"
        style={{ background: "transparent", border: "none" }}
      >
        <Palette className="h-4 w-4" style={{ color: "#c8a04d" }} />
      </button>

      {open && (
        <div
          ref={panelRef}
          data-siddur-theme-panel
          className="fixed z-[999] rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden"
          style={{
            left: mobileViewport ? 0 : pos.x,
            right: mobileViewport ? 0 : "auto",
            top: mobileViewport ? "auto" : pos.y,
            bottom: mobileViewport ? 0 : "auto",
            background: editor.bg,
            color: editor.text,
            border: `1px solid ${editor.border}`,
            direction: "rtl",
            height: mobileViewport ? (minimized ? "auto" : "50dvh") : "auto",
            maxHeight: mobileViewport ? "50dvh" : "88vh",
            width: mobileViewport ? "100vw" : "628px",
            maxWidth: "100vw",
            userSelect: isDragging ? "none" : "auto",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Drag handle / header ── */}
          <div
            className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b flex-shrink-0"
            style={{
              borderColor: editor.border,
              cursor: mobileViewport ? "default" : (isDragging ? "grabbing" : "grab"),
            }}
            onMouseDown={startDrag}
          >
            {/* Title + live-preview badge */}
            <div className="flex items-center gap-2 pointer-events-none">
              <span className="text-sm font-bold" style={{ color: editor.accent, fontFamily: "'Noto Serif Hebrew', serif" }}>
                ✦ ערכת נושא
              </span>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(213,170,69,0.16)", color: editor.accent }}
              >
                תצוגה חיה בדף
              </span>
            </div>
            {/* Tabs + close */}
            <div className="flex gap-1 items-center justify-between sm:justify-start">
              <button
                onClick={() => { setTab("presets"); setHoverTheme(null); }}
                className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                style={{ background: tab === "presets" ? editor.accent : editor.surfaceSoft, color: tab === "presets" ? "#101827" : editor.text }}
              >
                בחירת ערכה
              </button>
              <button
                onClick={() => {
                  // Editing starts from the theme in use: a preset is copied into a
                  // draft of its own, a custom theme is edited as it is. It opened
                  // an old separate draft, so a change landed on another theme.
                  if (tab !== "custom" && !theme.isCustom) {
                    const editable = normalizeSiddurTheme({ ...theme, isCustom: true });
                    setDraft(editable);
                    setEditingThemeId("");
                    previewTheme(editable);
                  }
                  setTab("custom");
                  setHoverTheme(null);
                }}
                className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                style={{ background: tab === "custom" ? editor.accent : editor.surfaceSoft, color: tab === "custom" ? "#101827" : editor.text }}
              >
                עריכה מותאמת
              </button>
              {mobileViewport && (
                <button
                  type="button"
                  data-testid="theme-panel-minimize"
                  onClick={() => setMinimized((v) => !v)}
                  className="mr-1 h-6 px-2 flex items-center justify-center rounded-full text-[11px] transition-all hover:opacity-80"
                  style={{ background: editor.surfaceSoft, color: editor.text }}
                  title={minimized ? "הצגת העורך" : "מזעור העורך כדי לראות את הדף"}
                >
                  {minimized ? "הגדל" : "מזער"}
                </button>
              )}
              <button
                onClick={handleClose}
                className="mr-1 h-6 w-6 flex items-center justify-center rounded-full text-sm transition-all hover:opacity-80"
                style={{ background: editor.surfaceSoft, color: editor.text }}
                title="סגור"
              >
                ✕
              </button>
            </div>
          </div>

          {/*
            On a phone the sheet covers the lower half of the page, so a colour
            changed there may be one the reader cannot see. The same preview the
            wide editor keeps in its side column stands here, at the top.
          */}
          {mobileViewport && !minimized && tab === "custom" && (
            <div
              data-testid="theme-mobile-preview"
              className="sm:hidden flex-shrink-0 border-b px-3 py-2"
              style={{ borderColor: editor.border, background: previewedTheme.bg }}
            >
              {/* What a colour here changes: a heading, a line of prayer, an instruction. */}
              <div
                className="rounded-lg border px-3 py-1.5 text-right"
                dir="rtl"
                style={{ background: previewedTheme.cardBg, borderColor: previewedTheme.cardBorder, fontFamily: SERIF }}
              >
                <div className="flex items-center gap-1.5 text-[13px] font-bold" style={{ color: previewedTheme.headingColor ?? previewedTheme.accentColor }}>
                  <span className="inline-block h-3 w-1 rounded-full" style={{ background: previewedTheme.accentColor }} />
                  ברכות השחר
                </div>
                <p className="m-0 text-[15px] leading-snug" style={{ color: previewedTheme.textColor }}>
                  {PREVIEW_PRAYER[0]}
                </p>
                <p
                  className="m-0 text-[12px] italic leading-snug"
                  style={{
                    color: previewedTheme.instructionColor ?? previewedTheme.textColor,
                    opacity: 0.82,
                    fontWeight: previewedTheme.instructionBold === false ? 400 : 700,
                  }}
                >
                  {PREVIEW_INSTRUCTION}
                </p>
              </div>
            </div>
          )}

          {/* ── Body: controls (flex-1) + mini preview (fixed 200px) ── */}
          <div className={`${mobileViewport && minimized ? "hidden" : "flex"} flex-col sm:flex-row flex-1 min-h-0`}>

            {/* Controls column */}
            <div className="overflow-y-auto flex-1 min-w-0">
              {tab === "presets" && (
                <div className="p-3 grid grid-cols-4 gap-2">
                  {allThemes.map(t => (
                    <div
                      key={t.id}
                      data-siddur-theme-option={t.id}
                      onMouseEnter={() => { setHoverTheme(t); previewTheme(t); }}
                      onMouseLeave={() => { setHoverTheme(null); previewTheme(originalThemeRef.current); }}
                      className="relative flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all hover:scale-105"
                      style={{
                        background: theme.id === t.id ? "rgba(213,170,69,0.16)" : editor.surfaceSoft,
                        border: `1.5px solid ${(hoverTheme?.id ?? theme.id) === t.id ? editor.accent : "transparent"}`,
                      }}
                    >
                      <button className="absolute inset-0" aria-label={`בחר ${t.name}`} onClick={() => { setTheme(t); originalThemeRef.current = t; setOpen(false); }} />
                      <div className="h-10 w-10 rounded-lg overflow-hidden flex-shrink-0" style={{ border: `1px solid ${t.accentColor}55` }}>
                        <div className="h-4 w-full" style={{ background: t.bg.includes("gradient") ? t.accentColor : t.bg }} />
                        <div className="h-3 w-full flex items-center justify-center" style={{ background: t.cardBg.includes("rgba") ? t.bg : t.cardBg }}>
                          <span style={{ fontSize: "7px", color: t.textColor, fontFamily: "serif" }}>אבג</span>
                        </div>
                        <div className="h-3 w-full flex items-center justify-center" style={{ background: t.headerBg.includes("gradient") ? t.accentColor : t.headerBg }}>
                          <span style={{ fontSize: "6px", color: t.accentColor }}>❧</span>
                        </div>
                      </div>
                      <span className="text-[9px] text-center leading-tight font-medium" style={{ color: editor.text }}>{t.emoji} {t.name}</span>
                      <button
                        className="relative z-10 mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px]"
                        style={{ background: editor.surface, color: editor.accent }}
                        onClick={() => {
                          const editable = normalizeSiddurTheme({ ...t, isCustom: true });
                          setDraft(editable);
                          setEditingThemeId(t.id.startsWith("custom") ? t.id : "");
                          previewTheme(editable);
                          setTab("custom");
                        }}
                      >
                        <Pencil className="h-2.5 w-2.5" /> ערוך
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {tab === "custom" && (
                <div className="p-3 space-y-4" dir="rtl">
                  {/* Theme name */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold w-24 flex-shrink-0" style={{ color: editor.accent }}>שם ערכה</span>
                    <input
                      type="text"
                      value={draft.name}
                      onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
                      className="flex-1 rounded px-2 py-1 text-xs"
                      style={{ background: editor.surface, border: `1px solid ${editor.border}`, color: editor.text }}
                      dir="rtl"
                      placeholder="שם ערכת הנושא"
                    />
                  </div>

                  {/* Color groups */}
                  {groups.map(group => (
                    <div key={group}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: editor.accent }}>{group}</span>
                        <div className="flex-1 h-px" style={{ background: editor.border }} />
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {COLOR_FIELDS.filter(f => f.group === group).map(({ key, label, colorOnly }) => {
                          const val = fieldVal(key);
                          const isHex = val.startsWith("#");
                          return (
                            <div key={key} className="rounded-lg p-2" style={{ background: editor.surfaceSoft, border: `1px solid ${editor.border}` }}>
                              <span className="mb-1 block text-[11px] font-medium" style={{ color: editor.text }}>{label}</span>
                              <div className="flex flex-col gap-1.5">
                                <div className="w-full">
                                  <ColorPicker
                                    compact
                                    label={label}
                                    value={isHex ? val : "#c8a04d"}
                                    onChange={color => updateDraft(key, color)}
                                  />
                                </div>
                                {!colorOnly && (
                                  <input
                                    type="text"
                                    value={val}
                                    onChange={e => updateDraft(key, e.target.value)}
                                    className="flex-1 rounded px-2 py-1 text-[10px] font-mono min-w-0"
                                    style={{ background: editor.surface, border: `1px solid ${editor.border}`, color: editor.text }}
                                    dir="ltr"
                                    placeholder="#hex / rgba(...) / linear-gradient(...)"
                                  />
                                )}
                                {colorOnly && isHex && (
                                  <span className="text-[10px] font-mono" style={{ color: editor.muted }}>{val}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* The instructions' weight: bold by default, regular for a theme that wants it. */}
                  <label
                    className="flex items-center justify-between gap-3 rounded-lg p-2 text-xs"
                    style={{ background: editor.surfaceSoft, border: `1px solid ${editor.border}` }}
                  >
                    <span style={{ color: editor.text }}>הוראות מודגשות</span>
                    <input
                      type="checkbox"
                      data-testid="theme-instruction-bold"
                      checked={draft.instructionBold !== false}
                      onChange={(e) => {
                        const next = { ...draft, instructionBold: e.target.checked, isCustom: true };
                        setDraft(next);
                        previewTheme(next);
                      }}
                      className="size-4 accent-[#d5aa45]"
                    />
                  </label>

                  <ThemeAppearanceControls
                    value={{
                      cornerRadius: draft.cornerRadius ?? DEFAULT_THEME_APPEARANCE.cornerRadius,
                      buttonRadius: draft.buttonRadius ?? DEFAULT_THEME_APPEARANCE.buttonRadius,
                      borderWidth: draft.borderWidth ?? DEFAULT_THEME_APPEARANCE.borderWidth,
                      shadow: draft.shadow ?? DEFAULT_THEME_APPEARANCE.shadow,
                      headerShadow: draft.headerShadow ?? DEFAULT_THEME_APPEARANCE.headerShadow,
                    }}
                    onChange={appearance => {
                      const next = { ...draft, ...appearance, isCustom: true };
                      setDraft(next);
                      previewTheme(next);
                    }}
                  />

                  {/* Action buttons */}
                  {publishError && <p className="text-xs text-red-300 text-center">{publishError}</p>}
                  <div className="sticky bottom-0 grid grid-cols-4 sm:grid-cols-2 gap-1.5 sm:gap-2 pt-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]" style={{ background: editor.bg }}>
                    <button
                      onClick={() => {
                        const base = SIDDUR_PRESET_THEMES[0];
                        const reset: SiddurTheme = normalizeSiddurTheme({ ...base, id: "custom", name: "מותאם אישית", emoji: "🎨", isCustom: true });
                        setEditingThemeId("");
                        setDraft(reset);
                        previewTheme(reset);
                      }}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                      style={{ background: editor.surfaceSoft, color: editor.text, border: `1px solid ${editor.border}` }}
                    >
                      אפס
                    </button>
                    <button
                      onClick={handleClose}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                      style={{ background: editor.surfaceSoft, color: editor.text, border: `1px solid ${editor.border}` }}
                    >
                      ביטול
                    </button>
                    <button
                      onClick={saveCustom}
                      className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-90"
                      style={{ background: editor.accent, color: "#101827" }}
                      title="שמור והחל במכשיר ובחשבון המחובר"
                    >
                      <Save className="h-3.5 w-3.5" />
                      עדכן
                    </button>
                    <button
                      onClick={duplicateCustom}
                      className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-90"
                      style={{ background: editor.surface, color: editor.text, border: `1px solid ${editor.border}` }}
                    >
                      <Copy className="h-3.5 w-3.5" /> {mobileViewport ? "שכפל" : "שכפל ושמור"}
                    </button>
                    {/* Only an administrator may publish; nobody else needs the button. */}
                    {isAdmin && (
                    <button
                      onClick={applyCustom}
                      disabled={publishing}
                      className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ background: "#2563eb", color: "#ffffff" }}
                      title="פרסם את הערכה לכל המשתמשים"
                    >
                      {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />}
                      {publishing ? "מפרסם..." : "פרסם לכולם"}
                    </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Mini preview column ── */}
            <div
              className="hidden sm:flex flex-col border-r flex-shrink-0"
              style={{
                width: "200px",
                borderColor: editor.border,
                background: "rgba(0,0,0,0.15)",
              }}
            >
              <div className="px-3 py-2 text-center flex-shrink-0" style={{ borderBottom: `1px solid ${editor.border}` }}>
                <span style={{ color: editor.accent, fontSize: "10px", fontFamily: "'Noto Serif Hebrew', serif", opacity: 0.9 }}>
                  {tab === "custom" ? "⟳ תצוגה מקדימה" : "עבר עם העכבר לתצוגה"}
                </span>
              </div>
              <div className="flex-1 p-2.5 overflow-hidden">
                <SiddurPagePreview
                  theme={previewedTheme}
                  label={previewedTheme.name || "תצוגה מקדימה"}
                />
              </div>
              <div className="px-3 py-1.5 text-center flex-shrink-0" style={{ borderTop: `1px solid ${editor.border}` }}>
                <span style={{ color: previewedTheme.accentColor, fontSize: "9px", fontFamily: "'Noto Serif Hebrew', serif" }}>
                  {previewedTheme.emoji} {previewedTheme.name}
                </span>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
