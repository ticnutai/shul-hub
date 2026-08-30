import { useState, useMemo, useEffect, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toHebrewNumber } from "@/utils/hebrewNumbers";
import { Sefer } from "@/types/torah";
import {
  ArrowRight,
  Bookmark,
  Circle,
  Ellipsis,
  Home,
  Search,
  Settings,
  Share2,
  StickyNote,
} from "lucide-react";
import { useDevice } from "@/contexts/DeviceContext";
import { logInteraction } from "@/utils/interactionDebug";

type SelectionLevel = "parsha" | "perek" | "pasuk";

interface FloatingQuickSelectorProps {
  sefer: Sefer | null;
  selectedParsha: number | null;
  onParshaSelect: (parsha: number | null) => void;
  selectedPerek: number | null;
  onPerekSelect: (perek: number | null) => void;
  totalPesukimInPerek: number;
  selectedPasuk: number | null;
  onPasukSelect: (pasuk: number | null) => void;
  hiddenTrigger?: boolean;
  openRequest?: number;
}

export const FloatingQuickSelector = ({
  sefer,
  selectedParsha,
  onParshaSelect,
  selectedPerek,
  onPerekSelect,
  totalPesukimInPerek,
  selectedPasuk,
  onPasukSelect,
  hiddenTrigger = false,
  openRequest = 0,
}: FloatingQuickSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [currentLevel, setCurrentLevel] = useState<SelectionLevel>("parsha");
  const [showHeaderExtras, setShowHeaderExtras] = useState(false);
  const handledOpenRequest = useRef(0);
  const { isMobile } = useDevice();

  // Reset to parsha level when sefer changes
  useEffect(() => {
    setCurrentLevel("parsha");
    setOpen(false);
    logInteraction("FloatingQuickSelector", "sefer-change-reset", { seferId: sefer?.sefer_id });
  }, [sefer?.sefer_id]);

  // A request may arrive while the large Torah data chunk is still loading.
  // Keep it pending and open as soon as the selector has a sefer to display.
  useEffect(() => {
    if (!isMobile || !sefer || openRequest <= handledOpenRequest.current) return;
    handledOpenRequest.current = openRequest;
    setCurrentLevel("parsha");
    setShowHeaderExtras(false);
    setOpen(true);
  }, [isMobile, openRequest, sefer]);

  // Get perakim for the selected parsha only
  const perakimToShow = useMemo(() => {
    if (!sefer || selectedParsha === null) return [];
    const parsha = sefer.parshiot.find(p => p.parsha_id === selectedParsha);
    return parsha?.perakim || [];
  }, [sefer, selectedParsha]);

  const selectedParshaName = useMemo(() => {
    if (!sefer || selectedParsha === null) return null;
    return sefer.parshiot.find(p => p.parsha_id === selectedParsha)?.parsha_name ?? null;
  }, [sefer, selectedParsha]);

  const pesukimWithContent = useMemo(() => {
    if (!sefer || selectedPerek === null) return new Set<number>();
    
    const contentSet = new Set<number>();
    for (const parsha of sefer.parshiot) {
      for (const perek of parsha.perakim) {
        if (perek.perek_num === selectedPerek) {
          perek.pesukim.forEach(pasuk => {
            if (pasuk.content && pasuk.content.length > 0) {
              contentSet.add(pasuk.pasuk_num);
            }
          });
        }
      }
    }
    return contentSet;
  }, [sefer, selectedPerek]);

  const handleParshaSelect = (parshaId: number) => {
    logInteraction("FloatingQuickSelector", "parsha-click", { parshaId });
    onParshaSelect(parshaId);
    onPerekSelect(null);
    onPasukSelect(null);
    setCurrentLevel("perek");
  };

  const handlePerekSelect = (perekNum: number) => {
    logInteraction("FloatingQuickSelector", "perek-click", { perekNum });
    onPerekSelect(perekNum);
    onPasukSelect(null);
    setCurrentLevel("pasuk");
  };

  const handlePasukSelect = (pasukNum: number) => {
    logInteraction("FloatingQuickSelector", "pasuk-click", { pasukNum });
    onPasukSelect(pasukNum);
    setOpen(false); // Close popover after selecting a pasuk
  };

  const handleBack = () => {
    logInteraction("FloatingQuickSelector", "back-click", { currentLevel });
    if (currentLevel === "pasuk") {
      setCurrentLevel("perek");
      onPasukSelect(null);
    } else if (currentLevel === "perek") {
      setCurrentLevel("parsha");
      onPerekSelect(null);
      onPasukSelect(null);
    }
  };

  const handleReset = () => {
    logInteraction("FloatingQuickSelector", "reset-click");
    setCurrentLevel("parsha");
    onParshaSelect(null);
    onPerekSelect(null);
    onPasukSelect(null);
  };

  const getCurrentTitle = () => {
    if (isMobile) {
      if (currentLevel === "parsha") return "פרשות";
      if (currentLevel === "perek") return "פרקים";
      return "פסוקים";
    }
    if (currentLevel === "parsha") {
      return "בחר פרשה";
    } else if (currentLevel === "perek") {
      const parsha = sefer?.parshiot.find(p => p.parsha_id === selectedParsha);
      return `בחר פרק - ${parsha?.parsha_name || ""}`;
    } else {
      return `בחר פסוק - פרק ${toHebrewNumber(selectedPerek || 0)}`;
    }
  };

  if (!sefer) return null;

  const selectedButtonClass = "border-accent text-primary";

  const runHeaderAction = (actionId: "search" | "bookmarks" | "notes" | "share" | "settings") => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("torah-mobile-quick-action", { detail: actionId }));
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setCurrentLevel("parsha");
          setShowHeaderExtras(false);
        }
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          data-floating-quick-trigger
          size="icon"
          className={cn(
            "fixed bottom-4 rounded-full shadow-xl z-40 touch-manipulation",
            isMobile ? "right-4" : "left-4",
            "bg-accent hover:bg-accent/90 text-accent-foreground active:scale-95 border-2 border-accent",
            "transition-colors duration-200",
            isMobile ? "h-14 w-14" : "h-11 w-11",
            hiddenTrigger && "opacity-0 pointer-events-none"
          )}
          style={{ bottom: 'calc(1rem + var(--safe-area-inset-bottom, var(--sai-bottom, env(safe-area-inset-bottom, 0px))))' }}
          aria-label="פתח בחירה מהירה"
        >
          <Circle className={cn(isMobile ? "h-3.5 w-3.5" : "h-3 w-3", "text-accent-foreground stroke-[3]")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align={isMobile ? "end" : "start"}
        sideOffset={12}
        dir="rtl"
        data-testid="mobile-torah-selector"
        className={cn(
          "p-0 overflow-hidden border border-accent bg-card text-foreground",
          isMobile ? "w-[calc(100vw-2rem)] max-h-[min(72dvh,620px)]" : "w-[320px] max-h-[400px]",
        )}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-muted/50 backdrop-blur-sm border-b p-3 flex items-center justify-between gap-2" dir="rtl">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {currentLevel !== "parsha" && (
              <Button
                size="sm"
                onClick={handleBack}
                className="h-8 px-3 flex-shrink-0 bg-accent hover:bg-accent/90 text-accent-foreground font-bold"
              >
                <ArrowRight className="h-4 w-4 ml-1" />
                חזור
              </Button>
            )}
            <h3 className="font-semibold text-sm break-words flex-1 text-right">{getCurrentTitle()}</h3>
          </div>
          {isMobile && (
            <div
              className="flex min-w-0 items-center justify-start gap-0.5"
              data-testid="mobile-selector-actions"
            >
              {showHeaderExtras ? (
                <>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => setShowHeaderExtras(false)} aria-label="חזרה לפעולות הראשיות">
                    <ArrowRight className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => runHeaderAction("bookmarks")} aria-label="סימניות">
                    <Bookmark className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => runHeaderAction("notes")} aria-label="הערות">
                    <StickyNote className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => runHeaderAction("share")} aria-label="שיתוף">
                    <Share2 className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => runHeaderAction("settings")} aria-label="הגדרות">
                    <Settings className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => runHeaderAction("search")} aria-label="חיפוש">
                    <Search className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => setShowHeaderExtras(true)} aria-label="פעולות נוספות">
                    <Ellipsis className="size-4" />
                  </Button>
                </>
              )}
            </div>
          )}
          {!isMobile && currentLevel !== "parsha" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-8 px-2 flex-shrink-0"
            >
              <Home className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Breadcrumb tabs: Sefer / Parsha / Perek */}
        <div className="px-3 py-2 border-b bg-card" dir="rtl">
          <div className="flex items-center gap-2 flex-nowrap overflow-x-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className={cn("h-9 px-4 font-bold whitespace-nowrap", selectedButtonClass)}
              title="חזרה לבחירת פרשה"
            >
              {sefer.sefer_name}
            </Button>

            {selectedParshaName && (
              <>
                <span className="text-muted-foreground select-none">›</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onPerekSelect(null);
                    onPasukSelect(null);
                    setCurrentLevel("parsha");
                  }}
                  className={cn("h-9 px-4 font-bold whitespace-nowrap", selectedButtonClass)}
                  title="חזרה לבחירת פרשה"
                >
                  {selectedParshaName}
                </Button>
              </>
            )}

            {selectedPerek !== null && (
              <>
                <span className="text-muted-foreground select-none">›</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onPasukSelect(null);
                    setCurrentLevel("perek");
                  }}
                  className={cn("h-9 px-4 font-bold whitespace-nowrap", selectedButtonClass)}
                  title="חזרה לבחירת פרק"
                >
                  {isMobile ? toHebrewNumber(selectedPerek) : `פרק ${toHebrewNumber(selectedPerek)}`}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <ScrollArea className={cn(isMobile ? "h-[min(52dvh,430px)]" : "h-[320px]")}>
          <div className={cn("p-3", !isMobile && "space-y-2")} dir="rtl">
            {currentLevel === "parsha" && (
              <div
                data-selector-level="parsha"
                className={cn(isMobile ? "grid grid-cols-2 gap-2" : "space-y-2")}
              >
                {sefer.parshiot.map((parsha) => (
                  <Button
                    key={parsha.parsha_id}
                    variant="outline"
                    className={cn(
                      "w-full h-auto touch-manipulation break-words whitespace-normal",
                      isMobile ? "min-h-12 justify-center px-2 py-2 text-center" : "justify-start px-4 py-3 text-right",
                      selectedParsha === parsha.parsha_id && selectedButtonClass
                    )}
                    onClick={() => handleParshaSelect(parsha.parsha_id)}
                  >
                    <span className="font-semibold break-words">{parsha.parsha_name}</span>
                  </Button>
                ))}
              </div>
            )}

            {currentLevel === "perek" && selectedParsha !== null && (
              <div
                data-selector-level="perek"
                className={cn(isMobile ? "grid grid-cols-4 gap-2" : "space-y-2")}
              >
                {perakimToShow.map((perek) => (
                  <Button
                    key={perek.perek_num}
                    variant="outline"
                    className={cn(
                      "w-full touch-manipulation",
                      isMobile ? "h-11 justify-center px-1 py-1 text-center" : "h-auto justify-start px-4 py-3 text-right",
                      selectedPerek === perek.perek_num && selectedButtonClass
                    )}
                    onClick={() => handlePerekSelect(perek.perek_num)}
                  >
                    <span className="font-semibold">
                      {isMobile ? toHebrewNumber(perek.perek_num) : `פרק ${toHebrewNumber(perek.perek_num)}`}
                    </span>
                  </Button>
                ))}
              </div>
            )}

            {currentLevel === "pasuk" && selectedPerek !== null && (
              <div
                data-selector-level="pasuk"
                className={cn(isMobile ? "grid grid-cols-5 gap-2" : "space-y-2")}
              >
                {Array.from({ length: totalPesukimInPerek }, (_, i) => i + 1).map((pasukNum) => {
                  const hasContent = pesukimWithContent.has(pasukNum);
                  return (
                    <Button
                      key={pasukNum}
                      variant="outline"
                      className={cn(
                        "w-full touch-manipulation",
                        isMobile ? "relative h-12 justify-center px-1 py-1 text-center" : "h-auto justify-start px-4 py-3 text-right",
                        selectedPasuk === pasukNum && selectedButtonClass,
                        !hasContent && "opacity-50"
                      )}
                      onClick={() => handlePasukSelect(pasukNum)}
                      disabled={!hasContent}
                    >
                      <span className="font-semibold">
                        {isMobile ? toHebrewNumber(pasukNum) : `פסוק ${toHebrewNumber(pasukNum)}`}
                      </span>
                      {hasContent && (
                        <span className={cn("h-2 w-2 rounded-full bg-accent", isMobile && "absolute right-1 top-1")} />
                      )}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
