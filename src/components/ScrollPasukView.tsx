import { useState, useCallback, memo } from "react";
import { FlatPasuk } from "@/types/torah";
import { Card } from "@/components/ui/card";
import { toHebrewNumber } from "@/utils/hebrewNumbers";
import { PasukDisplay } from "@/components/PasukDisplay";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScrollPasukViewProps {
  pesukim: FlatPasuk[];
  seferId: number;
  forceMinimized?: boolean;
}

export const ScrollPasukView = memo(({ pesukim, seferId, forceMinimized = false }: ScrollPasukViewProps) => {
  const [expandedPasukIds, setExpandedPasukIds] = useState<Set<string>>(new Set());

  const getPasukKey = useCallback((pasuk: FlatPasuk) => `${pasuk.sefer}-${pasuk.perek}-${pasuk.pasuk_num}`, []);

  const handlePasukClick = useCallback((pasuk: FlatPasuk) => {
    const key = `${pasuk.sefer}-${pasuk.perek}-${pasuk.pasuk_num}`;
    setExpandedPasukIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  }, []);

  const isPasukExpanded = (pasuk: FlatPasuk) => expandedPasukIds.has(getPasukKey(pasuk));

  return (
    <div className="space-y-4 w-full max-w-full overflow-hidden animate-fade-in">
      {/* Each Pasuk with expandable content */}
      {pesukim.map((pasuk) => {
        const isExpanded = isPasukExpanded(pasuk);
        return (
          <Card 
            key={`${pasuk.sefer}-${pasuk.perek}-${pasuk.pasuk_num}`} 
            id={`pasuk-${pasuk.sefer}-${pasuk.perek}-${pasuk.pasuk_num}`}
            className={cn(
              "overflow-hidden w-full transition-all duration-300 border-r-4",
              isExpanded ? "border-r-primary shadow-xl ring-2 ring-primary/50" : "border-r-accent shadow-sm hover:shadow-md"
            )}
            style={{
              minHeight: isExpanded ? 'auto' : '80px',
              contain: 'layout style',
            }}
          >
            {/* Pasuk Text - Clickable */}
            <div
              className="w-full text-right p-4 md:p-6 transition-all duration-200"
            >
              <button 
                onClick={() => handlePasukClick(pasuk)}
                className="flex items-start gap-3 w-full hover:bg-accent/10 p-2 rounded-lg transition-colors"
              >
                <span className="font-bold text-primary text-xl md:text-2xl flex-shrink-0 font-['Frank_Ruhl_Libre'] transition-colors duration-200">
                  {toHebrewNumber(pasuk.pasuk_num)}
                </span>
                <div className="flex-1 overflow-hidden">
                  <div 
                    className="leading-loose break-words"
                    dir="rtl"
                    style={{
                      fontFamily: "'David Libre', 'Noto Serif Hebrew', serif",
                      fontSize: 'clamp(16px, 1.3vw + 12px, 24px)',
                      fontWeight: 500,
                      textRendering: 'optimizeLegibility',
                      WebkitFontSmoothing: 'antialiased',
                      overflowWrap: 'break-word',
                      wordBreak: 'break-word',
                      maxWidth: '100%',
                    }}
                  >
                    {pasuk.text}
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs md:text-sm text-muted-foreground mt-2 transition-colors duration-200">
                    <span className="flex items-center gap-1">
                      {pasuk.parsha_name}
                      <span className="hidden sm:inline">•</span>
                    </span>
                    <span className="flex items-center gap-1">
                      פרק {toHebrewNumber(pasuk.perek)}
                      {!isExpanded && pasuk.content && pasuk.content.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-primary font-medium transition-colors duration-200">לחץ לפתיחה</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </button>
            </div>

            {/* Expanded Content with Animation */}
            {isExpanded && (
              <div className="border-t border-border animate-accordion-down">
                <PasukDisplay 
                  pasuk={pasuk} 
                  seferId={seferId}
                  forceMinimized={false}
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
    </div>
  );
});
