import { useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { FlatPasuk } from "@/types/torah";
import { toHebrewNumber } from "@/utils/hebrewNumbers";
import { formatTorahText } from "@/utils/textUtils";
import { useTextDisplayStyles } from "@/hooks/useTextDisplayStyles";
import { useFontAndColorSettings } from "@/contexts/FontAndColorSettingsContext";
import { useDevice } from "@/contexts/DeviceContext";
import { useBookmarks } from "@/contexts/BookmarksContext";
import { sharePasukWhatsApp, sharePasukEmail, sharePasukLink } from "@/utils/shareUtils";
import { useCommentaries, ALL_COMMENTATORS, CommentatorConfig, CommentaryMode, CommentaryMap } from "@/hooks/useCommentaries";
import { CommentaryPickerDialog } from "@/components/CommentaryPickerDialog";
import { Button } from "@/components/ui/button";
import { Bookmark, BookmarkCheck, X, Share2, Mail, Link2, PanelsTopLeft, MoreHorizontal, BookOpen, Loader2, Library } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createPortal } from "react-dom";
import { TextDisplaySettings } from "@/components/TextDisplaySettings";

// ─── Template definitions ────────────────────────────────────────────────────

type TemplateId = "classic" | "minimal" | "scroll" | "fragment";

interface Template {
  id: TemplateId;
  name: string;
  description: string;
  containerClass: string;
  innerClass: string;
  fontFamily: string;
  lineHeight: string;
  textAlign: "justify" | "right" | "center";
  perekStyle: "ornate" | "simple" | "underline" | "badge";
  pasukNumColor: string;
  background: string;
}

const TEMPLATES: Template[] = [
  {
    id: "classic",
    name: "קלאסי",
    description: "מהודר עם קישוטי זהב",
    containerClass: "bg-card border border-accent/30 rounded-xl shadow-xl",
    innerClass: "px-3 sm:px-10 py-6",
    fontFamily: "'Noto Serif Hebrew', 'David Libre', serif",
    lineHeight: "2.2",
    textAlign: "justify",
    perekStyle: "ornate",
    pasukNumColor: "#c8a04d",
    background: "transparent",
  },
  {
    id: "minimal",
    name: "נקי",
    description: "פשוט ומינימליסטי",
    containerClass: "border-0 shadow-none",
    innerClass: "px-2 sm:px-8 py-5",
    fontFamily: "'Noto Serif Hebrew', sans-serif",
    lineHeight: "2.0",
    textAlign: "right",
    perekStyle: "simple",
    pasukNumColor: "hsl(var(--muted-foreground))",
    background: "transparent",
  },
  {
    id: "scroll",
    name: "גלילה",
    description: "כמו ספר תורה מסורתי",
    containerClass: "bg-[hsl(var(--secondary)/0.3)] border-2 border-accent/50 rounded-lg shadow-2xl",
    innerClass: "px-3 sm:px-12 py-7",
    fontFamily: "'Frank Ruhl Libre', 'Noto Serif Hebrew', serif",
    lineHeight: "2.4",
    textAlign: "justify",
    perekStyle: "underline",
    pasukNumColor: "#8b5e3c",
    background: "transparent",
  },
  {
    id: "fragment",
    name: "כרטיסיות",
    description: "כל פרק בכרטיסיה נפרדת",
    containerClass: "space-y-4",
    innerClass: "px-2 sm:px-6 py-5",
    fontFamily: "'Noto Serif Hebrew', 'David Libre', serif",
    lineHeight: "2.0",
    textAlign: "right",
    perekStyle: "badge",
    pasukNumColor: "hsl(var(--primary))",
    background: "hsl(var(--card))",
  },
];

// ─── Perek Header ─────────────────────────────────────────────────────────────

const PerekHeader = ({ perek, style }: { perek: number; style: Template["perekStyle"] }) => {
  const { settings } = useFontAndColorSettings();
  const titleStyles = useTextDisplayStyles("title");
  const label = `פרק ${toHebrewNumber(perek)}`;
  const titleTextStyle = {
    fontFamily: settings.titleFont,
    fontSize: `${settings.titleSize}px`,
    fontWeight: settings.titleBold ? 700 : 400,
    lineHeight: titleStyles.lineHeight,
    letterSpacing: titleStyles.letterSpacing,
    wordSpacing: titleStyles.wordSpacing,
    textAlign: titleStyles.textAlign,
  };
  const titleContainerStyle = {
    maxWidth: titleStyles.maxWidth,
    marginInline: "auto",
    marginBottom: titleStyles.gap,
  };

  if (style === "ornate") {
    return (
      <div className="text-center relative" style={titleContainerStyle}>
        <div className="flex items-center justify-center gap-3">
          <span style={{ color: "#c8a04d", fontSize: "0.7em" }}>❧</span>
          <span data-luxury-perek-title className="tracking-wide text-[#c8a04d]" style={titleTextStyle}>{label}</span>
          <span style={{ color: "#c8a04d", fontSize: "0.7em", transform: "scaleX(-1)", display: "inline-block" }}>❧</span>
        </div>
        <div className="mx-auto mt-2" style={{ width: "50%", height: "1px", background: "linear-gradient(90deg, transparent, #c8a04d, transparent)" }} />
      </div>
    );
  }
  if (style === "simple") {
    return (
      <div className="text-center" style={titleContainerStyle}>
        <span data-luxury-perek-title className="text-muted-foreground" style={titleTextStyle}>{label}</span>
      </div>
    );
  }
  if (style === "underline") {
    return (
      <div className="text-center border-b border-accent/40 pb-2" style={titleContainerStyle}>
        <span data-luxury-perek-title className="text-accent" style={titleTextStyle}>{label}</span>
      </div>
    );
  }
  // badge
  return (
    <div className="flex items-center gap-3" style={titleContainerStyle}>
      <div className="flex-1 h-px bg-border" />
      <span data-luxury-perek-title className="bg-primary px-3 py-1 text-primary-foreground rounded-full" style={titleTextStyle}>{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
};

// ─── Pasuk Row ────────────────────────────────────────────────────────────────

type CommentaryLabelPosition = "side" | "above";

const CommentaryBlock = ({
  label,
  text,
  fontSize,
  sourceText,
  labelPosition,
}: {
  label: string;
  text: string;
  fontSize: number;
  sourceText: string;
  labelPosition: CommentaryLabelPosition;
}) => {
  const { settings } = useFontAndColorSettings();
  const commentaryStyles = useTextDisplayStyles("commentary");
  const stripHebrewMarks = (value: string) => value
    .normalize("NFD")
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/[^\u05D0-\u05EA]/g, "");

  // A dibbur hamatchil is normally a quotation from the verse. Reuse the
  // authoritative pointed words already bundled with that verse; never guess.
  const pointFromVerse = (heading: string) => {
    if (/[\u0591-\u05C7]/.test(heading)) return heading;
    const headingWords = heading.split(/\s+/).filter(Boolean);
    const verseWords = sourceText.split(/\s+/).filter(Boolean);
    const wanted = headingWords.map(stripHebrewMarks).filter(Boolean);
    if (!wanted.length) return heading;
    const versePlain = verseWords.map(stripHebrewMarks);
    for (let start = 0; start <= versePlain.length - wanted.length; start++) {
      if (wanted.every((word, offset) => versePlain[start + offset] === word)) {
        const punctuation = heading.match(/[.:,;!?]+\s*$/)?.[0] ?? "";
        return `${verseWords.slice(start, start + wanted.length).join(" ")}${punctuation}`;
      }
    }
    return heading;
  };
  const parts = text.split(/(\[\[B\]\][\s\S]*?\[\[\/B\]\])/g).filter(Boolean);
  return (
  <div
    data-luxury-commentary
    dir="rtl"
    className={cn(
      "relative mt-3 mb-1 border-r-2 border-[#c8a04d]/60 pr-3 animate-fade-in",
      labelPosition === "side" && "sm:-mr-[1.1rem] sm:pr-4",
    )}
    style={{
      maxWidth: commentaryStyles.maxWidth,
      marginInline: "auto",
      marginBottom: commentaryStyles.gap,
      fontFamily: settings.commentaryFont,
      fontSize: `${settings.commentarySize || Math.max(fontSize - 4, 13)}px`,
      fontWeight: settings.commentaryBold ? 700 : 400,
      lineHeight: commentaryStyles.lineHeight,
      letterSpacing: commentaryStyles.letterSpacing,
      wordSpacing: commentaryStyles.wordSpacing,
    }}
  >
    <div className={cn(
      "mb-1.5 flex w-full justify-start",
      labelPosition === "side" && "sm:absolute sm:right-0 sm:top-0 sm:mb-0 sm:w-auto sm:translate-x-[calc(100%+0.45rem)]",
    )}>
      <span
        className="inline-flex whitespace-nowrap rounded-md border border-[#c8a04d]/35 bg-background/95 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-[#c8a04d] shadow-sm"
        style={{ fontFamily: "serif" }}
      >
        {label}:
      </span>
    </div>
    <div
      data-luxury-commentary-body
      className="w-full text-foreground/80"
      style={{ textAlign: commentaryStyles.textAlign, textAlignLast: commentaryStyles.textAlign === "justify" ? "right" : undefined }}
    >
      {parts.map((part, index) => {
        const bold = part.startsWith("[[B]]") && part.endsWith("[[/B]]");
        const rawContent = bold ? part.slice(5, -6).trim() : part;
        const content = bold ? pointFromVerse(rawContent) : rawContent;
        return bold
          ? <strong key={index} className="font-bold text-foreground">{content} </strong>
          : <span key={index}>{content}</span>;
      })}
    </div>
  </div>
  );
};

interface CommentaryEntry {
  id: string;
  hebrewName: string;
  text: string;
  mode: CommentaryMode;
}

const PasukRow = ({
  pasuk,
  numColor,
  fontSize,
  isBookmarked,
  onToggleBookmark,
  seferId,
  templateId,
  commentaries,
  isMobile,
  commentaryLabelPosition,
  minimizedMode = false,
}: {
  pasuk: FlatPasuk;
  numColor: string;
  fontSize: number;
  isBookmarked: boolean;
  onToggleBookmark: (pasuk: FlatPasuk) => void;
  seferId: number;
  templateId: TemplateId;
  commentaries: CommentaryEntry[];
  isMobile: boolean;
  commentaryLabelPosition: CommentaryLabelPosition;
  minimizedMode?: boolean;
}) => {
  const { settings } = useFontAndColorSettings();
  const pasukStyles = useTextDisplayStyles("pasuk");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [openCommentaries, setOpenCommentaries] = useState<Set<string>>(new Set());
  const [expandedFromMinimized, setExpandedFromMinimized] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = () => {
    if (actionsOpen) { setActionsOpen(false); return; }
    longPressTimer.current = setTimeout(() => { setActionsOpen(true); }, 500);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };
  const isOrnate = templateId === "classic" || templateId === "scroll";
  const isMinimal = templateId === "minimal";
  const pasukMarker = toHebrewNumber(pasuk.pasuk_num).replace(/[׳״]/g, "");

  const toggleCommentary = (id: string) => {
    setOpenCommentaries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  return (
    <div
      data-theme-card={!isMinimal ? "true" : undefined}
      className={cn(
        "relative group transition-all",
        !isMinimal && "rounded-xl px-3 py-2",
        isOrnate && "bg-gradient-to-l from-accent/5 via-transparent to-accent/5 border border-accent/15",
      )}
      style={{ margin: `0 0 ${pasukStyles.gap}`, minHeight: "1.6em" }}
      onTouchStart={isMobile ? handleTouchStart : undefined}
      onTouchEnd={isMobile ? cancelLongPress : undefined}
      onTouchMove={isMobile ? cancelLongPress : undefined}
    >
      {/* Mobile long-press action overlay */}
      {!minimizedMode && isMobile && actionsOpen && (
        <div className="absolute top-0 left-0 z-50 flex items-center gap-1 bg-background border border-border rounded-lg shadow-lg p-1" dir="ltr">
          <button
            onTouchEnd={(e) => { e.stopPropagation(); onToggleBookmark(pasuk); setActionsOpen(false); }}
            className={cn("p-1.5 rounded transition-colors", isBookmarked ? "text-accent" : "text-muted-foreground")}
            title={isBookmarked ? "הסר סימניה" : "הוסף סימניה"}
          >
            {isBookmarked ? <BookmarkCheck className="h-4 w-4 fill-current" /> : <Bookmark className="h-4 w-4" />}
          </button>
          <button
            onTouchEnd={(e) => { e.stopPropagation(); sharePasukWhatsApp({ seferId, perek: pasuk.perek, pasukNum: pasuk.pasuk_num, pasukText: formatTorahText(pasuk.text), content: pasuk.content || [] }); setActionsOpen(false); }}
            className="p-1.5 rounded text-muted-foreground"
            title="שתף"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            onTouchEnd={(e) => { e.stopPropagation(); sharePasukEmail({ seferId, perek: pasuk.perek, pasukNum: pasuk.pasuk_num, pasukText: formatTorahText(pasuk.text), content: pasuk.content || [] }); setActionsOpen(false); }}
            className="p-1.5 rounded text-muted-foreground"
            title="שתף במייל"
          >
            <Mail className="h-4 w-4" />
          </button>
          <button
            onTouchEnd={(e) => { e.stopPropagation(); sharePasukLink(seferId, pasuk.perek, pasuk.pasuk_num, formatTorahText(pasuk.text)); setActionsOpen(false); }}
            className="p-1.5 rounded text-muted-foreground"
            title="שתף קישור"
          >
            <Link2 className="h-4 w-4" />
          </button>
        </div>
      )}
      {/* Action buttons - desktop only */}
      {!minimizedMode && !isMobile && <div className="mb-2 w-full flex justify-start" dir="ltr">
        <Popover open={actionsOpen} onOpenChange={setActionsOpen}>
          <PopoverTrigger asChild>
            <button
              className="h-8 w-8 rounded-full border border-border/60 bg-background/90 shadow-sm flex items-center justify-center text-muted-foreground hover:text-accent transition-colors"
              title="פעולות פסוק"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" side="bottom" className="w-auto p-1.5" dir="ltr">
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  onToggleBookmark(pasuk);
                  setActionsOpen(false);
                }}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  isBookmarked ? "text-accent" : "text-muted-foreground hover:text-accent"
                )}
                title={isBookmarked ? "הסר סימניה" : "הוסף סימניה"}
              >
                {isBookmarked ? (
                  <BookmarkCheck className="h-4 w-4 fill-current" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => {
                  sharePasukWhatsApp({
                    seferId,
                    perek: pasuk.perek,
                    pasukNum: pasuk.pasuk_num,
                    pasukText: formatTorahText(pasuk.text),
                    content: pasuk.content || [],
                  });
                  setActionsOpen(false);
                }}
                className="p-1.5 rounded text-muted-foreground hover:text-accent transition-colors"
                title="שתף"
              >
                <Share2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  sharePasukEmail({
                    seferId,
                    perek: pasuk.perek,
                    pasukNum: pasuk.pasuk_num,
                    pasukText: formatTorahText(pasuk.text),
                    content: pasuk.content || [],
                  });
                  setActionsOpen(false);
                }}
                className="p-1.5 rounded text-muted-foreground hover:text-accent transition-colors"
                title="שתף במייל"
              >
                <Mail className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  sharePasukLink(seferId, pasuk.perek, pasuk.pasuk_num, formatTorahText(pasuk.text));
                  setActionsOpen(false);
                }}
                className="p-1.5 rounded text-muted-foreground hover:text-accent transition-colors"
                title="שתף קישור"
              >
                <Link2 className="h-4 w-4" />
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>}

      <p
        data-luxury-pasuk-text
        className={cn("relative m-0", minimizedMode && "cursor-pointer rounded-md px-2 py-1 transition-colors hover:bg-accent/10")}
        dir="rtl"
        role={minimizedMode ? "button" : undefined}
        tabIndex={minimizedMode ? 0 : undefined}
        aria-expanded={minimizedMode ? expandedFromMinimized : undefined}
        aria-label={minimizedMode ? `${expandedFromMinimized ? "סגור" : "פתח"} מפרשים לפסוק ${pasukMarker}` : undefined}
        onClick={minimizedMode ? () => setExpandedFromMinimized((previous) => !previous) : undefined}
        onKeyDown={minimizedMode ? (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setExpandedFromMinimized((previous) => !previous);
          }
        } : undefined}
        style={{
          maxWidth: pasukStyles.maxWidth,
          marginInline: "auto",
          fontFamily: settings.pasukFont,
          fontSize: `${fontSize}px`,
          fontWeight: settings.pasukBold ? 700 : 400,
          lineHeight: pasukStyles.lineHeight,
          textAlign: pasukStyles.textAlign,
          letterSpacing: pasukStyles.letterSpacing,
          wordSpacing: pasukStyles.wordSpacing,
        }}
      >
        {/* Pasuk number */}
        <span
          data-luxury-pasuk-marker
          className={cn(
            "absolute top-[0.34em] select-none inline-flex items-center justify-center",
            isMinimal ? "" : "rounded-full px-1.5 border"
          )}
          style={{
            insetInlineStart: "calc(-1.75em - 0.45rem)",
            color: numColor,
            fontWeight: 700,
            fontSize: `${fontSize * 0.68}px`,
            minWidth: isMinimal ? "auto" : "1.75em",
            lineHeight: 1.2,
            borderColor: isMinimal ? "transparent" : `${numColor}55`,
            background: isOrnate ? `${numColor}14` : "transparent",
          }}
        >
          {pasukMarker}&lrm;
        </span>

        {/* The marker floats in a dedicated gutter outside the text column,
            so Torah and commentary text share one uninterrupted right edge. */}
        <span
          data-luxury-pasuk-body
          className="block"
          style={{ width: "calc(100% - 0.875rem)", marginInlineStart: "0.875rem" }}
        >
          {formatTorahText(pasuk.text)}
        </span>
      </p>

      {/* Click-mode toggle buttons — outside <p> to avoid bidi collision */}
      {!minimizedMode && commentaries.some((c) => c.mode === "click") && (
        <div dir="rtl" className="mt-0.5 flex flex-wrap gap-1 justify-end">
          {commentaries
            .filter((c) => c.mode === "click")
            .map((c) => (
              <button
                key={c.id}
                onClick={() => toggleCommentary(c.id)}
                className={cn(
                  "inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold border transition-colors",
                  openCommentaries.has(c.id)
                    ? "bg-[#c8a04d]/20 border-[#c8a04d] text-[#c8a04d]"
                    : "border-[#c8a04d]/40 text-[#c8a04d]/70 hover:border-[#c8a04d] hover:text-[#c8a04d]"
                )}
                title={openCommentaries.has(c.id) ? `הסתר ${c.hebrewName}` : `הצג ${c.hebrewName}`}
              >
                {c.hebrewName}
              </button>
            ))}
        </div>
      )}

      {/* Commentary blocks */}
      {commentaries.map((c) => {
        const show = minimizedMode
          ? expandedFromMinimized
          : c.mode === "inline" || (c.mode === "click" && openCommentaries.has(c.id));
        if (!show) return null;
        return (
          <CommentaryBlock
            key={c.id}
            label={c.hebrewName}
            text={c.text}
            fontSize={fontSize}
            sourceText={pasuk.text}
            labelPosition={commentaryLabelPosition}
          />
        );
      })}
    </div>
  );
};

// ─── Settings Panel ──────────────────────────────────────────────────────────

interface SettingsPanelProps {
  template: TemplateId;
  onTemplateChange: (t: TemplateId) => void;
  fontSize: number;
  onFontSizeChange: (v: number) => void;
  lineHeightOverride: number;
  onLineHeightChange: (v: number) => void;
  commentaryLabelPosition: CommentaryLabelPosition;
  onCommentaryLabelPositionChange: (position: CommentaryLabelPosition) => void;
  onClose: () => void;
  title?: string;
}

const SettingsPanel = ({
  template,
  onTemplateChange,
  fontSize,
  onFontSizeChange,
  lineHeightOverride,
  onLineHeightChange,
  commentaryLabelPosition,
  onCommentaryLabelPositionChange,
  onClose,
  title = "הגדרות תצוגת שמו\"ת",
}: SettingsPanelProps) => createPortal((
  <div
    dir="rtl"
    data-testid="luxury-display-settings-sheet"
    data-back-dismiss="true"
    role="dialog"
    aria-modal="false"
    aria-label={title}
    className="fixed inset-x-0 bottom-0 z-[1000] flex h-[50dvh] max-h-[50dvh] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-accent/40 bg-card shadow-2xl animate-in slide-in-from-bottom duration-300"
  >
    <div className="flex shrink-0 items-center justify-between border-b border-accent/25 bg-card px-4 py-3">
      <h3 className="font-bold text-base text-foreground">{title}</h3>
      <Button data-back-dismiss-action="true" variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full" aria-label="סגור הגדרות תצוגה">
        <X className="h-4 w-4" />
      </Button>
    </div>

    <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] [scrollbar-gutter:stable]">
    {/* Templates */}
    <div className="mb-5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">תבנית עיצוב</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => onTemplateChange(t.id)}
            className={cn(
              "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-right",
              template === t.id
                ? "border-accent bg-accent/10 shadow-md"
                : "border-border hover:border-accent/50 hover:bg-muted/50"
            )}
          >
            <span className="font-bold text-sm text-foreground">{t.name}</span>
            <span className="text-[10px] text-muted-foreground leading-tight">{t.description}</span>
          </button>
        ))}
      </div>
    </div>

    <div className="mb-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">מיקום שם המפרש</p>
      <div className="grid grid-cols-2 gap-2">
        {([[
          "side", "שם בצד",
        ], [
          "above", "שם מעל",
        ]] as const).map(([position, label]) => (
          <button
            key={position}
            type="button"
            onClick={() => onCommentaryLabelPositionChange(position)}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
              commentaryLabelPosition === position
                ? "border-accent bg-accent/15 text-accent"
                : "border-border bg-background text-foreground hover:border-accent/50",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">במסך צר השם מוצג מעל הטקסט כדי שלא ייחתך.</p>
    </div>

    {/* Font size */}
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">גודל גופן</p>
        <span className="text-xs text-accent font-bold">{fontSize}px</span>
      </div>
      <Slider
        dir="rtl"
        min={14}
        max={36}
        step={1}
        value={[fontSize]}
        onValueChange={(v) => onFontSizeChange(v[0])}
        className="[&_.relative]:bg-accent/20 [&_[role=slider]]:border-accent [&_[role=slider]]:bg-accent"
      />
    </div>

    {/* Line height */}
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">מרווח שורות</p>
        <span className="text-xs text-accent font-bold">{lineHeightOverride.toFixed(1)}</span>
      </div>
      <Slider
        dir="rtl"
        min={1.4}
        max={3.5}
        step={0.1}
        value={[lineHeightOverride]}
        onValueChange={(v) => onLineHeightChange(v[0])}
        className="[&_.relative]:bg-accent/20 [&_[role=slider]]:border-accent [&_[role=slider]]:bg-accent"
      />
    </div>
    </div>
  </div>
), document.body);

// ─── Main Component ───────────────────────────────────────────────────────────

interface LuxuryTextViewProps {
  pesukim: FlatPasuk[];
  expandAll?: boolean;
  navigation?: ReactNode;
  settingsTitle?: string;
  commentaryStorageKey?: string;
  availableCommentators?: Omit<CommentatorConfig, "mode" | "order">[];
  textSettingsPortalId?: string;
}

export const LuxuryTextView = ({
  pesukim,
  expandAll = true,
  navigation,
  settingsTitle,
  commentaryStorageKey = "commentaryConfigs",
  availableCommentators = ALL_COMMENTATORS,
  textSettingsPortalId,
}: LuxuryTextViewProps) => {
  const displayStyles = useTextDisplayStyles();
  const { settings } = useFontAndColorSettings();
  const { isMobile } = useDevice();
  const { isBookmarked, toggleBookmark } = useBookmarks();

  const [templateId, setTemplateId] = useState<TemplateId>("classic");
  const [showSettings, setShowSettings] = useState(false);
  const [fontSizeOverride, setFontSizeOverride] = useState<number | null>(null);
  const [lineHeightOverride, setLineHeightOverride] = useState<number | null>(null);
  const [showCommentaryPicker, setShowCommentaryPicker] = useState(false);
  const [textSettingsHost, setTextSettingsHost] = useState<HTMLElement | null>(null);
  const commentarySwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const [commentaryLabelPosition, setCommentaryLabelPosition] = useState<CommentaryLabelPosition>(() =>
    localStorage.getItem("commentary-label-position") === "above" ? "above" : "side"
  );

  const updateCommentaryLabelPosition = useCallback((position: CommentaryLabelPosition) => {
    setCommentaryLabelPosition(position);
    localStorage.setItem("commentary-label-position", position);
  }, []);

  useEffect(() => {
    if (!textSettingsPortalId) {
      setTextSettingsHost(null);
      return;
    }
    setTextSettingsHost(document.getElementById(textSettingsPortalId));
  }, [textSettingsPortalId]);

  const textSettingsControl = (
    <span data-layout="luxury-text-settings" data-layout-label="T הגדרות טקסט לחומש ומפרשים">
      <TextDisplaySettings initialTab="pasuk" showPasukCount={false} />
    </span>
  );

  /** Commentator configs — persisted in localStorage */
  const [commentaryConfigs, setCommentaryConfigs] = useState<CommentatorConfig[]>(() => {
    try {
      const saved = localStorage.getItem(commentaryStorageKey);
      if (saved) {
        const parsed: CommentatorConfig[] = JSON.parse(saved);
        const allowedIds = new Set(availableCommentators.map((commentator) => commentator.id));
        const retained = parsed.filter((commentator) => allowedIds.has(commentator.id));
        const retainedIds = new Set(retained.map((commentator) => commentator.id));
        const extras = availableCommentators
          .filter((c) => !retainedIds.has(c.id))
          .map((c, i) => ({ ...c, mode: "off" as CommentaryMode, order: retained.length + i }));
        return [...retained, ...extras].sort((a, b) => a.order - b.order);
      }
    } catch { /* ignore invalid localStorage data */ }
    return availableCommentators.map((c, i) => ({
      ...c,
      mode: c.id === "Rashi" ? ("inline" as CommentaryMode) : ("off" as CommentaryMode),
      order: i,
    }));
  });

  const saveCommentaryConfigs = useCallback((configs: CommentatorConfig[]) => {
    setCommentaryConfigs(configs);
    try { localStorage.setItem(commentaryStorageKey, JSON.stringify(configs)); } catch { /* ignore quota exceeded */ }
  }, [commentaryStorageKey]);

  const activeConfigs = useMemo(
    () => commentaryConfigs.filter((c) => c.mode !== "off"),
    [commentaryConfigs]
  );

  const [displayedCount, setDisplayedCount] = useState(10);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const loadMoreStep = Math.max(6, displayStyles.isMobile ? 6 : 12);
  const displayedPesukim = useMemo(() => pesukim.slice(0, displayedCount), [pesukim, displayedCount]);
  const hasMore = displayedCount < pesukim.length;
  const loadMore = useCallback(() => {
    setDisplayedCount((prev) => Math.min(prev + loadMoreStep, pesukim.length));
  }, [loadMoreStep, pesukim.length]);

  const { maps: commentaryMaps, loading: commentaryLoading } = useCommentaries(
    displayedPesukim,
    commentaryConfigs
  );

  const template = TEMPLATES.find((t) => t.id === templateId)!;

  const baseFontSize = settings.pasukSize || 22;
  const scale = displayStyles.fontScale;
  const rawSize = fontSizeOverride ?? (isMobile ? Math.min(baseFontSize * scale, 28) : baseFontSize * scale);
  const effectiveSize = Math.round(rawSize);
  const effectiveLineHeight = lineHeightOverride ?? Number.parseFloat(displayStyles.lineHeight);

  // A change made in the dedicated T editor must take precedence over an old
  // quick override from the template panel.
  useEffect(() => {
    setFontSizeOverride(null);
  }, [settings.pasukSize]);
  useEffect(() => {
    setLineHeightOverride(null);
  }, [settings.pasukLineHeight, settings.pasukLineHeightCustom]);

  // Minimizing keeps the verses visible. Each verse independently reveals its
  // commentaries when tapped, while the expanded view keeps the full layout.
  const visiblePesukim = displayedPesukim;

  // Group only visible verses to keep this mode lightweight on mobile.
  useEffect(() => {
    setDisplayedCount(Math.min(10, pesukim.length));
  }, [pesukim]);

  useEffect(() => {
    if (!hasMore) return;
    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      {
        root: null,
        rootMargin: "280px",
        threshold: 0.01,
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMore, displayedCount]);
  const perekGroups: { perek: number; pesukim: FlatPasuk[] }[] = [];
  for (const pasuk of visiblePesukim) {
    const last = perekGroups[perekGroups.length - 1];
    if (last && last.perek === pasuk.perek) {
      last.pesukim.push(pasuk);
    } else {
      perekGroups.push({ perek: pasuk.perek, pesukim: [pasuk] });
    }
  }

  const handleToggleBookmark = useCallback(
    async (pasuk: FlatPasuk) => {
      const pasukId = `${pasuk.sefer}-${pasuk.perek}-${pasuk.pasuk_num}`;
      await toggleBookmark(pasukId, pasuk.text);
    },
    [toggleBookmark]
  );

  const handleCommentarySwipeStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile || event.touches.length !== 1) return;
    const touch = event.touches[0];
    commentarySwipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, [isMobile]);

  const handleCommentarySwipeEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const start = commentarySwipeStartRef.current;
    commentarySwipeStartRef.current = null;
    if (!start || !isMobile || event.changedTouches.length === 0) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (deltaX >= 72 && Math.abs(deltaY) <= Math.max(60, Math.abs(deltaX) * 0.65)) {
      event.preventDefault();
      setShowCommentaryPicker(true);
    }
  }, [isMobile]);

  if (pesukim.length === 0) {
    return (
      <div className="p-12 text-center animate-fade-in">
        <p className="text-lg text-muted-foreground">אין פסוקים להצגה</p>
      </div>
    );
  }

  // Fragment template renders each perek as its own card
  const isFragmentMode = templateId === "fragment";

  return (
    <div
      className="w-full"
      data-luxury-template={templateId}
      data-no-page-swipe
      data-commentary-swipe-surface
      style={{ maxWidth: "100%", margin: "0", touchAction: "pan-y" }}
      onTouchStartCapture={handleCommentarySwipeStart}
      onTouchEndCapture={handleCommentarySwipeEnd}
      onTouchCancelCapture={() => { commentarySwipeStartRef.current = null; }}
    >
      {textSettingsHost && createPortal(textSettingsControl, textSettingsHost)}
      {/* Gold divider between the main view-mode controls and this view's tools */}
      <div data-layout="luxury-top-divider" className="mb-4 flex items-center justify-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[hsl(var(--accent))] to-transparent" />
        <span className="text-2xl" style={{ color: "#c8a04d" }}>✦</span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[hsl(var(--accent))] to-transparent" />
      </div>

      {/* Toolbar */}
      <div data-layout="luxury-toolbar" className="mb-4 grid min-h-11 w-full grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 px-1" dir="ltr">
        <div className="flex h-11 w-11 items-center justify-center">
          {!textSettingsPortalId && textSettingsControl}
        </div>
        <div className="flex min-w-0 items-center justify-center" dir="rtl">
          <div className="inline-flex items-center rounded-2xl border border-accent/30 bg-card/95 p-1.5 shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCommentaryPicker(true)}
              className={cn(
                "h-9 gap-1.5 whitespace-nowrap rounded-xl border px-2.5 text-[11px] font-bold leading-none shadow-sm transition-all sm:px-3.5 sm:text-xs",
                activeConfigs.length > 0
                  ? "border-accent bg-transparent text-primary shadow-[0_0_0_1px_hsl(var(--accent)/0.12)] hover:bg-transparent"
                  : "border-transparent bg-transparent text-primary/85 shadow-none hover:border-accent/35 hover:bg-accent/5"
              )}
              title="בחירת מפרשים"
            >
              {commentaryLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Library className="h-3.5 w-3.5" />
              )}
              בחירת מפרשים
              {activeConfigs.length > 0 && (
                <span className="text-[10px] opacity-70">({activeConfigs.length})</span>
              )}
            </Button>
          </div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center justify-self-end" dir="rtl">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings((previous) => !previous)}
            aria-label="פתח הגדרות תצוגה"
            aria-expanded={showSettings}
            className={cn(
              "h-8 w-8 shrink-0 rounded-lg border-0 bg-transparent p-0 text-[#c8a04d] shadow-none ring-0 transition-all hover:bg-[#c8a04d]/10 hover:text-[#c8a04d]",
              showSettings && "bg-[#c8a04d]/10"
            )}
            title="פתח הגדרות תצוגה"
          >
            <PanelsTopLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {navigation && <div
        data-layout="luxury-navigation-row"
        className="mb-4 grid min-h-11 w-full grid-cols-[68px_minmax(0,1fr)_68px] items-center px-1"
        dir="ltr"
      >
        <div aria-hidden="true" className="h-8 w-[68px]" />
        <div className="flex min-w-0 items-center justify-center" dir="rtl">
          {navigation}
        </div>
        <div aria-hidden="true" className="h-8 w-[68px]" />
      </div>}

      {/* Commentary Picker Dialog */}
      <CommentaryPickerDialog
        open={showCommentaryPicker}
        onOpenChange={setShowCommentaryPicker}
        configs={commentaryConfigs}
        onSave={saveCommentaryConfigs}
      />

      {/* Settings Panel */}
      {showSettings && (
        <SettingsPanel
          template={templateId}
          onTemplateChange={(t) => {
            setTemplateId(t);
            setLineHeightOverride(null); // reset line height when changing template
          }}
          fontSize={effectiveSize}
          onFontSizeChange={setFontSizeOverride}
          lineHeightOverride={effectiveLineHeight}
          onLineHeightChange={setLineHeightOverride}
          commentaryLabelPosition={commentaryLabelPosition}
          onCommentaryLabelPositionChange={updateCommentaryLabelPosition}
          onClose={() => setShowSettings(false)}
          title={settingsTitle}
        />
      )}

      {/* Content */}
      {!expandAll && (
        <div className="space-y-2" dir="rtl">
          {visiblePesukim.map((pasuk) => {
            const pasukId = `${pasuk.sefer}-${pasuk.perek}-${pasuk.pasuk_num}`;
            return (
              <PasukRow
                key={pasuk.id}
                pasuk={pasuk}
                numColor={template.pasukNumColor}
                fontSize={effectiveSize}
                isBookmarked={isBookmarked(pasukId)}
                onToggleBookmark={handleToggleBookmark}
                seferId={pasuk.sefer}
                templateId="minimal"
                commentaries={commentaryConfigs
                  .filter((c) => c.mode !== "off")
                  .map((c) => ({
                    id: c.id,
                    hebrewName: c.hebrewName,
                    text: commentaryMaps[c.id]?.get(pasukId) ?? "",
                    mode: c.mode,
                  }))
                  .filter((c) => c.text !== "")}
                isMobile={isMobile}
                commentaryLabelPosition={commentaryLabelPosition}
                minimizedMode
              />
            );
          })}
        </div>
      )}
      {expandAll && (
      <>
      {isFragmentMode ? (
        <div className="space-y-4">
          {perekGroups.map((group) => (
            <div
              key={group.perek}
              data-theme-card
              className="rounded-xl border border-border/60 shadow-md overflow-hidden"
              style={{ background: template.background }}
            >
              <div className={template.innerClass}>
                <PerekHeader perek={group.perek} style={template.perekStyle} />
                <div
                  dir="rtl"
                  style={{
                    fontFamily: settings.pasukFont || template.fontFamily,
                    fontSize: `${effectiveSize}px`,
                    lineHeight: `${effectiveLineHeight}`,
                    textAlign: template.textAlign,
                    letterSpacing: displayStyles.letterSpacing,
                    wordSpacing: displayStyles.wordSpacing,
                    paddingInlineStart: displayStyles.isMobile ? "0.15rem" : "1.1rem",
                  }}
                >
                  {group.pesukim.map((pasuk) => {
                    const pasukId = `${pasuk.sefer}-${pasuk.perek}-${pasuk.pasuk_num}`;
                    return (
                      <PasukRow
                        key={pasuk.id}
                        pasuk={pasuk}
                        numColor={template.pasukNumColor}
                        fontSize={effectiveSize}
                        isBookmarked={isBookmarked(pasukId)}
                        onToggleBookmark={handleToggleBookmark}
                        seferId={pasuk.sefer}
                        templateId={template.id}
                        commentaries={commentaryConfigs
                          .filter((c) => c.mode !== "off")
                          .map((c) => ({
                            id: c.id,
                            hebrewName: c.hebrewName,
                            text: commentaryMaps[c.id]?.get(pasukId) ?? "",
                            mode: c.mode,
                          }))
                          .filter((c) => c.text !== "")}
                        isMobile={isMobile}
                        commentaryLabelPosition={commentaryLabelPosition}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={template.containerClass}>
          <div
            className={template.innerClass}
            dir="rtl"
            style={{
              fontFamily: settings.pasukFont || template.fontFamily,
              fontSize: `${effectiveSize}px`,
              color: "hsl(var(--foreground))",
              lineHeight: `${effectiveLineHeight}`,
              textAlign: template.textAlign,
              letterSpacing: displayStyles.letterSpacing,
              wordSpacing: displayStyles.wordSpacing,
            }}
          >
            {perekGroups.map((group) => (
              <div key={group.perek} className="mb-8 last:mb-0">
                <PerekHeader perek={group.perek} style={template.perekStyle} />
                <div style={{ paddingInlineStart: displayStyles.isMobile ? "0.15rem" : "1.1rem" }}>
                  {group.pesukim.map((pasuk) => {
                    const pasukId = `${pasuk.sefer}-${pasuk.perek}-${pasuk.pasuk_num}`;
                    return (
                      <PasukRow
                        key={pasuk.id}
                        pasuk={pasuk}
                        numColor={template.pasukNumColor}
                        fontSize={effectiveSize}
                        isBookmarked={isBookmarked(pasukId)}
                        onToggleBookmark={handleToggleBookmark}
                        seferId={pasuk.sefer}
                        templateId={template.id}
                        commentaries={commentaryConfigs
                          .filter((c) => c.mode !== "off")
                          .map((c) => ({
                            id: c.id,
                            hebrewName: c.hebrewName,
                            text: commentaryMaps[c.id]?.get(pasukId) ?? "",
                            mode: c.mode,
                          }))
                          .filter((c) => c.text !== "")}
                        isMobile={isMobile}
                        commentaryLabelPosition={commentaryLabelPosition}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decorative bottom border (non-fragment modes) */}
      {!isFragmentMode && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[hsl(var(--accent))] to-transparent" />
          <span className="text-2xl" style={{ color: "#c8a04d" }}>✦</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[hsl(var(--accent))] to-transparent" />
        </div>
      )}

      </>
      )}

      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center mt-5">
          <Button
            variant="outline"
            onClick={loadMore}
            className="border-accent/50"
          >
            טען עוד פסוקים
          </Button>
        </div>
      )}
    </div>
  );
};
