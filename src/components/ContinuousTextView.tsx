import { FlatPasuk } from "@/types/torah";
import { Card } from "@/components/ui/card";
import { toHebrewNumber } from "@/utils/hebrewNumbers";
import { formatTorahText } from "@/utils/textUtils";
import { useTextDisplayStyles } from "@/hooks/useTextDisplayStyles";
import { useFontAndColorSettings } from "@/contexts/FontAndColorSettingsContext";
import { useDevice } from "@/contexts/DeviceContext";

interface ContinuousTextViewProps {
  pesukim: FlatPasuk[];
}

export const ContinuousTextView = ({ pesukim }: ContinuousTextViewProps) => {
  const displayStyles = useTextDisplayStyles();
  const { settings } = useFontAndColorSettings();
  const { isMobile } = useDevice();

  if (pesukim.length === 0) {
    return (
      <Card className="p-12 text-center animate-fade-in">
        <p className="text-lg text-muted-foreground">אין פסוקים להצגה</p>
      </Card>
    );
  }

  // Group pesukim by perek
  const perekGroups: { perek: number; pesukim: FlatPasuk[] }[] = [];
  for (const pasuk of pesukim) {
    const last = perekGroups[perekGroups.length - 1];
    if (last && last.perek === pasuk.perek) {
      last.pesukim.push(pasuk);
    } else {
      perekGroups.push({ perek: pasuk.perek, pesukim: [pasuk] });
    }
  }

  // On mobile, cap the effective font size to avoid huge text
  const baseFontSize = settings.pasukSize || 18;
  const scale = displayStyles.fontScale;
  const effectiveSize = isMobile 
    ? Math.min(baseFontSize * scale, 24) 
    : baseFontSize * scale;

  const getPasukMarker = (pasukNum: number) => toHebrewNumber(pasukNum).replace(/[׳״]/g, "");

  return (
    <Card
      className="overflow-hidden w-full animate-fade-in border-r-4 border-r-primary/30 shadow-md"
      style={{
        maxWidth: displayStyles.maxWidth,
        margin: displayStyles.margin,
      }}
    >
      <div
        className="p-3 sm:p-6 md:p-8"
        dir="rtl"
        style={{
          fontFamily: settings.pasukFont || "'Frank Ruhl Libre'",
          fontSize: `${effectiveSize}px`,
          color: settings.pasukColor,
          fontWeight: settings.pasukBold ? "bold" : "normal",
          lineHeight: displayStyles.lineHeight,
          letterSpacing: displayStyles.letterSpacing,
          wordSpacing: displayStyles.wordSpacing,
          textAlign: displayStyles.textAlign,
        }}
      >
        {perekGroups.map((group) => (
          <div key={group.perek} className="mb-4 last:mb-0">
            {/* Perek header */}
            <div className="text-center mb-3">
              <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
                פרק {toHebrewNumber(group.perek)}
              </span>
            </div>

            {/* Continuous flowing text */}
            <p style={{ textAlignLast: "right" }}>
              {group.pesukim.map((pasuk, i) => (
                <span key={pasuk.id}>
                  <span className="text-primary font-bold select-none mx-1 inline-flex items-center justify-center rounded-full min-w-[1.45em] px-1.5 bg-primary/10 border border-primary/25 leading-none">
                    {getPasukMarker(pasuk.pasuk_num)}
                  </span>
                  {formatTorahText(pasuk.text)}
                  {i < group.pesukim.length - 1 ? " " : ""}
                </span>
              ))}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
};
