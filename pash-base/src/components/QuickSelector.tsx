import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toHebrewNumber } from "@/utils/hebrewNumbers";
import { Sefer } from "@/types/torah";
import { ArrowRight, Home } from "lucide-react";
import { logInteraction } from "@/utils/interactionDebug";

type SelectionLevel = "parsha" | "perek" | "pasuk";

interface QuickSelectorProps {
  sefer: Sefer | null;
  selectedParsha: number | null;
  onParshaSelect: (parsha: number | null) => void;
  selectedPerek: number | null;
  onPerekSelect: (perek: number | null) => void;
  totalPesukimInPerek?: number;
  selectedPasuk: number | null;
  onPasukSelect: (pasuk: number | null) => void;
  onResetToSefer?: () => void;
}

export const QuickSelector = ({
  sefer,
  selectedParsha,
  onParshaSelect,
  selectedPerek,
  onPerekSelect,
  totalPesukimInPerek = 0,
  selectedPasuk,
  onPasukSelect,
  onResetToSefer,
}: QuickSelectorProps) => {
  const [currentLevel, setCurrentLevel] = useState<SelectionLevel>("parsha");

  const selectedParshaName = useMemo(() => {
    if (!sefer || selectedParsha === null) return null;
    return sefer.parshiot.find(p => p.parsha_id === selectedParsha)?.parsha_name ?? null;
  }, [sefer, selectedParsha]);

  const selectedButtonClass = "border-accent text-primary";

  // Reset to parsha level when sefer changes
  useEffect(() => {
    setCurrentLevel("parsha");
  }, [sefer?.sefer_id]);

  // Keep the dialog in sync with the actual selection state
  useEffect(() => {
    if (selectedParsha === null) {
      setCurrentLevel("parsha");
      return;
    }

    if (selectedPerek === null) {
      setCurrentLevel("perek");
      return;
    }

    setCurrentLevel("pasuk");
  }, [selectedParsha, selectedPerek]);

  // Get perakim for the selected parsha only
  const perakimToShow = useMemo(() => {
    if (!sefer || selectedParsha === null) return [];
    const parsha = sefer.parshiot.find(p => p.parsha_id === selectedParsha);
    return parsha?.perakim || [];
  }, [sefer, selectedParsha]);

  // מציאת פסוקים עם תוכן בפרק הנבחר
  const pesukimWithContent = useMemo(() => {
    if (!sefer || selectedPerek === null) return new Set<number>();
    const pasukNumbers = new Set<number>();
    
    for (const parsha of sefer.parshiot) {
      for (const perek of parsha.perakim) {
        if (perek.perek_num === selectedPerek) {
          for (const pasuk of perek.pesukim) {
            if (pasuk.content && pasuk.content.some(c => c.questions.length > 0)) {
              pasukNumbers.add(pasuk.pasuk_num);
            }
          }
        }
      }
    }
    
    return pasukNumbers;
  }, [sefer, selectedPerek]);

  const handleParshaSelect = (parshaId: number) => {
    logInteraction("QuickSelector", "parsha-click", { parshaId });
    onParshaSelect(parshaId);
    onPerekSelect(null);
    onPasukSelect(null);
    setCurrentLevel("perek");
  };

  const handlePerekSelect = (perek: number) => {
    logInteraction("QuickSelector", "perek-click", { perek });
    onPerekSelect(perek);
    onPasukSelect(null);
    setCurrentLevel("pasuk");
  };

  const handlePasukSelect = (pasuk: number) => {
    logInteraction("QuickSelector", "pasuk-click", { pasuk });
    onPasukSelect(pasuk);
  };

  const handleBack = () => {
    logInteraction("QuickSelector", "back-click", { currentLevel });
    if (currentLevel === "pasuk") {
      setCurrentLevel("perek");
      onPasukSelect(null);
    } else if (currentLevel === "perek") {
      setCurrentLevel("parsha");
      onPerekSelect(null);
    }
  };

  const handleReset = () => {
    logInteraction("QuickSelector", "reset-click");
    setCurrentLevel("parsha");
    onParshaSelect(null);
    onPerekSelect(null);
    onPasukSelect(null);
  };

  const getCurrentTitle = () => {
    if (currentLevel === "pasuk" && selectedPerek !== null) {
      return `פסוקים - פרק ${toHebrewNumber(selectedPerek)}`;
    }
    if (currentLevel === "perek" && selectedParsha !== null) {
      const parsha = sefer?.parshiot.find(p => p.parsha_id === selectedParsha);
      return `פרקים - ${parsha?.parsha_name || ""}`;
    }
    return "פרשות";
  };

  if (!sefer) return null;

  return (
    <Card className="p-4 h-fit w-full animate-fade-in" data-quick-selector>
      <div className="space-y-4">
        {/* Header with Navigation */}
        <div className="flex items-center justify-between gap-2 flex-wrap transition-all duration-300">
          <h3 className="font-semibold text-base sm:text-lg break-words flex-1 min-w-0 transition-all duration-300">{getCurrentTitle()}</h3>
          <div className="flex gap-1 sm:gap-2 flex-shrink-0">
            {currentLevel !== "parsha" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="gap-1 h-8 px-2 sm:h-9 sm:px-3 transition-all duration-200"
              >
                <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 transition-transform duration-200" />
                <span className="hidden sm:inline">חזור</span>
              </Button>
            )}
            {(selectedParsha !== null || selectedPerek !== null) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="gap-1 h-8 px-2 sm:h-9 sm:px-3 transition-all duration-200 animate-fade-in"
              >
                <Home className="h-3 w-3 sm:h-4 sm:w-4 transition-transform duration-200" />
                <span className="hidden sm:inline">התחל מחדש</span>
              </Button>
            )}
          </div>
        </div>

        {/* Breadcrumb tabs (Sefer / Parsha / Perek) */}
        <div className="flex items-center gap-2 flex-nowrap overflow-x-auto" dir="rtl">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onResetToSefer ? onResetToSefer() : handleReset()}
            className={cn("h-9 px-4 font-bold whitespace-nowrap", selectedButtonClass)}
            title="חזרה לבחירת חומש"
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
                פרק {toHebrewNumber(selectedPerek)}
              </Button>
            </>
          )}
        </div>

        {/* Dynamic Content Based on Current Level */}
        <ScrollArea className="h-[400px]">
          {currentLevel === "parsha" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 animate-fade-in" dir="rtl">
              {sefer.parshiot.map((parsha) => (
                <Button
                  key={parsha.parsha_id}
                  variant="outline"
                  onClick={() => handleParshaSelect(parsha.parsha_id)}
                  className={cn(
                    "text-xs sm:text-sm h-auto py-3 px-2 sm:px-3 break-words whitespace-normal text-center transition-opacity duration-200",
                    selectedParsha === parsha.parsha_id && selectedButtonClass
                  )}
                >
                  {parsha.parsha_name}
                </Button>
              ))}
            </div>
          )}

          {currentLevel === "perek" && selectedParsha !== null && (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 p-2 animate-fade-in" dir="rtl">
              {perakimToShow.map((perek, index) => (
                <Button
                  key={perek.perek_num}
                  variant="outline"
                  onClick={() => handlePerekSelect(perek.perek_num)}
                  className={cn(
                    "aspect-square font-bold text-base sm:text-lg touch-manipulation",
                    selectedPerek === perek.perek_num && selectedButtonClass
                  )}
                >
                  {toHebrewNumber(perek.perek_num)}
                </Button>
              ))}
            </div>
          )}

          {currentLevel === "pasuk" && selectedPerek !== null && totalPesukimInPerek > 0 && (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 p-2 animate-fade-in" dir="rtl">
              {Array.from({ length: totalPesukimInPerek }, (_, i) => i + 1).map((pasuk) => {
                const hasContent = pesukimWithContent.has(pasuk);
                return (
                  <Button
                    key={pasuk}
                    variant="outline"
                    onClick={() => handlePasukSelect(pasuk)}
                    className={cn(
                      "aspect-square font-bold relative touch-manipulation text-base sm:text-lg transition-opacity duration-200",
                      selectedPasuk === pasuk && selectedButtonClass,
                      !hasContent && "opacity-40"
                    )}
                    disabled={!hasContent}
                    title={hasContent ? `פסוק ${toHebrewNumber(pasuk)}` : "אין תוכן לפסוק זה"}
                  >
                    {toHebrewNumber(pasuk)}
                    {hasContent && (
                      <span className="absolute top-0 right-0 h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    )}
                  </Button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    </Card>
  );
};
