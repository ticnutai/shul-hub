import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { toHebrewNumber } from "@/utils/hebrewNumbers";

interface ReadingProgressProps {
  totalPesukim: number;
  currentPasukIndex: number;
  parshaName?: string | null;
}

export function ReadingProgress({ totalPesukim, currentPasukIndex, parshaName }: ReadingProgressProps) {
  const percentage = useMemo(() => {
    if (totalPesukim === 0) return 0;
    return Math.round(((currentPasukIndex + 1) / totalPesukim) * 100);
  }, [totalPesukim, currentPasukIndex]);

  if (totalPesukim === 0) return null;

  return (
    <div className="flex items-center gap-3 w-full" dir="rtl">
      <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
        {parshaName && `${parshaName}: `}{toHebrewNumber(currentPasukIndex + 1)}/{toHebrewNumber(totalPesukim)}
      </span>
      <Progress value={percentage} className="h-1.5 flex-1" />
      <span className="text-xs text-muted-foreground flex-shrink-0">{percentage}%</span>
    </div>
  );
}
