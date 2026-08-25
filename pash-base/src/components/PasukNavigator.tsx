import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft } from "lucide-react";
import { toHebrewNumber, fromHebrewNumber } from "@/utils/hebrewNumbers";
import { FlatPasuk } from "@/types/torah";
import { cn } from "@/lib/utils";

interface PasukNavigatorProps {
  pesukim: FlatPasuk[];
  currentIndex: number;
  onNavigate: (index: number) => void;
}

export const PasukNavigator = ({ pesukim, currentIndex, onNavigate }: PasukNavigatorProps) => {
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && currentIndex > 0) {
        onNavigate(currentIndex - 1);
      } else if (e.key === "ArrowLeft" && currentIndex < pesukim.length - 1) {
        onNavigate(currentIndex + 1);
      } else if (e.key === "Home") {
        onNavigate(0);
      } else if (e.key === "End") {
        onNavigate(pesukim.length - 1);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [currentIndex, pesukim.length, onNavigate]);

  const handleFirst = () => onNavigate(0);
  const handlePrevious = () => {
    if (currentIndex > 0) onNavigate(currentIndex - 1);
  };
  const handleNext = () => {
    if (currentIndex < pesukim.length - 1) onNavigate(currentIndex + 1);
  };
  const handleLast = () => onNavigate(pesukim.length - 1);

  const handleInputChange = (value: string) => {
    setInputValue(value);
    // Try to parse as Hebrew number
    const num = fromHebrewNumber(value);
    if (num > 0 && num <= pesukim.length) {
      onNavigate(num - 1);
    }
  };

  const currentPasuk = pesukim[currentIndex];

  return (
    <Card className="p-2 py-2 md:py-3 bg-gradient-to-l from-primary/5 to-card shadow-lg sticky top-20 z-10 animate-scale-in">
      <div className="flex items-center justify-between gap-1 md:gap-3 transition-all duration-300">
        {/* Navigation buttons - Right side */}
        <div className="flex items-center gap-0.5 md:gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={handleLast}
            disabled={currentIndex >= pesukim.length - 1}
            className="h-10 w-10 md:h-9 md:w-9 hover:bg-primary/10 transition-all duration-200 hover:scale-110 disabled:opacity-50 disabled:hover:scale-100"
          >
            <ChevronsLeft className="h-4 w-4 md:h-5 md:w-5 transition-transform duration-200" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            disabled={currentIndex >= pesukim.length - 1}
            className="h-10 w-10 md:h-9 md:w-9 hover:bg-primary/10 transition-all duration-200 hover:scale-110 disabled:opacity-50 disabled:hover:scale-100"
          >
            <ChevronLeft className="h-4 w-4 md:h-5 md:w-5 transition-transform duration-200" />
          </Button>
        </div>

        {/* Center info - Responsive layout */}
        <div className="flex items-center gap-1 md:gap-2 text-center animate-fade-in flex-1 justify-center min-w-0">
          {currentPasuk && (
            <>
              {/* Mobile layout - compact */}
              <span className="text-xs font-bold text-primary flex items-center gap-1 md:hidden">
                <span>פ: {toHebrewNumber(currentPasuk.perek)}</span>
                <span className="text-muted-foreground">•</span>
                <span>פס: {toHebrewNumber(currentPasuk.pasuk_num)}</span>
              </span>
              {/* Desktop layout - full text */}
              <span className="hidden md:inline text-base font-bold text-primary whitespace-nowrap transition-all duration-300">
                פרק {toHebrewNumber(currentPasuk.perek)} פסוק {toHebrewNumber(currentPasuk.pasuk_num)}
              </span>
            </>
          )}
        </div>

        {/* Navigation buttons - Left side */}
        <div className="flex items-center gap-0.5 md:gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevious}
            disabled={currentIndex <= 0}
            className="h-10 w-10 md:h-9 md:w-9 hover:bg-primary/10 transition-all duration-200 hover:scale-110 disabled:opacity-50 disabled:hover:scale-100"
          >
            <ChevronRight className="h-4 w-4 md:h-5 md:w-5 transition-transform duration-200" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleFirst}
            disabled={currentIndex <= 0}
            className="h-10 w-10 md:h-9 md:w-9 hover:bg-primary/10 transition-all duration-200 hover:scale-110 disabled:opacity-50 disabled:hover:scale-100"
          >
            <ChevronsRight className="h-4 w-4 md:h-5 md:w-5 transition-transform duration-200" />
          </Button>
          
          {/* Quick jump input - hidden on mobile for space */}
          <input
            type="text"
            value={inputValue || toHebrewNumber(currentIndex + 1)}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => setInputValue("")}
            onBlur={() => setInputValue("")}
            placeholder="א׳"
            className={cn(
              "hidden md:block h-9 w-16 px-2 rounded-md border bg-background text-center text-sm transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:scale-105"
            )}
          />
        </div>
      </div>
    </Card>
  );
};
