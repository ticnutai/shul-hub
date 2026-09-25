import { describe, expect, it } from "vitest";
import { torahReadingOn } from "./torahReading";

/** Dates of 5787, read in Israel. Noon UTC is the same civil day there. */
const on = (iso: string) => torahReadingOn(new Date(`${iso}T09:00:00Z`));

describe("the Torah reading on the board", () => {
  it("Sukkot on Shabbat: the festival's portion, the maftir from the second scroll, Zechariah", () => {
    expect(on("2026-09-26")).toEqual({
      parasha: undefined,
      reading: "ויקרא כ״ב כ״ו – כ״ג מ״ד",
      maftir: "במדבר כ״ט י״ב – ט״ז",
      haftarah: "זכריה י״ד א׳ – כ״א",
    });
  });

  it("Simchat Torah reads the end of the Torah and its beginning", () => {
    expect(on("2026-10-03")?.reading).toBe("דברים ל״ג א׳ – ל״ד י״ב · בראשית א׳ א׳ – ב׳ ג׳");
  });

  it("an ordinary Shabbat names its parasha", () => {
    const r = on("2026-10-10");
    expect(r?.parasha).toBe("פרשת בראשית");
    expect(r?.reading).toBe("בראשית א׳ א׳ – ו׳ ח׳");
  });

  it("a day with no reading has none", () => {
    // Wednesday 14 October 2026, an ordinary weekday.
    expect(on("2026-10-14")).toBeNull();
  });
});
