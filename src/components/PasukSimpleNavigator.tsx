import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { toHebrewNumber } from "@/utils/hebrewNumbers";
import { FlatPasuk } from "@/types/torah";

interface PasukSimpleNavigatorProps {
  pesukim: FlatPasuk[];
  currentPasukNum: number | null;
  onNavigate: (pasukNum: number) => void;
}

export const PasukSimpleNavigator = ({ 
  pesukim, 
  currentPasukNum, 
  onNavigate 
}: PasukSimpleNavigatorProps) => {
  if (!currentPasukNum || pesukim.length === 0) return null;

  const currentIndex = pesukim.findIndex(p => p.pasuk_num === currentPasukNum);
  if (currentIndex === -1) return null;

  const canNavigatePrev = currentIndex > 0;
  const canNavigateNext = currentIndex < pesukim.length - 1;

  const handlePrev = () => {
    if (canNavigatePrev) {
      onNavigate(pesukim[currentIndex - 1].pasuk_num);
    }
  };

  const handleNext = () => {
    if (canNavigateNext) {
      onNavigate(pesukim[currentIndex + 1].pasuk_num);
    }
  };

  const currentPasuk = pesukim[currentIndex];

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePrev}
        disabled={!canNavigatePrev}
        className="h-8 w-8 p-0 rounded-full hover:bg-primary/10 disabled:opacity-20 transition-colors"
        title="פסוק קודם"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
      
      <span className="text-sm font-semibold text-primary min-w-[2rem] text-center">
        {toHebrewNumber(currentPasuk.pasuk_num)}
      </span>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={handleNext}
        disabled={!canNavigateNext}
        className="h-8 w-8 p-0 rounded-full hover:bg-primary/10 disabled:opacity-20 transition-colors"
        title="פסוק הבא"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
    </div>
  );
};
