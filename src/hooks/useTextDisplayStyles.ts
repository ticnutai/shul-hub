import { useMemo } from "react";
import { useFontAndColorSettings } from "@/contexts/FontAndColorSettingsContext";
import { useDevice } from "@/contexts/DeviceContext";

export type TextStyleTarget = "pasuk" | "title" | "question" | "commentary" | "siddur" | "tehillim";

export const useTextDisplayStyles = (target: TextStyleTarget = "pasuk") => {
  const { settings } = useFontAndColorSettings();
  const { isMobile } = useDevice();

  return useMemo(() => {
    // Get font scale (default 1)
    const fontScale = settings.fontScale || 1;

    // Per-tab values for alignment / letter spacing / word spacing
    const ta = (target === "title" ? settings.titleTextAlignment
              : target === "question" ? settings.questionTextAlignment
              : target === "commentary" ? settings.commentaryTextAlignment
              : target === "siddur" ? settings.siddurTextAlignment
              : target === "tehillim" ? settings.tehillimTextAlignment
              : settings.pasukTextAlignment) || settings.textAlignment;

    const lsKey = (target === "title" ? settings.titleLetterSpacing
                : target === "question" ? settings.questionLetterSpacing
                : target === "commentary" ? settings.commentaryLetterSpacing
                : target === "siddur" ? settings.siddurLetterSpacing
                : target === "tehillim" ? settings.tehillimLetterSpacing
                : settings.pasukLetterSpacing) || settings.letterSpacing;
    const lsCustom = (target === "title" ? settings.titleLetterSpacingCustom
                : target === "question" ? settings.questionLetterSpacingCustom
                : target === "commentary" ? settings.commentaryLetterSpacingCustom
                : target === "siddur" ? settings.siddurLetterSpacingCustom
                : target === "tehillim" ? settings.tehillimLetterSpacingCustom
                : settings.pasukLetterSpacingCustom) ?? settings.letterSpacingCustom ?? 0;
    const ws = (target === "title" ? settings.titleWordSpacing
              : target === "question" ? settings.questionWordSpacing
              : target === "commentary" ? settings.commentaryWordSpacing
              : target === "siddur" ? settings.siddurWordSpacing
              : target === "tehillim" ? settings.tehillimWordSpacing
              : settings.pasukWordSpacing) ?? settings.wordSpacing ?? 0;

    // Per-tab line height / content spacing / content width (fallback to global)
    const lhKey = (target === "title" ? settings.titleLineHeight
                : target === "question" ? settings.questionLineHeight
                : target === "commentary" ? settings.commentaryLineHeight
                : target === "siddur" ? settings.siddurLineHeight
                : target === "tehillim" ? settings.tehillimLineHeight
                : settings.pasukLineHeight) || settings.lineHeight;
    const lhCustom = (target === "title" ? settings.titleLineHeightCustom
                : target === "question" ? settings.questionLineHeightCustom
                : target === "commentary" ? settings.commentaryLineHeightCustom
                : target === "siddur" ? settings.siddurLineHeightCustom
                : target === "tehillim" ? settings.tehillimLineHeightCustom
                : settings.pasukLineHeightCustom) ?? settings.lineHeightCustom ?? 1.5;

    const csKey = (target === "title" ? settings.titleContentSpacing
                : target === "question" ? settings.questionContentSpacing
                : target === "commentary" ? settings.commentaryContentSpacing
                : target === "siddur" ? settings.siddurContentSpacing
                : target === "tehillim" ? settings.tehillimContentSpacing
                : settings.pasukContentSpacing) || settings.contentSpacing;
    const csCustom = (target === "title" ? settings.titleContentSpacingCustom
                : target === "question" ? settings.questionContentSpacingCustom
                : target === "commentary" ? settings.commentaryContentSpacingCustom
                : target === "siddur" ? settings.siddurContentSpacingCustom
                : target === "tehillim" ? settings.tehillimContentSpacingCustom
                : settings.pasukContentSpacingCustom) ?? settings.contentSpacingCustom ?? 1;

    const cw = (target === "title" ? settings.titleContentWidth
              : target === "question" ? settings.questionContentWidth
              : target === "commentary" ? settings.commentaryContentWidth
              : target === "siddur" ? settings.siddurContentWidth
              : target === "tehillim" ? settings.tehillimContentWidth
              : settings.pasukContentWidth) || settings.contentWidth;

    // Spacing values - responsive (supports custom)
    const spacingMap: Record<string, string> = {
      compact: isMobile ? "0.25rem" : "0.5rem",
      normal: isMobile ? "0.5rem" : "1rem",
      comfortable: isMobile ? "0.75rem" : "1.5rem",
      spacious: isMobile ? "1rem" : "2rem",
    };
    const gap = csKey === "custom"
      ? `${csCustom}rem`
      : spacingMap[csKey] || spacingMap.normal;

    // Line height values (supports custom)
    const lineHeightMap: Record<string, string> = {
      tight: "1.3",
      normal: "1.5",
      relaxed: "1.7",
      loose: "2.0",
    };
    const lineHeight = lhKey === "custom"
      ? String(lhCustom)
      : lineHeightMap[lhKey] || lineHeightMap.normal;

    // Letter spacing values (supports custom)
    const letterSpacingMap: Record<string, string> = {
      tight: "-0.02em",
      normal: "0em",
      wide: "0.05em",
      wider: "0.1em",
    };
    const letterSpacing = lsKey === "custom"
      ? `${lsCustom}em`
      : letterSpacingMap[lsKey] || letterSpacingMap.normal;

    // Content width values - responsive with max constraints
    const getMaxWidth = () => {
      if (isMobile) {
        // On mobile the "width" setting narrows the reading column
        switch (cw) {
          case "narrow": return "78%";
          case "normal": return "90%";
          case "wide": return "97%";
          case "full": return "100%";
          default: return "100%";
        }
      }

      switch (cw) {
        case "narrow": return "min(600px, 95vw)";
        case "normal": return "min(800px, 95vw)";
        case "wide": return "min(1000px, 95vw)";
        case "full": return "100%";
        default: return "min(800px, 95vw)";
      }
    };

    // Alignment values
    const alignmentMap = {
      right: "right",
      center: "center",
      left: "left",
      justify: "justify",
    };

    // Padding for mobile
    const padding = isMobile ? "0.5rem" : "1rem";

    return {
      textAlign: alignmentMap[ta] as "right" | "center" | "left" | "justify",
      gap,
      lineHeight,
      letterSpacing,
      wordSpacing: `${ws}em`,
      maxWidth: getMaxWidth(),
      margin: "0 auto",
      padding,
      fontScale,
      isMobile,
    };
  }, [settings, target, isMobile]);
};
