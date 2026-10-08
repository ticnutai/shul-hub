/**
 * Tehillim: by chapter, by the day of the week, and from where the reader stopped.
 * Split out of the prayer book's page (src/pages/Siddur.tsx).
 */
import { Bookmark, BookmarkCheck, Loader2, BookOpen, ScrollText, Star } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

import { LuxuryTextView } from "@/components/LuxuryTextView";
import { MinimizeButton } from "@/components/MinimizeButton";
import { useBookmarks } from "@/contexts/BookmarksContext";
import { FontAndColorSettingsProvider, useFontAndColorSettings } from "@/contexts/FontAndColorSettingsContext";
import { TEHILLIM_COMMENTATORS } from "@/hooks/useCommentaries";
import { useTehillimData } from "@/hooks/useSiddurData";
import { parseTehillimBookmark, tehillimBookmarkId } from "@/lib/bookmarkLinks";
import type { FlatPasuk } from "@/types/torah";

import { Divider, OrnamentTitle, scrollUnderChrome } from "./SiddurChrome";
import { cleanLine, heNum, lineHeightCSS, readingGutter, stripText, withNikudTypography } from "./siddurText";
import { useSiddurDisplayStyle, useSiddurTheme } from "./siddurTheme";

/* ─── TehillimPane ───────────────────────────────────────── */
export const TEHILLIM_LAST_READ_KEY = "tehillim-last-read";
export const TEHILLIM_DAILY: Record<number, number>   = { 0: 24, 1: 48, 2: 82, 3: 94, 4: 81, 5: 93, 6: 92 };
export const TEHILLIM_DAY_HEB: Record<number, string> = { 0: "ראשון", 1: "שני", 2: "שלישי", 3: "רביעי", 4: "חמישי", 5: "שישי", 6: "שבת" };

export const TehillimPane = () => {
  const { tehillim, loading } = useTehillimData();
  const { displayStyle } = useSiddurDisplayStyle();
  const { theme } = useSiddurTheme();
  const ornate = displayStyle === "ornate";
  const [chapter, setChapter] = useState(1);
  const [pasuk,   setPasuk]   = useState<number | null>(null);  // 1-based
  const [level,   setLevel]   = useState<"chapter" | "text">("chapter");
  const [mode,    setMode]    = useState<"select" | "daily" | "continuous">(
    () => (localStorage.getItem("tehillim-view-mode") as "select" | "daily" | "continuous") ?? "select"
  );
  const [contentTab, setContentTab] = useState<"text" | "commentary">("text");
  const [commentaryExpanded, setCommentaryExpanded] = useState(true);
  const { settings: tehillimSettings } = useFontAndColorSettings();
  const textRef               = useRef<HTMLDivElement>(null);
  const chapterTopRef         = useRef<HTMLDivElement>(null);
  const continuousSentinelRef = useRef<HTMLDivElement>(null);
  const verseRefs             = useRef<(HTMLParagraphElement | null)[]>([]);
  const [visibleCount, setVisibleCount] = useState(5);

  // One scroll at a time: a link to a verse opens its chapter and then the
  // verse, and the chapter's late correction must not pull back to the top.
  const cancelScroll = useRef<(() => void) | null>(null);
  const scrollTo = (find: () => HTMLElement | null, where: "start" | "center" = "start") => {
    cancelScroll.current?.();
    cancelScroll.current = scrollUnderChrome(find, where);
  };
  useEffect(() => () => cancelScroll.current?.(), []);

  const handleChapterSelect = (ch: number) => {
    setChapter(ch);
    setPasuk(null);
    verseRefs.current = [];
    setLevel("text");
    // The chapter's own title, with its first verse right under it - below
    // the pinned header, not behind it.
    scrollTo(() => chapterTopRef.current);
  };

  const handlePasukSelect = (idx: number) => {
    setPasuk(idx + 1);
    scrollTo(() => verseRefs.current[idx] ?? null, "center");
  };

  /*
   * Coming back to the same place, two ways:
   *   - a bookmark, in the same bookmarks as the Chumash (BookmarksContext,
   *     kept per user in the cloud), on the chapter or on a chosen verse;
   *   - "המשך מפרק …": the last chapter read, kept in this browser, for
   *     whoever is not signed in too.
   * A link to a chapter (?perek=&pasuk=, from a bookmark) opens it.
   */
  const { bookmarks, toggleBookmark, isBookmarked } = useBookmarks();
  const [linkParams] = useSearchParams();
  const [lastRead, setLastRead] = useState<{ chapter: number; pasuk: number | null } | null>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(TEHILLIM_LAST_READ_KEY) ?? "null");
      return v && Number.isInteger(v.chapter) && v.chapter >= 1 && v.chapter <= 150 ? v : null;
    } catch {
      return null;
    }
  });
  const openedFromLink = useRef(false);
  useEffect(() => {
    if (openedFromLink.current || !tehillim) return;
    const ch = Number(linkParams.get("perek"));
    if (!Number.isInteger(ch) || ch < 1 || ch > 150) return;
    openedFromLink.current = true;
    setMode("select");
    handleChapterSelect(ch);
    const v = Number(linkParams.get("pasuk"));
    if (Number.isInteger(v) && v >= 1) setTimeout(() => handlePasukSelect(v - 1), 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tehillim, linkParams]);
  useEffect(() => {
    if (mode !== "select" || level !== "text") return;
    const at = { chapter, pasuk };
    setLastRead(at);
    try {
      localStorage.setItem(TEHILLIM_LAST_READ_KEY, JSON.stringify(at));
    } catch {
      /* private window: nothing remembered */
    }
  }, [mode, level, chapter, pasuk]);
  const tehillimBookmarks = bookmarks
    .map((b) => ({ b, at: parseTehillimBookmark(b.pasukId) }))
    .filter((x): x is { b: typeof x.b; at: { chapter: number; verse: number | null } } => x.at !== null)
    .sort((x, y) => x.at.chapter - y.at.chapter || (x.at.verse ?? 0) - (y.at.verse ?? 0));
  const openAt = (ch: number, verse: number | null) => {
    handleChapterSelect(ch);
    if (verse) setTimeout(() => handlePasukSelect(verse - 1), 250);
  };

  useEffect(() => { setVisibleCount(5); }, [mode]);
  useEffect(() => { setLevel("chapter"); setPasuk(null); }, [mode]);

  useEffect(() => {
    if (mode !== "continuous" || !tehillim) return;
    const entries = Object.keys(tehillim).length;
    if (visibleCount >= entries) return;
    const el = continuousSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount(v => Math.min(v + 5, entries)); },
      { rootMargin: "400px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [mode, visibleCount, tehillim]);

  const setModeWithSave = (m: "select" | "daily" | "continuous") => {
    localStorage.setItem("tehillim-view-mode", m);
    setMode(m);
  };

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: theme.accentColor }} />
        <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Noto Serif Hebrew', serif" }}>
          טוען תהילים...
        </p>
      </div>
    );

  if (!tehillim)
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground" dir="rtl">
        <BookOpen className="h-10 w-10 opacity-30" />
        <p className="text-sm">תהילים עדיין בהורדה — נסה לרענן</p>
      </div>
    );

  const allChapters  = Array.from({ length: 150 }, (_, i) => tehillim[String(i + 1)]).filter(Boolean);
  const current      = tehillim[String(chapter)];
  const dayOfWeek    = new Date().getDay();
  const todayChapter = TEHILLIM_DAILY[dayOfWeek];
  const todayDayName = TEHILLIM_DAY_HEB[dayOfWeek];
  const dailyCurrent = tehillim[String(todayChapter)];

  const textStyle: React.CSSProperties = {
    fontFamily: tehillimSettings.tehillimFont,
    fontSize:   `${tehillimSettings.tehillimSize}px`,
    fontWeight: tehillimSettings.tehillimBold ? 700 : 400,
    textAlign:  tehillimSettings.tehillimTextAlignment as React.CSSProperties["textAlign"],
    lineHeight: lineHeightCSS(tehillimSettings.tehillimLineHeight, tehillimSettings.tehillimLineHeightCustom),
  };

  const showNikud  = tehillimSettings.showNikud  ?? true;
  const showTaamim = tehillimSettings.showTaamim ?? true;
  const gutter = readingGutter(tehillimSettings.tehillimContentWidth);
  const nikudTextStyle = withNikudTypography(
    tehillimSettings.tehillimFont,
    lineHeightCSS(tehillimSettings.tehillimLineHeight, tehillimSettings.tehillimLineHeightCustom),
    showNikud,
    showTaamim
  );

  // The verse's letter stands in a column of its own, raised as it was; the
  // text beside it is a block, so a verse that runs on starts its next line
  // under its own first word, not under the letter (a hanging indent).
  const verseNumStyle: React.CSSProperties = {
    color: theme.accentColor, fontSize: "0.7em", opacity: 0.9,
    fontFamily: "'Noto Serif Hebrew', serif",
    flex: "0 0 1.6em", lineHeight: 1,
    position: "relative", top: "-0.45em",
  };

  const contentTabs = (
    <div className="mb-4 flex justify-center" data-layout="tehillim-content-tabs">
      <div
        className="inline-flex items-center gap-1 rounded-2xl border p-1 shadow-sm"
        style={{ background: "hsl(var(--card))", borderColor: `${theme.accentColor}55` }}
      >
        {([[
          "text", "תהילים",
        ], [
          "commentary", "פירושים",
        ]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={contentTab === id}
            onClick={() => setContentTab(id)}
            className="min-w-[94px] rounded-xl border px-4 py-2 text-sm font-bold transition-all"
            style={contentTab === id ? {
              color: "hsl(var(--primary))",
              borderColor: theme.accentColor,
              background: `${theme.accentColor}10`,
              boxShadow: `0 0 0 1px ${theme.accentColor}18`,
            } : {
              color: "hsl(var(--primary))",
              borderColor: "transparent",
              background: "transparent",
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );

  if (contentTab === "commentary") {
    // 27 is the stable application id reserved for Tehillim commentary rows.
    // Uploaded rows in `commentaries` can therefore use sefer_id=27 and are
    // picked up automatically by the same loader used by Chumash commentaries.
    const commentaryPesukim: FlatPasuk[] = current.lines.map((line, index) => ({
      id: chapter * 1000 + index + 1,
      sefer: 27,
      sefer_name: "תהילים",
      perek: chapter,
      pasuk_num: index + 1,
      text: stripText(cleanLine(line), showNikud, showTaamim),
      content: [],
    }));

    const chapterNavigation = (
      <div className="flex min-w-0 items-center justify-center gap-2" data-layout="tehillim-commentary-navigation">
        <button
          type="button"
          aria-label="פרק קודם"
          disabled={chapter <= 1}
          onClick={() => setChapter(value => Math.max(1, value - 1))}
          className="h-8 w-8 rounded-lg text-lg disabled:opacity-30"
        >
          ›
        </button>
        <span className="min-w-[92px] text-center text-sm font-bold text-primary">פרק {heNum(chapter)}</span>
        <button
          type="button"
          aria-label="פרק הבא"
          disabled={chapter >= 150}
          onClick={() => setChapter(value => Math.min(150, value + 1))}
          className="h-8 w-8 rounded-lg text-lg disabled:opacity-30"
        >
          ‹
        </button>
      </div>
    );

    return (
      <div className="pb-10 px-1" dir="rtl" data-layout="tehillim-commentary-pane">
        <OrnamentTitle text="תהילים" fontSize={tehillimSettings.tehillimSize} />
        <Divider />
        {contentTabs}
        <div
          data-layout="tehillim-commentary-controls"
          data-layout-label="בקרות פירושי תהילים"
          className="mb-4 grid w-full grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3 rounded-2xl border border-accent/20 bg-card/35 px-3 py-3 shadow-sm"
          dir="ltr"
        >
          <div className="flex h-11 w-11 items-center justify-center justify-self-start">
            <MinimizeButton
              variant="global"
              isMinimized={!commentaryExpanded}
              onClick={() => setCommentaryExpanded(value => !value)}
            />
          </div>
          <div className="min-w-0 text-center text-sm font-bold text-primary" dir="rtl">
            תצוגת פירושים
          </div>
          <div aria-hidden="true" className="h-11 w-11" />
        </div>
        <FontAndColorSettingsProvider scopeKey="tehillim-commentary">
          <LuxuryTextView
            key={`tehillim-commentary-${chapter}`}
            pesukim={commentaryPesukim}
            expandAll={commentaryExpanded}
            navigation={chapterNavigation}
            settingsTitle="הגדרות תצוגת פירושי תהילים"
            commentaryStorageKey="tehillim-commentary-configs"
            availableCommentators={TEHILLIM_COMMENTATORS}
          />
        </FontAndColorSettingsProvider>
      </div>
    );
  }

  const renderVerseCard = (lines: string[], highlightPasuk: number | null, trackRefs = false) => (
    <div className="rounded-xl border border-border/50 py-5 space-y-3" style={{
      background: ornate ? "linear-gradient(180deg, #fffdfa 0%, #fff8eb 100%)" : "hsl(var(--card))",
      borderColor: ornate ? `${theme.accentColor}44` : undefined,
      boxShadow: ornate ? `0 6px 18px ${theme.accentColor}1f` : undefined,
      paddingInline: gutter,
    }}>
      {lines.map((line, i) => (
        <p
          key={i}
          ref={trackRefs ? (el => { verseRefs.current[i] = el; }) : undefined}
          data-pasuk={i + 1}
          onClick={trackRefs ? () => setPasuk(pasuk === i + 1 ? null : i + 1) : undefined}
          className={`leading-relaxed text-foreground transition-all rounded-lg${trackRefs ? " cursor-pointer" : ""}`}
          style={{
            ...textStyle,
            ...nikudTextStyle,
            display: "flex",
            alignItems: "baseline",
            background:  highlightPasuk === i + 1 ? `${theme.accentColor}18` : "transparent",
            padding:     highlightPasuk === i + 1 ? "2px 6px" : "0",
            borderRight: highlightPasuk === i + 1 ? `3px solid ${theme.accentColor}` : "3px solid transparent",
          }}
        >
          <span style={verseNumStyle} aria-hidden>{heNum(i + 1)}</span>
          <span className="min-w-0 flex-1" data-verse-text>
            {stripText(cleanLine(line), showNikud, showTaamim)}
          </span>
        </p>
      ))}
    </div>
  );

  return (
    <div className="pb-10 px-1" dir="rtl">
      {/* The page's controls flank this title on a phone (SiddurToolsContext),
          as they do the first prayer's - among them the T of the text
          settings, which open on Tehillim's own. The פירושים view has its own. */}
      <OrnamentTitle text="תהילים" fontSize={tehillimSettings.tehillimSize} withTools />
      <Divider />
      {contentTabs}

      {/* ── Mode toggle — 3 pills ── */}
      <div className="flex justify-center mb-4">
        <div
          className="flex gap-1 rounded-full p-1"
          style={{ background: "hsl(var(--muted))", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)" }}
        >
          {([
            { id: "select"     as const, icon: <BookOpen   className="h-3.5 w-3.5" />, label: "בחר פרק"     },
            { id: "daily"      as const, icon: <Star       className="h-3.5 w-3.5" />, label: "מזמור היום"  },
            { id: "continuous" as const, icon: <ScrollText className="h-3.5 w-3.5" />, label: "קריאה רציפה" },
          ]).map(m => (
            <button
              key={m.id}
              onClick={() => setModeWithSave(m.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: mode === m.id ? theme.accentColor : "transparent",
                color:      mode === m.id ? "hsl(var(--sidebar-background))" : "hsl(var(--muted-foreground))",
                boxShadow:  mode === m.id ? `0 2px 8px ${theme.accentColor}55` : "none",
                fontFamily: "'Noto Serif Hebrew', 'David Libre', serif",
              }}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ SELECT mode ═══ */}
      {mode === "select" && (
        <>
          {level === "chapter" && (
            <>
              {(lastRead || tehillimBookmarks.length > 0) && (
                <div className="mb-3 flex flex-wrap items-center justify-center gap-2" data-testid="tehillim-return">
                  {lastRead && (
                    <button
                      type="button"
                      onClick={() => openAt(lastRead.chapter, lastRead.pasuk)}
                      className="text-xs font-bold px-3 py-1 rounded-full transition-all"
                      style={{ background: theme.accentColor, color: "hsl(var(--sidebar-background))" }}
                    >
                      המשך מפרק {heNum(lastRead.chapter)}
                      {lastRead.pasuk ? `, פסוק ${heNum(lastRead.pasuk)}` : ""}
                    </button>
                  )}
                  {tehillimBookmarks.map(({ b, at }) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => openAt(at.chapter, at.verse)}
                      title={b.pasukText}
                      className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full transition-all"
                      style={{ background: `${theme.accentColor}22`, color: theme.accentColor, border: `1px solid ${theme.accentColor}55` }}
                    >
                      <BookmarkCheck className="size-3" aria-hidden />
                      פרק {heNum(at.chapter)}
                      {at.verse ? `, פסוק ${heNum(at.verse)}` : ""}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="text-xs text-muted-foreground">מזמור היום:</span>
                <button
                  onClick={() => handleChapterSelect(todayChapter)}
                  className="text-xs font-bold px-2 py-0.5 rounded-full transition-all"
                  style={{ background: `${theme.accentColor}22`, color: theme.accentColor, border: `1px solid ${theme.accentColor}55` }}
                >
                  פרק {heNum(todayChapter)}
                </button>
              </div>

              <div className="grid gap-1 mb-4 justify-items-center grid-cols-7 sm:grid-cols-10 lg:grid-cols-[repeat(15,minmax(0,1fr))]">
                {Array.from({ length: 150 }, (_, i) => i + 1).map(ch => (
                  <button
                    key={ch}
                    onClick={() => handleChapterSelect(ch)}
                    title={`פרק ${heNum(ch)}`}
                    className="w-full aspect-square flex items-center justify-center rounded text-[10px] sm:text-xs font-medium transition-all leading-none"
                    style={
                      ch === chapter
                        ? { background: theme.accentColor, color: "hsl(var(--sidebar-background))", boxShadow: `0 0 0 2px ${theme.accentColor}` }
                        : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
                    }
                  >
                    {heNum(ch)}
                  </button>
                ))}
              </div>
            </>
          )}

          {level === "text" && current && (
            <div key={chapter} className="animate-fade-in">
              {/*
                Breadcrumb, right to left: תהילים ‹ פרק ‹ פסוק. It was laid out
                left to right, so it read backwards and the separators pointed
                the wrong way. Every step but the last is a way back.
              */}
              <nav
                className="flex items-center gap-1.5 text-sm mb-3 flex-wrap"
                dir="rtl"
                aria-label="מיקום בתהילים"
                data-testid="tehillim-breadcrumb"
              >
                <button
                  type="button"
                  onClick={() => { setLevel("chapter"); setPasuk(null); }}
                  className="font-medium hover:underline transition-colors"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  תהילים
                </button>
                <span aria-hidden className="opacity-40 text-foreground">‹</span>
                {pasuk ? (
                  <button
                    type="button"
                    onClick={() => { setPasuk(null); scrollTo(() => chapterTopRef.current); }}
                    className="font-semibold hover:underline"
                    style={{ color: theme.accentColor }}
                  >
                    פרק {heNum(chapter)}
                  </button>
                ) : (
                  <span className="font-semibold" aria-current="page" style={{ color: theme.accentColor }}>
                    פרק {heNum(chapter)}
                  </span>
                )}
                {pasuk && (
                  <>
                    <span aria-hidden className="opacity-40 text-foreground">‹</span>
                    <span className="font-semibold" aria-current="page" style={{ color: theme.accentColor }}>פסוק {heNum(pasuk)}</span>
                  </>
                )}
                {(() => {
                  // On the verse chosen, or on the chapter when none is.
                  const id = tehillimBookmarkId(chapter, pasuk);
                  const marked = isBookmarked(id);
                  const text = (pasuk ? current.lines[pasuk - 1] : current.lines[0]) ?? "";
                  return (
                    <button
                      type="button"
                      data-testid="tehillim-bookmark"
                      aria-pressed={marked}
                      onClick={() => void toggleBookmark(id, `תהילים ${heNum(chapter)}${pasuk ? `:${heNum(pasuk)}` : ""} · ${stripText(cleanLine(text), false, false).slice(0, 80)}`)}
                      className="ms-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition-all"
                      style={
                        marked
                          ? { background: theme.accentColor, color: "hsl(var(--sidebar-background))" }
                          : { background: `${theme.accentColor}22`, color: theme.accentColor, border: `1px solid ${theme.accentColor}55` }
                      }
                    >
                      {marked ? <BookmarkCheck className="size-3.5" aria-hidden /> : <Bookmark className="size-3.5" aria-hidden />}
                      {marked ? "בסימניות" : pasuk ? "סימניה לפסוק" : "סימניה לפרק"}
                    </button>
                  );
                })()}
              </nav>

              {/* Verse picker row */}
              <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden mb-3" style={{ scrollbarWidth: "none" }}>
                <div className="flex gap-1 min-w-max pb-1">
                  {current.lines.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handlePasukSelect(i)}
                      aria-label={`פסוק ${heNum(i + 1)}`}
                      aria-pressed={pasuk === i + 1}
                      className="min-w-[30px] h-7 px-1 rounded-md text-[10px] font-bold transition-all"
                      style={{
                        background: pasuk === i + 1 ? theme.accentColor : "hsl(var(--muted))",
                        color:      pasuk === i + 1 ? "hsl(var(--sidebar-background))" : "hsl(var(--muted-foreground))",
                        boxShadow:  pasuk === i + 1 ? `0 2px 6px ${theme.accentColor}55` : "none",
                        fontFamily: "'Noto Serif Hebrew', serif",
                      }}
                    >
                      {heNum(i + 1)}
                    </button>
                  ))}
                </div>
              </div>

              <div ref={chapterTopRef} data-testid="tehillim-chapter-top">
                <OrnamentTitle text={`פרק ${heNum(chapter)} — ${current.title || "תהלים"}`} fontSize={tehillimSettings.tehillimSize} />
              </div>
              <div ref={textRef}>
                {renderVerseCard(current.lines, pasuk, true)}
              </div>

              <div className="flex justify-between items-center mt-4 gap-2">
                <button
                  onClick={() => chapter > 1 && handleChapterSelect(chapter - 1)}
                  disabled={chapter <= 1}
                  className="text-xs px-3 py-1.5 rounded-full disabled:opacity-30 transition-all"
                  style={{ background: `${theme.accentColor}22`, color: theme.accentColor, border: `1px solid ${theme.accentColor}55` }}
                >
                  › פרק קודם
                </button>
                <button
                  onClick={() => setLevel("chapter")}
                  className="text-xs px-3 py-1.5 rounded-full transition-all"
                  style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
                >
                  כל הפרקים
                </button>
                <button
                  onClick={() => chapter < 150 && handleChapterSelect(chapter + 1)}
                  disabled={chapter >= 150}
                  className="text-xs px-3 py-1.5 rounded-full disabled:opacity-30 transition-all"
                  style={{ background: `${theme.accentColor}22`, color: theme.accentColor, border: `1px solid ${theme.accentColor}55` }}
                >
                  פרק הבא ‹
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ DAILY mode ═══ */}
      {mode === "daily" && dailyCurrent && (
        <div className="animate-fade-in">
          <div
            className="flex items-center justify-center gap-2 mb-4 py-2.5 rounded-xl"
            style={{ background: `${theme.accentColor}12`, border: `1px solid ${theme.accentColor}30` }}
          >
            <Star className="h-4 w-4 flex-shrink-0" style={{ color: theme.accentColor }} />
            <span
              className="text-sm font-semibold"
              style={{ color: theme.accentColor, fontFamily: "'Noto Serif Hebrew', serif" }}
            >
              {`מזמור של יום ${todayDayName} — פרק ${heNum(todayChapter)}`}
            </span>
          </div>
          <OrnamentTitle text={`פרק ${heNum(todayChapter)} — ${dailyCurrent.title || "תהלים"}`} fontSize={tehillimSettings.tehillimSize} />
          {renderVerseCard(dailyCurrent.lines, null, false)}
        </div>
      )}

      {/* ═══ CONTINUOUS mode ═══ */}
      {mode === "continuous" && (
        <div className="space-y-8">
          {allChapters.slice(0, visibleCount).map(ch => (
            <div key={ch.chapter}>
              <h3
                className="mb-2 flex items-center gap-2"
                style={{
                  color:      theme.accentColor,
                  fontFamily: tehillimSettings.tehillimFont,
                  fontSize:   `${tehillimSettings.tehillimSize}px`,
                  fontWeight: tehillimSettings.tehillimBold ? 700 : 600,
                }}
              >
                <span className="inline-block w-1.5 h-4 rounded-full flex-shrink-0" style={{ background: theme.accentColor, opacity: 0.7 }} />
                {`פרק ${heNum(ch.chapter)}`}
                {ch.title && ch.title !== "תהילים" && (
                  <span style={{ fontSize: "0.7em", fontWeight: 400, opacity: 0.7 }}>— {ch.title}</span>
                )}
              </h3>
              <Divider />
              {renderVerseCard(ch.lines, null, false)}
            </div>
          ))}
          {visibleCount < allChapters.length && (
            <div ref={continuousSentinelRef} className="flex justify-center items-center py-6 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: theme.accentColor }} />
              <span className="text-sm" style={{ fontFamily: "'Noto Serif Hebrew', serif" }}>
                טוען פרקים נוספים...
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
