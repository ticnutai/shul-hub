import { describe, expect, it } from "vitest";
import { heldOn, selichotDay } from "./minyan-time";

// תשפ״ז: ראש חודש אלול 2026-08-14 (שישי) · ראש השנה 2026-09-12/13 · יום כיפור 2026-09-21.
describe("סליחות only in their days", () => {
  it("from ראש חודש אלול to ערב יום כיפור, on weekdays", () => {
    expect(selichotDay("2026-08-14")).toBe(true); // א׳ אלול
    expect(selichotDay("2026-09-10")).toBe(true); // a Thursday in אלול
    expect(selichotDay("2026-09-16")).toBe(true); // between ראש השנה and יום כיפור
    expect(selichotDay("2026-09-20")).toBe(true); // ערב יום כיפור
  });

  it("never on Shabbat, nor on ראש השנה or יום כיפור, nor all year round", () => {
    expect(selichotDay("2026-08-15")).toBe(false); // שבת in אלול
    expect(selichotDay("2026-09-12")).toBe(false); // ראש השנה
    expect(selichotDay("2026-09-13")).toBe(false); // ראש השנה
    expect(selichotDay("2026-09-21")).toBe(false); // יום כיפור
    expect(selichotDay("2026-11-02")).toBe(false); // חשון
    expect(selichotDay("2026-11-07")).toBe(false); // שבת in חשון
  });

  it("a minyan of סליחות is held in its days only; other minyanim as before", () => {
    const noon = (d: string) => new Date(`${d}T10:00:00Z`);
    expect(heldOn({ label: "סליחות א׳" }, noon("2026-11-07"))).toBe(false);
    expect(heldOn({ label: "סליחות א׳" }, noon("2026-08-17"))).toBe(true);
    expect(heldOn({ label: "סליחות", active_from: "2026-09-06" }, noon("2026-08-17"))).toBe(false);
    expect(heldOn({ label: "שחרית א׳" }, noon("2026-11-07"))).toBe(true);
  });
});
