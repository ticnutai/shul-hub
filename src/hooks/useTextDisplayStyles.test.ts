import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock device context (non-mobile for predictable values)
vi.mock("@/contexts/DeviceContext", () => ({
  useDevice: () => ({ isMobile: false, isTablet: false, isDesktop: true, deviceType: "desktop" }),
}));

// Settings shape used by the hook — provide distinct values per target so we
// can verify the hook reads from the correct per-tab field.
const mockSettings = {
  // Globals (should NOT be returned when per-tab values exist)
  textAlignment: "right",
  letterSpacing: "normal",
  letterSpacingCustom: 0,
  wordSpacing: 0,
  contentSpacing: "normal",
  contentSpacingCustom: 1,
  lineHeight: "normal",
  lineHeightCustom: 1.5,
  contentWidth: "normal",
  fontScale: 1,

  // Per-tab
  pasukTextAlignment: "justify",
  pasukLetterSpacing: "custom",
  pasukLetterSpacingCustom: 0.11,
  pasukWordSpacing: 0.21,

  titleTextAlignment: "center",
  titleLetterSpacing: "wide",
  titleLetterSpacingCustom: 0,
  titleWordSpacing: 0.12,

  questionTextAlignment: "left",
  questionLetterSpacing: "tight",
  questionLetterSpacingCustom: 0,
  questionWordSpacing: 0.13,

  commentaryTextAlignment: "right",
  commentaryLetterSpacing: "wider",
  commentaryLetterSpacingCustom: 0,
  commentaryWordSpacing: 0.14,

  siddurTextAlignment: "center",
  siddurLetterSpacing: "custom",
  siddurLetterSpacingCustom: 0.05,
  siddurWordSpacing: 0.15,

  tehillimTextAlignment: "left",
  tehillimLetterSpacing: "normal",
  tehillimLetterSpacingCustom: 0,
  tehillimWordSpacing: 0.16,
};

vi.mock("@/contexts/FontAndColorSettingsContext", () => ({
  useFontAndColorSettings: () => ({ settings: mockSettings }),
}));

import { useTextDisplayStyles } from "./useTextDisplayStyles";

describe("useTextDisplayStyles per-target values", () => {
  it("defaults to pasuk target", () => {
    const { result } = renderHook(() => useTextDisplayStyles());
    expect(result.current.textAlign).toBe("justify");
    expect(result.current.letterSpacing).toBe("0.11em");
    expect(result.current.wordSpacing).toBe("0.21em");
  });

  it("returns title values for target=title", () => {
    const { result } = renderHook(() => useTextDisplayStyles("title"));
    expect(result.current.textAlign).toBe("center");
    expect(result.current.letterSpacing).toBe("0.05em"); // wide preset
    expect(result.current.wordSpacing).toBe("0.12em");
    expect(result.current.margin).toBe("0 auto"); // center margins
  });

  it("returns question values for target=question", () => {
    const { result } = renderHook(() => useTextDisplayStyles("question"));
    expect(result.current.textAlign).toBe("left");
    expect(result.current.letterSpacing).toBe("-0.02em"); // tight preset
    expect(result.current.wordSpacing).toBe("0.13em");
  });

  it("returns commentary values for target=commentary", () => {
    const { result } = renderHook(() => useTextDisplayStyles("commentary"));
    expect(result.current.textAlign).toBe("right");
    expect(result.current.letterSpacing).toBe("0.1em"); // wider preset
    expect(result.current.wordSpacing).toBe("0.14em");
  });

  it("returns siddur values for target=siddur", () => {
    const { result } = renderHook(() => useTextDisplayStyles("siddur"));
    expect(result.current.textAlign).toBe("center");
    expect(result.current.letterSpacing).toBe("0.05em"); // custom
    expect(result.current.wordSpacing).toBe("0.15em");
  });

  it("returns tehillim values for target=tehillim", () => {
    const { result } = renderHook(() => useTextDisplayStyles("tehillim"));
    expect(result.current.textAlign).toBe("left");
    expect(result.current.letterSpacing).toBe("0em"); // normal preset
    expect(result.current.wordSpacing).toBe("0.16em");
  });

  it("each target produces independent values (no cross-tab bleed)", () => {
    const pasuk = renderHook(() => useTextDisplayStyles("pasuk")).result.current;
    const title = renderHook(() => useTextDisplayStyles("title")).result.current;
    const question = renderHook(() => useTextDisplayStyles("question")).result.current;
    const commentary = renderHook(() => useTextDisplayStyles("commentary")).result.current;

    const aligns = [pasuk.textAlign, title.textAlign, question.textAlign, commentary.textAlign];
    expect(new Set(aligns).size).toBeGreaterThan(1);

    const wsList = [pasuk.wordSpacing, title.wordSpacing, question.wordSpacing, commentary.wordSpacing];
    expect(new Set(wsList).size).toBe(4);
  });
});

describe("consuming components use useTextDisplayStyles for pasuk styling", () => {
  it("each pasuk-rendering component imports the hook (sanity check)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const files = [
      "src/components/ClickableText.tsx",
      "src/components/CompactPasukView.tsx",
      "src/components/ChumashView.tsx",
      "src/components/ContinuousTextView.tsx",
      "src/components/LuxuryTextView.tsx",
    ];
    for (const f of files) {
      const src = fs.readFileSync(path.resolve(process.cwd(), f), "utf8");
      expect(src, `${f} should import useTextDisplayStyles`).toMatch(/useTextDisplayStyles/);
      expect(src, `${f} should read displayStyles letterSpacing/wordSpacing/textAlign`).toMatch(
        /displayStyles\.(letterSpacing|wordSpacing|textAlign)/,
      );
    }
  });
});