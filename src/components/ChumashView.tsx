import { memo, useMemo, useCallback } from "react";
import { FlatPasuk } from "@/types/torah";
import { toHebrewNumber } from "@/utils/hebrewNumbers";
import { cn } from "@/lib/utils";
import { useFontAndColorSettings } from "@/contexts/FontAndColorSettingsContext";
import { useTextDisplayStyles } from "@/hooks/useTextDisplayStyles";
import { TextHighlighter } from "@/components/TextHighlighter";

interface ChumashViewProps {
  pesukim: FlatPasuk[];
  seferId: number;
  selectedPasukId?: number | null;
  onPasukSelect?: (pasukId: number, pasuk: FlatPasuk) => void;
}

const shouldTraceChumash = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return (
      (window as Window & { __CHUMASH_TRACE__?: boolean }).__CHUMASH_TRACE__ === true ||
      localStorage.getItem("debug_chumash_trace") === "true"
    );
  } catch {
    return false;
  }
};

const ChumashViewComponent = ({ 
  pesukim, 
  seferId, 
  selectedPasukId = null,
  onPasukSelect 
}: ChumashViewProps) => {
  const { settings } = useFontAndColorSettings();
  const displayStyles = useTextDisplayStyles();
  
  // Memoized grouping for performance
  const groupedByPerek = useMemo(() => {
    return pesukim.reduce((acc, pasuk) => {
      const key = `${pasuk.parsha_id}-${pasuk.perek}`;
      if (!acc[key]) {
        acc[key] = {
          perek: pasuk.perek,
          parshaName: pasuk.parsha_name,
          pesukim: []
        };
      }
      acc[key].pesukim.push(pasuk);
      return acc;
    }, {} as Record<string, { perek: number; parshaName: string; pesukim: FlatPasuk[] }>);
  }, [pesukim]);

  const handlePasukClick = useCallback((pasukId: number, pasuk: FlatPasuk) => {
    onPasukSelect?.(pasukId, pasuk);
  }, [onPasukSelect]);

  return (
    <div className="w-full max-w-4xl mx-auto animate-fade-in">
      {/* Beautiful Chumash-style continuous text */}
        <div 
          className="bg-gradient-to-b from-[hsl(40,40%,96%)] to-[hsl(40,35%,94%)] dark:from-[hsl(220,20%,12%)] dark:to-[hsl(220,25%,10%)] rounded-xl shadow-lg border border-border/50 p-6 md:p-10"
          style={{
            fontFamily: settings?.pasukFont || "'David Libre', 'Noto Serif Hebrew', serif",
            textRendering: 'optimizeLegibility',
            WebkitFontSmoothing: 'antialiased',
          }}
        >
          {Object.values(groupedByPerek).map((group) => (
            <div key={`${group.parshaName}-${group.perek}`} className="mb-8 last:mb-0">
              {/* Perek header - elegant separator */}
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                <span className="text-lg font-semibold text-primary/80 px-4">
                  פרק {toHebrewNumber(group.perek)}
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
              </div>

              {/* Continuous pesukim text */}
              <p 
                className="text-right"
                style={{
                  lineHeight: displayStyles.lineHeight || '2.2',
                  letterSpacing: displayStyles.letterSpacing || '0.01em',
                  wordSpacing: displayStyles.wordSpacing || '0em',
                  fontSize: settings?.pasukSize ? `${settings.pasukSize}px` : '1.25rem',
                  fontWeight: settings?.pasukBold ? 'bold' : 500,
                  color: settings?.pasukColor || 'hsl(var(--foreground))',
                  textAlign: displayStyles.textAlign,
                  textAlignLast: displayStyles.textAlign === 'justify' ? 'right' : displayStyles.textAlign,
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                }}
                dir="rtl"
              >
                {group.pesukim.map((pasuk, index) => {
                  const isSelected = selectedPasukId === pasuk.id;
                  const hasContent = pasuk.content && pasuk.content.length > 0;
                  const pasukIdStr = `${seferId}-${pasuk.perek}-${pasuk.pasuk_num}`;
                  
                  return (
                    <span
                      key={pasuk.id}
                      data-chumash-item="pasuk"
                      data-pasuk-id={pasuk.id}
                      data-pasuk-num={pasuk.pasuk_num}
                      data-has-content={hasContent ? "true" : "false"}
                      className={cn(
                        "inline cursor-pointer transition-colors duration-200 rounded-sm",
                        isSelected 
                          ? "bg-primary/20 dark:bg-primary/30" 
                          : hasContent 
                            ? "hover:bg-accent/30 dark:hover:bg-accent/20" 
                            : "hover:bg-muted/50",
                      )}
                      onMouseEnter={() => {
                        if (!shouldTraceChumash()) return;
                        console.debug("[ChumashTrace] hover", {
                          pasukId: pasuk.id,
                          pasukNum: pasuk.pasuk_num,
                          hasContent,
                          isSelected,
                        });
                      }}
                      onClick={() => {
                        if (shouldTraceChumash()) {
                          console.debug("[ChumashTrace] click", {
                            pasukId: pasuk.id,
                            pasukNum: pasuk.pasuk_num,
                            hasContent,
                            isSelected,
                          });
                        }
                        handlePasukClick(pasuk.id, pasuk);
                      }}
                    >
                      {/* Pasuk number */}
                      <span 
                        data-chumash-role="number"
                        className="font-bold select-none"
                        style={{
                          color: 'hsl(var(--primary))',
                          fontSize: '0.75em',
                          verticalAlign: 'super',
                          lineHeight: 0,
                          marginInlineStart: '0.25em',
                          marginInlineEnd: '0.15em',
                        }}
                      >
                        {toHebrewNumber(pasuk.pasuk_num)}
                      </span>

                      {/* Keep content indicator adjacent to pasuk number so RTL wrapping doesn't visually shift it to next pasuk */}
                      {hasContent && !isSelected && (
                        <span
                          data-chumash-role="content-dot"
                          className="inline-block w-1.5 h-1.5 rounded-full bg-primary/50 dark:bg-primary/60"
                          style={{
                            verticalAlign: 'super',
                            marginInlineStart: '0.05em',
                            marginInlineEnd: '0.3em',
                          }}
                        />
                      )}
                      
                      {/* Pasuk text with highlights support */}
                      <TextHighlighter
                        text={pasuk.text}
                        pasukId={pasukIdStr}
                      />
                      
                      {/* Space between pesukim */}
                      {index < group.pesukim.length - 1 && " "}
                    </span>
                  );
                })}
              </p>
            </div>
          ))}
      </div>

      {pesukim.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          אין פסוקים להצגה
        </div>
      )}
    </div>
  );
};

// Memoized export for performance
export const ChumashView = memo(ChumashViewComponent);
