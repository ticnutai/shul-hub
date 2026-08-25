import { useState, useRef, useCallback, useEffect } from "react";
import { Search, Navigation, X, Bookmark, StickyNote, Share2, Settings, Ellipsis, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDevice } from "@/contexts/DeviceContext";
import { SearchDialog } from "@/components/SearchDialog";
import { sharePasukLink } from "@/utils/shareUtils";
import { Input } from "@/components/ui/input";
import { logInteraction } from "@/utils/interactionDebug";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface FloatingActionButtonProps {
  onNavigateToPasuk?: (sefer: number, perek: number, pasuk: number) => void;
  onOpenQuickNav?: () => void;
  currentSefer?: number;
  currentPerek?: number | null;
  currentPasuk?: number | null;
}

/** Returns the bottom safe-area inset in pixels (Android nav bar / iPhone home indicator) */
function getSafeAreaBottom(): number {
  if (typeof window === 'undefined') return 0;
  const styles = getComputedStyle(document.documentElement);
  const standard = parseFloat(styles.getPropertyValue('--safe-area-inset-bottom')) || 0;
  if (standard > 0) return standard;
  const legacy = parseFloat(styles.getPropertyValue('--sai-bottom')) || 0;
  return legacy;
}

const PRIMARY_FAB_ACTIONS = [
  { id: "nav", icon: Navigation, label: "בחירה מהירה" },
  { id: "search", icon: Search, label: "חיפוש" },
  { id: "more", icon: Ellipsis, label: "עוד פונקציות" },
] as const;

const EXTRA_FAB_ACTIONS = [
  { id: "bookmarks", icon: Bookmark, label: "סימניות" },
  { id: "notes", icon: StickyNote, label: "הערות" },
  { id: "share", icon: Share2, label: "שתף פסוק" },
  { id: "settings", icon: Settings, label: "הגדרות" },
] as const;

const FAB_SIZE = 40;

function clampFabPosition(position: { x: number; y: number }) {
  const safeBottom = Math.max(getSafeAreaBottom(), 48);
  return {
    x: Math.min(Math.max(0, position.x), Math.max(0, window.innerWidth - FAB_SIZE)),
    y: Math.min(Math.max(0, position.y), Math.max(0, window.innerHeight - FAB_SIZE - safeBottom)),
  };
}

export const FloatingActionButton = ({
  onNavigateToPasuk,
  onOpenQuickNav,
  currentSefer,
  currentPerek,
  currentPasuk,
}: FloatingActionButtonProps) => {
  const { isMobile } = useDevice();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [showExtraActions, setShowExtraActions] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const defaultPosition = {
    x: 16,
    y: typeof window !== 'undefined' ? window.innerHeight - 168 - Math.max(getSafeAreaBottom(), 48) : 600,
  };

  // Dragging state
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('fab_position');
    if (!saved) return defaultPosition;
    try {
      const parsed = JSON.parse(saved);
      if (typeof window !== 'undefined') {
        return clampFabPosition(parsed);
      }
      return parsed;
    } catch {
      return defaultPosition;
    }
  });
  const [isDragging, setIsDragging] = useState(false);
  // isDraggingRef mirrors isDragging but as a ref so handlePointerUp always sees
  // the latest value even if React hasn't committed the state update yet (stale closure fix).
  const isDraggingRef = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, startX: 0, startY: 0 });
  const hasMoved = useRef(false);
  const positionRef = useRef(position);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // Local-first, last-write-wins synchronization of the draggable position.
  // Guests stay fully local; signed-in users receive their latest position on
  // every device without blocking the initial render.
  useEffect(() => {
    if (!user) return;

    const hasLocalPosition = localStorage.getItem('fab_position') !== null;
    const localTs = Number(localStorage.getItem('fab_position_ts')) || 0;
    const cloudTs = Number(user.user_metadata?.fab_position_ts) || 0;
    const cloudPosition = user.user_metadata?.fab_position as { x?: unknown; y?: unknown } | undefined;
    const hasCloudPosition = Number.isFinite(cloudPosition?.x) && Number.isFinite(cloudPosition?.y);

    if (hasCloudPosition && cloudTs > localTs) {
      const next = clampFabPosition({ x: Number(cloudPosition!.x), y: Number(cloudPosition!.y) });
      setPosition(next);
      localStorage.setItem('fab_position', JSON.stringify(next));
      localStorage.setItem('fab_position_ts', String(cloudTs));
      return;
    }

    if ((hasLocalPosition && !hasCloudPosition) || localTs > cloudTs) {
      const current = positionRef.current;
      const uploadTs = localTs || Date.now();
      localStorage.setItem('fab_position_ts', String(uploadTs));
      supabase.auth.updateUser({ data: {
        ...user.user_metadata,
        fab_position: current,
        fab_position_ts: uploadTs,
      } }).catch(() => {});
    }
  }, [user?.id]);

  // Capacitor 8 SystemBars plugin injects --safe-area-inset-bottom after DOM ready.
  // Re-check FAB position once on mount (with small delay) to account for injection timing.
  useEffect(() => {
    const adjustPosition = () => {
      const sab = Math.max(getSafeAreaBottom(), 48);
      const maxY = window.innerHeight - FAB_SIZE - sab;
      setPosition(prev => {
        if (prev.y > maxY) {
          const next = { ...prev, y: maxY };
          localStorage.setItem('fab_position', JSON.stringify(next));
          return next;
        }
        return prev;
      });
    };
    // Run immediately (vars may already be set by Capacitor 8)
    adjustPosition();
    // Run again after a short delay in case injection happens slightly after mount
    const t = setTimeout(adjustPosition, 200);
    return () => clearTimeout(t);
  }, []);
  const fabRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    logInteraction("FloatingActionButton", "pointer-down", {
      x: e.clientX,
      y: e.clientY,
      pointerType: e.pointerType,
      expanded,
    });
    isDraggingRef.current = true;
    setIsDragging(true);
    hasMoved.current = false;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      startX: position.x,
      startY: position.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position, expanded]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved.current = true;

    const newX = Math.max(0, Math.min(window.innerWidth - FAB_SIZE, dragStart.current.startX + dx));
    const newY = Math.max(0, Math.min(window.innerHeight - FAB_SIZE - getSafeAreaBottom(), dragStart.current.startY + dy));
    setPosition({ x: newX, y: newY });
  }, [isDragging, position, expanded]);

  const handlePointerUp = useCallback(() => {
    logInteraction("FloatingActionButton", "pointer-up", {
      isDragging,
      hasMoved: hasMoved.current,
      expanded,
      x: position.x,
      y: position.y,
    });
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      const finalPosition = positionRef.current;
      const ts = Date.now();
      localStorage.setItem('fab_position', JSON.stringify(finalPosition));
      localStorage.setItem('fab_position_ts', String(ts));
      if (hasMoved.current && user) {
        supabase.auth.updateUser({ data: {
          ...user.user_metadata,
          fab_position: finalPosition,
          fab_position_ts: ts,
        } }).catch(() => {});
      }
    }
  }, [position, expanded]);

  // Focus search input when expanded
  useEffect(() => {
    if (expanded && !isMobile) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchQuery("");
      setShowExtraActions(false);
    }
  }, [expanded, isMobile]);

  // Close expanded menu when clicking outside
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [expanded]);

  // Ctrl+K opens search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleAction = useCallback((actionId: string) => {
    logInteraction("FloatingActionButton", "action-click", {
      actionId,
      expanded,
      showExtraActions,
      currentSefer,
      currentPerek,
      currentPasuk,
    });
    switch (actionId) {
      case "search":
        setExpanded(false);
        setSearchOpen(true);
        break;
      case "nav":
        setExpanded(false);
        onOpenQuickNav?.();
        break;
      case "more":
        setShowExtraActions(true);
        break;
      case "bookmarks":
        setExpanded(false);
        setBookmarksOpen(true);
        break;
      case "notes":
        setExpanded(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case "share":
        setExpanded(false);
        if (currentSefer && currentPerek && currentPasuk) {
          sharePasukLink(currentSefer, currentPerek, currentPasuk);
        } else {
          if (navigator.share) {
            navigator.share({ title: "חמישה חומשי תורה עם פירושים", url: window.location.origin }).catch(() => {});
          } else {
            navigator.clipboard.writeText(window.location.href);
            import("sonner").then(({ toast }) => toast.success("הקישור הועתק!"));
          }
        }
        break;
      case "settings": {
        setExpanded(false);
        const settingsBtn = document.querySelector('[data-settings-trigger]') as HTMLElement;
        if (settingsBtn) settingsBtn.click();
        break;
      }
    }
  }, [onOpenQuickNav, currentSefer, currentPerek, currentPasuk, expanded, showExtraActions]);

  const handleSearchSubmit = useCallback(() => {
    logInteraction("FloatingActionButton", "search-submit", { searchQuery });
    if (searchQuery.trim()) {
      setExpanded(false);
      setSearchOpen(true);
      // Pass query via a brief delay so dialog mounts first
      setTimeout(() => {
        const input = document.querySelector('[data-search-dialog-input]') as HTMLInputElement;
        if (input) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          nativeInputValueSetter?.call(input, searchQuery.trim());
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, 200);
    }
  }, [searchQuery]);

  // Determine menu expansion direction based on position
  const isNearBottom = position.y > window.innerHeight / 2;

  const mainSize = "h-10 w-10";

  return (
    <>
      <div
        ref={fabRef}
        data-layout="floating-fab" data-layout-label="🔍 כפתור פעולה צף"
        className="fixed z-40"
        style={{ left: position.x, top: position.y }}
      >
        {/* Expanded panel: icons row + search input */}
        {expanded && (
          <div 
            className="absolute animate-fade-in"
            style={{
              [isNearBottom ? 'bottom' : 'top']: '50px',
              // Keep menu inside viewport: if FAB is near left edge, open to the right; otherwise open to the left
              ...(position.x < 230 ? { left: 0 } : { right: 0 }),
            }}
          >
            <div className={cn(
              "flex flex-col items-stretch gap-2 p-2.5 rounded-2xl",
              "bg-popover/95 backdrop-blur-md border border-border shadow-2xl",
              "w-[220px]"
            )}>
              {/* Action icons row */}
              <div className="flex items-center justify-center gap-1.5">
                {(showExtraActions ? EXTRA_FAB_ACTIONS : PRIMARY_FAB_ACTIONS).map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      onClick={() => handleAction(action.id)}
                      className={cn(
                        "rounded-full flex items-center justify-center transition-all duration-200",
                        "hover:scale-110 active:scale-95",
                        isMobile
                          ? "h-11 w-11 bg-muted/60 text-foreground hover:bg-accent hover:text-accent-foreground"
                          : "h-9 w-9 bg-muted/60 text-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                      title={action.label}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>

              {showExtraActions && (
                <button
                  onClick={() => setShowExtraActions(false)}
                  className={cn(
                    "rounded-xl h-8 w-full flex items-center justify-center gap-1.5 transition-colors",
                    "bg-muted/50 text-foreground hover:bg-muted"
                  )}
                  title="חזרה לתפריט הראשי"
                >
                  <ArrowRight className="h-4 w-4" />
                  <span className="text-xs font-medium">חזרה</span>
                </button>
              )}

              {/* Search input */}
              <div className="relative" dir="rtl">
                <Input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearchSubmit();
                  }}
                  placeholder="חיפוש בתורה..."
                  className="h-9 text-sm pr-9 rounded-xl bg-background/80"
                />
                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>
        )}

        {/* Main FAB - Draggable */}
        <div
          data-layout="fab-toggle"
          className={cn(
            "rounded-full cursor-grab select-none shadow-lg active:cursor-grabbing",
            "flex items-center justify-center border border-accent/80 bg-accent text-accent-foreground",
            "transition-[transform,box-shadow] duration-150 hover:shadow-xl",
            isDragging && "scale-110 opacity-80",
            mainSize
          )}
          style={{ touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={() => {
            // Toggle only when not dragged; hasMoved is false for a plain click
            if (!hasMoved.current) {
              logInteraction("FloatingActionButton", "toggle-expanded", { nextExpanded: !expanded });
              setExpanded(prev => !prev);
            }
          }}
        >
          {expanded ? (
            <X className="h-4 w-4" strokeWidth={2.25} />
          ) : (
            <Search className="h-4 w-4" strokeWidth={2.25} />
          )}
        </div>
      </div>

      {/* Search Dialog */}
      <SearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onNavigateToPasuk={onNavigateToPasuk}
      />

      {/* Bookmarks - trigger existing dialog */}
      {bookmarksOpen && <BookmarksTrigger onDone={() => setBookmarksOpen(false)} />}
    </>
  );
};

/** Finds and clicks the existing bookmarks trigger in the DOM */
function BookmarksTrigger({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const trigger = document.querySelector('[data-bookmarks-trigger]') as HTMLElement;
    if (trigger) trigger.click();
    onDone();
  }, [onDone]);
  return null;
}
