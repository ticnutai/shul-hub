import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { FlatPasuk } from "@/types/torah";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp, Bookmark, BookmarkCheck, BookOpen, StickyNote, Plus, Share2, Mail, Link2 } from "lucide-react";
import { toHebrewNumber } from "@/utils/hebrewNumbers";
import { formatTorahText } from "@/utils/textUtils";
import { PasukDisplay } from "@/components/PasukDisplay";
import { useTextDisplayStyles } from "@/hooks/useTextDisplayStyles";
import { useFontAndColorSettings } from "@/contexts/FontAndColorSettingsContext";
import { cn } from "@/lib/utils";
import { useBookmarks } from "@/contexts/BookmarksContext";
import { useDisplayMode } from "@/contexts/DisplayModeContext";
import { useSelection } from "@/contexts/SelectionContext";
import { Button } from "@/components/ui/button";
import { NotesDialog } from "@/components/NotesDialog";
import { ContentEditor } from "@/components/ContentEditor";
import { sharePasukWhatsApp, sharePasukEmail, sharePasukLink } from "@/utils/shareUtils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface CompactPasukViewProps {
  pesukim: FlatPasuk[];
  seferId: number;
  expandAll?: boolean;
}

export const CompactPasukView = memo(({ pesukim, seferId, expandAll = false }: CompactPasukViewProps) => {
  const [expandedPasukId, setExpandedPasukId] = useState<number | null>(null);
  // Tracks cards the user manually closed while in expand-all mode
  const [closedIds, setClosedIds] = useState<Set<number>>(new Set());
  const [editorPasukId, setEditorPasukId] = useState<string | null>(null);
  const displayStyles = useTextDisplayStyles();
  const { settings } = useFontAndColorSettings();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const { displaySettings } = useDisplayMode();
  const batchSize = Math.max(1, displaySettings.pasukCount || 10);
  const [displayedCount, setDisplayedCount] = useState(batchSize);
  const { selectionMode, isSelected, toggleSelect, enableSelectionMode } = useSelection();
  const navigate = useNavigate();

  const loadMoreRef = useRef<HTMLDivElement>(null);

  const displayedPesukim = useMemo(() => pesukim.slice(0, displayedCount), [pesukim, displayedCount]);
  const hasMore = displayedCount < pesukim.length;
  const loadMoreAmount = batchSize;

  const loadMore = useCallback(() => {
    setDisplayedCount(prev => Math.min(prev + loadMoreAmount, pesukim.length));
  }, [loadMoreAmount, pesukim.length]);

  useEffect(() => {
    setDisplayedCount(Math.min(batchSize, pesukim.length));
  }, [batchSize, pesukim]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!hasMore || !target) return;
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && loadMore(),
      { rootMargin: "300px 0px", threshold: 0.01 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  // When expandAll changes, reset tracking state
  useEffect(() => {
    if (expandAll) {
      setClosedIds(new Set()); // fresh expand-all
    } else {
      setExpandedPasukId(null); // collapse all individual opens
      setClosedIds(new Set());
    }
  }, [expandAll]);

  const togglePasuk = useCallback((pasukId: number) => {
    if (expandAll) {
      // In expand-all mode: toggle a specific card closed/open
      setClosedIds(prev => {
        const next = new Set(prev);
        if (next.has(pasukId)) { next.delete(pasukId); } else { next.add(pasukId); }
        return next;
      });
    } else {
      // Normal mode: one card open at a time
      setExpandedPasukId(prev => prev === pasukId ? null : pasukId);
    }
  }, [expandAll]);

  const handleBookmark = useCallback((e: React.MouseEvent, pasuk: FlatPasuk) => {
    e.stopPropagation();
    const pasukId = `${seferId}-${pasuk.perek}-${pasuk.pasuk_num}`;
    toggleBookmark(pasukId, pasuk.text);
  }, [seferId, toggleBookmark]);

  const handleCommentaries = useCallback((e: React.MouseEvent, pasuk: FlatPasuk) => {
    e.stopPropagation();
    navigate(`/commentaries?sefer=${seferId}&perek=${pasuk.perek}&pasuk=${pasuk.pasuk_num}`);
  }, [seferId, navigate]);

  const handleAddContent = useCallback((e: React.MouseEvent, pasuk: FlatPasuk) => {
    e.stopPropagation();
    const pasukId = `${seferId}-${pasuk.perek}-${pasuk.pasuk_num}`;
    setEditorPasukId(pasukId);
  }, [seferId]);

  return (
    <div 
      className="flex flex-col"
      style={{ gap: displayStyles.gap }}
    >
      {displayedPesukim.map((pasuk) => {
        const isExpanded = expandAll ? !closedIds.has(pasuk.id) : expandedPasukId === pasuk.id;
        const selected = isSelected(pasuk.id);

        // Long press handlers for this card
        let lpTimer: ReturnType<typeof setTimeout> | null = null;
        const onPointerDown = () => {
          if (selectionMode) return;
          lpTimer = setTimeout(() => {
            enableSelectionMode();
            toggleSelect(pasuk);
          }, 600);
        };
        const onPointerUp = () => { if (lpTimer) clearTimeout(lpTimer); };
        
        return (
          <Card 
            key={pasuk.id}
            className={cn(
              "overflow-hidden w-full transition-all duration-300 cursor-pointer border-0",
              selected
                ? "shadow-xl ring-2 ring-primary/50 bg-primary/5"
                : isExpanded
                  ? "shadow-xl ring-2 ring-primary/40"
                  : "shadow-sm hover:shadow-lg"
            )}
            style={{
              maxWidth: displayStyles.maxWidth,
              margin: displayStyles.margin,
              overflowWrap: "break-word",
              contain: 'layout style',
              borderRight: selected ? '4px solid hsl(var(--primary))' : isExpanded ? '4px solid hsl(var(--primary))' : '4px solid hsl(var(--accent))',
            }}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onClick={() => {
              if (selectionMode) {
                toggleSelect(pasuk);
                return;
              }
              togglePasuk(pasuk.id);
            }}
          >
            <div
              className={cn(
                "w-full transition-all duration-200 touch-manipulation group",
                !isExpanded && "hover:bg-accent/20"
              )}
            >
              {/* Top Bar: metadata + actions */}
              <div className="flex items-center justify-between px-4 pt-3 sm:px-6 sm:pt-4" dir="rtl">
                <span className="text-xs text-muted-foreground/70 font-medium">
                  {pasuk.parsha_name} • פרק {toHebrewNumber(pasuk.perek)}
                </span>
                <div className="flex items-center gap-0.5 pointer-events-auto opacity-60 group-hover:opacity-100 transition-opacity">
                  {selectionMode ? (
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => toggleSelect(pasuk)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-5 w-5 border-2 data-[state=checked]:bg-primary"
                    />
                  ) : (
                    <>
                      <Button variant="ghost" size="icon" onClick={(e) => handleBookmark(e, pasuk)} className="h-7 w-7" title={isBookmarked(`${seferId}-${pasuk.perek}-${pasuk.pasuk_num}`) ? "הסר סימניה" : "הוסף סימניה"}>
                        {isBookmarked(`${seferId}-${pasuk.perek}-${pasuk.pasuk_num}`) ? <BookmarkCheck className="h-3.5 w-3.5 fill-primary text-primary" /> : <Bookmark className="h-3.5 w-3.5" />}
                      </Button>
                      <div onClick={(e) => e.stopPropagation()}>
                        <NotesDialog pasukId={`${seferId}-${pasuk.perek}-${pasuk.pasuk_num}`} pasukText={pasuk.text} />
                      </div>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); sharePasukWhatsApp({ seferId, perek: pasuk.perek, pasukNum: pasuk.pasuk_num, pasukText: formatTorahText(pasuk.text), content: pasuk.content || [] }); }} className="h-7 w-7" title="שתף"><Share2 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); sharePasukLink(seferId, pasuk.perek, pasuk.pasuk_num, formatTorahText(pasuk.text)); }} className="h-7 w-7 hidden sm:flex" title="קישור"><Link2 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" onClick={(e) => handleAddContent(e, pasuk)} className="h-7 w-7 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" title="הוסף תוכן"><StickyNote className="h-3.5 w-3.5" /></Button>
                    </>
                  )}
                </div>
              </div>

              {/* Main Content: Number + Text */}
              {!isExpanded && (
                <div className="flex gap-3 sm:gap-4 px-4 pb-4 pt-2 sm:px-6 sm:pb-5" dir="rtl">
                  {/* Pasuk Number - Elegant Gold Circle */}
                  <div className={cn(
                    "w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shrink-0 transition-all duration-300",
                    "bg-gradient-to-br from-[hsl(40,60%,55%)] to-[hsl(40,50%,45%)]",
                    "shadow-[0_2px_8px_hsl(40,50%,40%,0.3)]",
                    "group-hover:shadow-[0_3px_12px_hsl(40,50%,40%,0.4)] group-hover:scale-105"
                  )}>
                    <span 
                      className="text-white font-bold text-lg sm:text-xl"
                      style={{ fontFamily: "'David Libre', 'Noto Serif Hebrew', serif" }}
                    >
                      {toHebrewNumber(pasuk.pasuk_num)}
                    </span>
                  </div>

                  {/* Pasuk Text */}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p 
                      dir="rtl"
                      style={{ 
                        fontFamily: settings.pasukFont || "'David Libre', 'Noto Serif Hebrew', serif",
                        fontSize: `${Math.min((settings.pasukSize || 20) * (displayStyles.fontScale || 1), displayStyles.isMobile ? 22 : 26)}px`,
                        color: settings.pasukColor || 'hsl(var(--foreground))',
                        fontWeight: settings.pasukBold ? 700 : 400,
                        lineHeight: displayStyles.lineHeight || '2',
                        letterSpacing: displayStyles.letterSpacing,
                        wordSpacing: displayStyles.wordSpacing,
                        textAlign: displayStyles.textAlign,
                        textAlignLast: displayStyles.textAlign === 'justify' ? 'right' : displayStyles.textAlign,
                        textRendering: 'optimizeLegibility',
                        WebkitFontSmoothing: 'antialiased',
                        wordBreak: 'normal',
                        overflowWrap: 'break-word',
                        hyphens: 'none',
                      }}
                    >
                      {formatTorahText(pasuk.text)}
                    </p>
                  </div>
                </div>
              )}

              {/* Expand indicator */}
              {!isExpanded && (
                <div className="flex justify-center pb-2">
                  <ChevronDown className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
                </div>
              )}
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <div
                className="border-t border-border"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePasuk(pasuk.id);
                }}
              >
                <PasukDisplay
                  pasuk={pasuk}
                  seferId={seferId}
                  forceMinimized={false}
                  hideHeaderActions={true}
                />
              </div>
            )}
          </Card>
        );
      })}

      {pesukim.length === 0 && (
        <Card className="p-12 text-center animate-fade-in">
          <p className="text-lg text-muted-foreground">
            אין פסוקים להצגה
          </p>
        </Card>
      )}

      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-6 animate-fade-in">
          <Button
            variant="outline"
            size="lg"
            onClick={loadMore}
            className="gap-2 hover:bg-accent/50 transition-all hover:scale-105"
          >
            <Plus className="h-5 w-5" />
            <span className="font-medium">טען עוד {Math.min(loadMoreAmount, pesukim.length - displayedCount)} פסוקים ({pesukim.length - displayedCount} נותרו)</span>
          </Button>
        </div>
      )}

      {editorPasukId && (
        <ContentEditor
          pasukId={editorPasukId}
          pasukText={displayedPesukim.find(p => `${seferId}-${p.perek}-${p.pasuk_num}` === editorPasukId)?.text || ""}
          open={!!editorPasukId}
          onOpenChange={(open) => !open && setEditorPasukId(null)}
        />
      )}
    </div>
  );
});

// Component is exported above with memo wrapping
