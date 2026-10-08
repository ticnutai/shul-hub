/**
 * The ways to read: a line, a section's card, one long page, a category, side by side and as a book.
 * Split out of the prayer book's page (src/pages/Siddur.tsx).
 */
import { ChevronDown, ChevronUp, BookMarked, Loader2 } from "lucide-react";
import { useState, useEffect, useRef, useContext } from "react";

import { TodayBadge } from "@/components/siddur/TodayPanel";
import { useFontAndColorSettings } from "@/contexts/FontAndColorSettingsContext";
import { useServiceSections } from "@/hooks/useServiceSections";
import { type SiddurSection, useSiddurCategories, useSiddurSections } from "@/hooks/useSiddurData";
import type { DayProfile } from "@/lib/jewishDay";

import { Divider, OrnamentTitle, SiddurJumpContext, sectionAnchor } from "./SiddurChrome";
import { SERIF, classifyLine, lineHeightCSS, readingGutter, renderLineContent, stripText, withNikudTypography } from "./siddurText";
import { siddurAppearance, siddurCardChrome, useSiddurDisplayStyle, useSiddurTheme } from "./siddurTheme";

/* ─── SiddurLine — renders one siddur line with semantic styling ─── */
export type SiddurLineSettings = { siddurFont: string; siddurSize: number; siddurBold: boolean; siddurHeadingBold: boolean; siddurOpeningBold: boolean; siddurOpeningWordCount: 1 | 2 | 3; textAlignment: string; lineHeight: string; lineHeightCustom: number; showNikud: boolean; showTaamim: boolean; showInstructions?: boolean; letterSpacing: string; letterSpacingCustom: number; wordSpacing: number; };

export const SiddurLine = ({ html, s }: { html: string; s: SiddurLineSettings }) => {
  html = stripText(html, s.showNikud, s.showTaamim);
  const type = classifyLine(html);
  const lh = lineHeightCSS(s.lineHeight, s.lineHeightCustom);
  const nikudStyle = withNikudTypography(s.siddurFont, lh, s.showNikud, s.showTaamim);
  const { theme } = useSiddurTheme();
  // Hidden by the gold dot beside the section's title (InstructionsToggle).
  if (type === "instruction" && s.showInstructions === false) return null;

  const letterSpacingCSS = s.letterSpacing === "custom"
    ? `${s.letterSpacingCustom ?? 0}em`
    : s.letterSpacing === "tight"  ? "-0.02em"
    : s.letterSpacing === "wide"   ? "0.05em"
    : s.letterSpacing === "wider"  ? "0.1em"
    : "0em";
  const wordSpacingCSS = `${s.wordSpacing ?? 0}em`;

  const headingColor  = theme.headingColor     ?? theme.accentColor;
  const instrColor    = theme.instructionColor  ?? theme.textColor;

  if (type === "heading") {
    return (
      <div className="flex items-center gap-2 mt-3 mb-0.5" style={{ direction: "rtl" }}>
        <span className="inline-block h-3 w-0.5 rounded-full flex-shrink-0" style={{ background: headingColor, opacity: 0.8 }} />
        <span style={{
          ...nikudStyle,
          fontSize: `${Math.round(s.siddurSize * 0.82)}px`,
          fontWeight: s.siddurHeadingBold ? 700 : 600,
          color: headingColor,
          letterSpacing: letterSpacingCSS,
          wordSpacing: wordSpacingCSS,
        }}>
          {renderLineContent(html, s.siddurHeadingBold)}
        </span>
      </div>
    );
  }

  if (type === "instruction") {
    return (
      <p style={{
        color: instrColor,
        ...nikudStyle,
        fontSize: `${Math.max(Math.round(s.siddurSize * 0.78), 12)}px`,
        fontStyle: "italic",
        // Bold unless the theme says otherwise (SiddurTheme.instructionBold).
        fontWeight: theme.instructionBold === false ? 400 : 700,
        textAlign: s.textAlignment as React.CSSProperties["textAlign"],
        ...(s.textAlignment === "justify" ? { textAlignLast: "right" as React.CSSProperties["textAlignLast"], textJustify: "inter-word" as React.CSSProperties["textJustify"], hyphens: "none" as React.CSSProperties["hyphens"] } : {}),
        direction: "rtl",
        opacity: 0.82,
        letterSpacing: letterSpacingCSS,
        wordSpacing: wordSpacingCSS,
      }}>
        {renderLineContent(html)}
      </p>
    );
  }

  return (
    <p style={{
      ...nikudStyle,
      color: theme.textColor,
      fontSize: `${s.siddurSize}px`,
      fontWeight: s.siddurBold ? 700 : 400,
      textAlign: s.textAlignment as React.CSSProperties["textAlign"],
      ...(s.textAlignment === "justify" ? { textAlignLast: "right" as React.CSSProperties["textAlignLast"], textJustify: "inter-word" as React.CSSProperties["textJustify"], hyphens: "none" as React.CSSProperties["hyphens"] } : {}),
      direction: "rtl",
      letterSpacing: letterSpacingCSS,
      wordSpacing: wordSpacingCSS,
    }}>
      {renderLineContent(html, s.siddurOpeningBold, s.siddurOpeningWordCount)}
    </p>
  );
};

/* ─── InstructionsToggle ─────────────────────────────────── */
/** Whether a section has any instruction lines - the dot shows only where there is something to hide. */
export const hasInstructions = (lines: string[]) => lines.some((l) => classifyLine(l) === "instruction");

/**
 * The small gold dot beside a section's title: instructions shown (filled) or
 * hidden (a ring). One setting for the whole Siddur, kept with the reader's
 * text settings (showInstructions), so it holds across sections and visits.
 */
export const InstructionsToggle = () => {
  const { settings, updateSettings } = useFontAndColorSettings();
  const { theme } = useSiddurTheme();
  const on = settings.showInstructions !== false;
  return (
    <button
      type="button"
      data-testid="instructions-toggle"
      aria-pressed={on}
      aria-label={on ? "הסתרת ההוראות" : "הצגת ההוראות"}
      title={on ? "ההוראות מוצגות - לחיצה להסתרה" : "ההוראות מוסתרות - לחיצה להצגה"}
      onClick={(e) => {
        e.stopPropagation();
        updateSettings({ showInstructions: !on });
      }}
      className="ms-auto inline-flex size-7 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-110"
    >
      <span
        aria-hidden
        className="block size-3.5 rounded-full transition-colors"
        style={
          on
            ? { background: theme.accentColor, boxShadow: `0 0 0 3px ${theme.accentColor}33` }
            : { border: `2px solid ${theme.accentColor}`, background: "transparent" }
        }
      />
    </button>
  );
};

/* ─── SectionCard ────────────────────────────────────────── */
export const SectionCard = ({
  section,
  initialOpen = false,
  index,
}: {
  section: SiddurSection;
  initialOpen?: boolean;
  /** Its place in the strip above, when there is one. */
  index?: number;
}) => {
  const [open, setOpen] = useState(initialOpen);
  const { settings: siddurSettings } = useFontAndColorSettings();
  const { theme } = useSiddurTheme();
  const gutter = readingGutter(siddurSettings.siddurContentWidth);
  const lineSettings: SiddurLineSettings = {
    ...siddurSettings,
    textAlignment: siddurSettings.siddurTextAlignment,
    lineHeight: siddurSettings.siddurLineHeight,
    lineHeightCustom: siddurSettings.siddurLineHeightCustom,
    letterSpacing: siddurSettings.siddurLetterSpacing,
    letterSpacingCustom: siddurSettings.siddurLetterSpacingCustom,
    wordSpacing: siddurSettings.siddurWordSpacing,
  };

  // Asked for from the strip above: open, then come into view. Opening
  // first matters - scrolling to a closed card puts a title on screen and
  // leaves the person to tap again.
  const jump = useContext(SiddurJumpContext);
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Only opens itself. The strip does the scrolling, so that it works the
    // same in the reading modes that draw no cards at all.
    if (index === undefined || jump.index !== index) return;
    setOpen(true);
  }, [jump.index, jump.nonce, index]);

  return (
    <div ref={cardRef} id={index === undefined ? undefined : sectionAnchor(index)} data-siddur-card className="rounded-lg border overflow-hidden mb-2" style={{
      scrollMarginTop: "6rem",
      background: theme.cardBg,
      borderColor: theme.cardBorder,
      ...siddurCardChrome(theme),
    }}>
      {/* Section header / toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-right transition-colors hover:bg-white/10 focus:outline-none"
        style={{ direction: "rtl" }}
      >
        <div className="flex items-center gap-2">
          <span className="inline-block w-1.5 h-4 rounded-full" style={{ background: theme.accentColor, opacity: 0.7 }} />
          <span
            style={{
              color: theme.textColor,
              fontFamily: siddurSettings.siddurFont,
              fontSize: `${siddurSettings.siddurSize}px`,
              fontWeight: siddurSettings.siddurBold ? 700 : 600,
            }}
          >
            {section.title}
            <TodayBadge title={section.title} />
          </span>
        </div>
        <span className="ml-2" style={{ color: theme.textColor, opacity: 0.5 }}>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* Prayer lines */}
      {open && (
        <div
        className="pb-4 pt-2 space-y-1.5 animate-fade-in border-t"
          style={{ direction: "rtl", paddingInline: gutter, borderColor: `${theme.accentColor}22` }}
        >
          {hasInstructions(section.lines) && (
            <div className="-mb-1 flex">
              <InstructionsToggle />
            </div>
          )}
          {section.lines.map((line, i) => (
            <SiddurLine key={i} html={line} s={lineSettings} />
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── ContinuousReader ───────────────────────────────────── */
export const ContinuousReader = ({ sections }: { sections: SiddurSection[] }) => {
  const [visibleCount, setVisibleCount] = useState(8);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { settings: siddurSettings } = useFontAndColorSettings();
  const { theme } = useSiddurTheme();
  const gutter = readingGutter(siddurSettings.siddurContentWidth);
  const lineSettings: SiddurLineSettings = {
    ...siddurSettings,
    textAlignment: siddurSettings.siddurTextAlignment,
    lineHeight: siddurSettings.siddurLineHeight,
    lineHeightCustom: siddurSettings.siddurLineHeightCustom,
    letterSpacing: siddurSettings.siddurLetterSpacing,
    letterSpacingCustom: siddurSettings.siddurLetterSpacingCustom,
    wordSpacing: siddurSettings.siddurWordSpacing,
  };

  // Reset when sections array changes (e.g. tab switch)
  useEffect(() => { setVisibleCount(8); }, [sections]);

  // A jump (the strip, or search) to a section past what is drawn so far:
  // draw up to it, or there is nothing to scroll to.
  const { index: jumpTo, nonce: jumpNonce } = useContext(SiddurJumpContext);
  useEffect(() => {
    if (jumpTo === null) return;
    setVisibleCount(v => Math.min(Math.max(v, jumpTo + 3), sections.length));
  }, [jumpTo, jumpNonce, sections.length]);

  useEffect(() => {
    if (visibleCount >= sections.length) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount(v => Math.min(v + 8, sections.length)); },
      { rootMargin: "300px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visibleCount, sections.length]);

  return (
    <div className="space-y-6 pb-8" dir="rtl">
      {sections.slice(0, visibleCount).map((sec, i) => (
        <div key={i} id={sectionAnchor(i)} style={{ scrollMarginTop: "6rem" }}>
          <h3
            className="mb-1 flex items-center gap-2"
            style={{
              color: theme.accentColor,
              fontFamily: siddurSettings.siddurFont,
              fontSize: `${siddurSettings.siddurSize}px`,
              fontWeight: siddurSettings.siddurBold ? 700 : 600,
            }}
          >
            <span className="inline-block w-1.5 h-4 rounded-full flex-shrink-0" style={{ background: theme.accentColor, opacity: 0.7 }} />
            {sec.title}
            <TodayBadge title={sec.title} />
            {hasInstructions(sec.lines) && <InstructionsToggle />}
          </h3>
          <Divider />
          <div
            data-siddur-card
            className="space-y-1.5 mt-2 rounded-xl border py-3"
            style={{ paddingInline: gutter, background: theme.cardBg, borderColor: theme.cardBorder, ...siddurCardChrome(theme) }}
          >
            {sec.lines.map((line, j) => (
              <SiddurLine key={j} html={line} s={lineSettings} />
            ))}
          </div>
        </div>
      ))}
      {visibleCount < sections.length && (
        <div ref={sentinelRef} className="flex justify-center items-center py-4 gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: theme.accentColor }} />
          <span className="text-sm" style={{ fontFamily: "'Noto Serif Hebrew', serif" }}>
            טוען {sections.length - visibleCount} סעיפים נוספים...
          </span>
        </div>
      )}
    </div>
  );
};

/* ─── CategoryPane ───────────────────────────────────────── */
export const CategoryPane = ({
  nusach,
  catId,
  viewMode,
  today,
}: {
  nusach: string;
  catId: string;
  viewMode: "accordion" | "continuous";
  /** "לפי לוח שנה": the prayer as said today. Null shows it as printed. */
  today: DayProfile | null;
}) => {
  const { sections, catName, loading, error } = useServiceSections(nusach, catId, today);
  const { settings: siddurSettings } = useFontAndColorSettings();
  const { theme } = useSiddurTheme();

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: theme.accentColor }} />
        <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Noto Serif Hebrew', serif" }}>
          טוען סידור...
        </p>
      </div>
    );

  if (error)
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4" dir="rtl">
        <div className="rounded-xl p-6 text-center max-w-sm border border-border" style={{ background: "hsl(var(--card))" }}>
          <span className="text-3xl mb-3 block">📖</span>
          <p className="font-semibold text-foreground mb-2" style={{ fontFamily: "'Noto Serif Hebrew', serif" }}>
            הסידור עדיין בהורדה
          </p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );

  if (!sections || !sections.length)
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground" dir="rtl">
        <BookMarked className="h-10 w-10 opacity-30" />
        <p className="text-sm">אין תוכן זמין כרגע</p>
      </div>
    );

  return (
    <div className="pb-8">
      <OrnamentTitle text={catName} fontSize={siddurSettings.siddurSize} withTools />
      <Divider />
      <div className="mt-4">
        {viewMode === "continuous"
          ? <ContinuousReader sections={sections} />
          : (
            <div className="space-y-1">
              {sections.map((sec, i) => (
                <SectionCard key={`${sec.title}-${i}`} section={sec} initialOpen={i === 0} index={i} />
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
};

/* ─── CategorySectionsBlock (used by FullContinuousPane) ─── */

export const CategorySectionsBlock = ({ nusach, cat, first = false }: { nusach: string; cat: { id: string; name: string }; first?: boolean }) => {
  const { sections, loading } = useSiddurSections(nusach, cat.id);
  const { settings: siddurSettings } = useFontAndColorSettings();
  const { theme } = useSiddurTheme();
  const gutter = readingGutter(siddurSettings.siddurContentWidth);
  const lineSettings: SiddurLineSettings = {
    ...siddurSettings,
    textAlignment: siddurSettings.siddurTextAlignment,
    lineHeight: siddurSettings.siddurLineHeight,
    lineHeightCustom: siddurSettings.siddurLineHeightCustom,
    letterSpacing: siddurSettings.siddurLetterSpacing,
    letterSpacingCustom: siddurSettings.siddurLetterSpacingCustom,
    wordSpacing: siddurSettings.siddurWordSpacing,
  };
  if (loading)
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: theme.accentColor }} />
      </div>
    );
  if (!sections?.length) return null;
  return (
    <div className="mb-10">
      <OrnamentTitle text={cat.name} fontSize={siddurSettings.siddurSize} withTools={first} />
      <Divider />
      <div className="mt-4 space-y-6">
        {sections.map((sec, i) => (
          <div key={i}>
            <h3
              className="mb-1 flex items-center gap-2"
              style={{
                color: theme.accentColor,
                fontFamily: siddurSettings.siddurFont,
                fontSize: `${siddurSettings.siddurSize}px`,
                fontWeight: siddurSettings.siddurBold ? 700 : 600,
              }}
            >
              <span className="inline-block w-1.5 h-4 rounded-full flex-shrink-0" style={{ background: theme.accentColor, opacity: 0.7 }} />
              {sec.title}
              <TodayBadge title={sec.title} />
              {hasInstructions(sec.lines) && <InstructionsToggle />}
            </h3>
            <div
              data-siddur-card
              className="space-y-1.5 mt-2 rounded-xl border py-3"
              style={{ paddingInline: gutter, background: theme.cardBg, borderColor: theme.cardBorder, ...siddurCardChrome(theme) }}
            >
              {sec.lines.map((line, j) => (
                <SiddurLine key={j} html={line} s={lineSettings} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── FullContinuousPane ─────────────────────────────────── */
// Renders ALL categories in a single infinite scroll, loading one category at a time
export const FullContinuousPane = ({ nusach }: { nusach: string }) => {
  const { categories, loading: catsLoading } = useSiddurCategories(nusach);
  const { theme } = useSiddurTheme();
  const [visibleCount, setVisibleCount] = useState(1);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setVisibleCount(1); }, [nusach]);

  useEffect(() => {
    if (visibleCount >= categories.length) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount(v => Math.min(v + 1, categories.length)); },
      { rootMargin: "400px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visibleCount, categories.length]);

  if (catsLoading)
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: theme.accentColor }} />
        <p className="text-sm text-muted-foreground" style={{ fontFamily: SERIF }}>טוען סידור...</p>
      </div>
    );

  return (
    <div className="pb-8" dir="rtl">
      {categories.slice(0, visibleCount).map((cat, i) => (
        <CategorySectionsBlock key={cat.id} nusach={nusach} cat={cat} first={i === 0} />
      ))}
      {visibleCount < categories.length && (
        <div ref={sentinelRef} className="flex justify-center items-center py-6 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: theme.accentColor }} />
          <span className="text-sm" style={{ fontFamily: SERIF }}>
            טוען {categories[visibleCount]?.name}...
          </span>
        </div>
      )}
    </div>
  );
};

/* ─── SplitPane — master/detail: section list | prayer text ─ */
export const SplitPane = ({ nusach, catId }: { nusach: string; catId: string }) => {
  const { sections, catName, loading } = useSiddurSections(nusach, catId);
  const [selIdx, setSelIdx] = useState(0);
  const { settings: s } = useFontAndColorSettings();
  const { displayStyle } = useSiddurDisplayStyle();
  const { theme } = useSiddurTheme();
  const ornate = displayStyle === "ornate";
  const gutter = readingGutter(s.siddurContentWidth);
  const lineSettings: SiddurLineSettings = {
    ...s,
    textAlignment: s.siddurTextAlignment,
    lineHeight: s.siddurLineHeight,
    lineHeightCustom: s.siddurLineHeightCustom,
    letterSpacing: s.siddurLetterSpacing,
    letterSpacingCustom: s.siddurLetterSpacingCustom,
    wordSpacing: s.siddurWordSpacing,
  };

  useEffect(() => { setSelIdx(0); }, [catId, nusach]);

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: theme.accentColor }} />
      </div>
    );
  if (!sections?.length) return null;

  const sec = sections[Math.min(selIdx, sections.length - 1)];

  return (
    <div className="flex flex-col sm:flex-row gap-0 pb-8" dir="rtl">
      {/* Section nav panel (right side in RTL) */}
      <div
        className="w-full sm:w-52 flex-shrink-0 border-b sm:border-b-0 sm:border-l border-border/50 max-h-36 sm:max-h-none overflow-y-auto"
        style={{ paddingLeft: "0.5rem" }}
      >
        <div
          className="text-xs font-bold mb-2 px-2 py-1.5 text-center sticky top-0 z-10"
          style={{
            color: theme.accentColor,
            fontFamily: "'Noto Serif Hebrew', serif",
            background: ornate ? "#fffdf7" : theme.headerBg,
            borderBottom: `1px solid ${theme.accentColor}22`,
          }}
        >
          {catName}
        </div>
        <div className="flex sm:flex-col flex-row gap-1 sm:gap-0 sm:space-y-0.5 pb-2 sm:pb-4 overflow-x-auto sm:overflow-x-hidden">
          {sections.map((item, i) => (
            <button
              key={i}
              onClick={() => setSelIdx(i)}
              className="sm:w-full flex-shrink-0 whitespace-nowrap sm:whitespace-normal text-right text-sm px-2.5 py-2 rounded-lg transition-all leading-snug"
              style={{
                fontFamily: "'Noto Serif Hebrew', serif",
                color: i === selIdx ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                background: i === selIdx ? `${theme.accentColor}18` : "transparent",
                borderRight: i === selIdx ? `3px solid ${theme.accentColor}` : "3px solid transparent",
                fontWeight: i === selIdx ? 600 : 400,
              }}
            >
              {item.title}
            </button>
          ))}
        </div>
      </div>

      {/* Prayer text (left side in RTL) */}
      <div className="flex-1 min-w-0 pt-4 sm:pt-0 pr-0 sm:pr-4 overflow-y-auto">
        <OrnamentTitle text={sec.title} fontSize={s.siddurSize} withTools />
        {hasInstructions(sec.lines) && (
          <div className="-mt-1 flex">
            <InstructionsToggle />
          </div>
        )}
        <Divider />
        <div
          data-siddur-card
          className="space-y-1.5 mt-3 rounded-xl border py-4"
          style={{
            paddingInline: gutter,
            background: ornate ? "linear-gradient(180deg, #fffdfa 0%, #fffaf0 100%)" : theme.cardBg,
            borderColor: ornate ? `${theme.accentColor}44` : theme.cardBorder,
            ...(ornate ? { borderRadius: `${siddurAppearance(theme).cornerRadius}px`, borderWidth: `${siddurAppearance(theme).borderWidth}px`, boxShadow: `0 4px 16px ${theme.accentColor}1f` } : siddurCardChrome(theme)),
          }}
        >
          {sec.lines.map((line, i) => (
            <SiddurLine key={i} html={line} s={lineSettings} />
          ))}
        </div>

        {/* Prev / Next */}
        <div className="flex justify-between items-center mt-4 gap-2">
          <button
            onClick={() => setSelIdx(v => Math.min(v + 1, sections.length - 1))}
            disabled={selIdx >= sections.length - 1}
            className="text-xs px-3 py-1.5 rounded-full disabled:opacity-30 transition-all"
            style={{ background: `${theme.accentColor}22`, color: theme.accentColor, border: `1px solid ${theme.accentColor}55` }}
          >
            « הבא
          </button>
          <span className="text-xs text-muted-foreground" style={{ fontFamily: "'Noto Serif Hebrew', serif" }}>
            {selIdx + 1} / {sections.length}
          </span>
          <button
            onClick={() => setSelIdx(v => Math.max(v - 1, 0))}
            disabled={selIdx <= 0}
            className="text-xs px-3 py-1.5 rounded-full disabled:opacity-30 transition-all"
            style={{ background: `${theme.accentColor}22`, color: theme.accentColor, border: `1px solid ${theme.accentColor}55` }}
          >
            קודם »
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── BookColumnPane — two CSS-columns book layout ────────── */
export const BookColumnPane = ({ nusach, catId }: { nusach: string; catId: string }) => {
  const { sections, catName, loading } = useSiddurSections(nusach, catId);
  const { settings: s } = useFontAndColorSettings();
  const { theme } = useSiddurTheme();
  const [isMobileView, setIsMobileView] = useState(typeof window !== "undefined" && window.innerWidth < 640);
  useEffect(() => {
    const h = () => setIsMobileView(window.innerWidth < 640);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  const lineSettings: SiddurLineSettings = {
    ...s,
    textAlignment: s.siddurTextAlignment,
    lineHeight: s.siddurLineHeight,
    lineHeightCustom: s.siddurLineHeightCustom,
    letterSpacing: s.siddurLetterSpacing,
    letterSpacingCustom: s.siddurLetterSpacingCustom,
    wordSpacing: s.siddurWordSpacing,
  };

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: theme.accentColor }} />
      </div>
    );
  if (!sections?.length) return null;

  return (
    <div className="pb-8" dir="rtl">
      <OrnamentTitle text={catName} fontSize={s.siddurSize} withTools />
      <Divider />
      <div
        style={{
          columnCount: isMobileView ? 1 : 2,
          columnGap: "2.5rem",
          columnRule: isMobileView ? undefined : `1px solid ${theme.accentColor}44`,
          direction: "rtl",
        }}
      >
        {sections.map((sec, i) => (
          <div
            key={i}
            style={{ breakInside: "avoid", pageBreakInside: "avoid", marginBottom: "1.5rem" }}
          >
            <div className="flex items-center gap-2 mb-1.5" style={{ direction: "rtl" }}>
              <span
                className="inline-block h-3 w-0.5 rounded-full flex-shrink-0"
                style={{ background: theme.accentColor, opacity: 0.7 }}
              />
              <span
                style={{
                  color: theme.accentColor,
                  fontFamily: "'Noto Serif Hebrew', serif",
                  fontSize: `${Math.round(s.siddurSize * 0.85)}px`,
                  fontWeight: 700,
                }}
              >
                {sec.title}
              </span>
            </div>
            <div className="space-y-1">
              {sec.lines.map((line, j) => (
                <SiddurLine key={j} html={line} s={lineSettings} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
