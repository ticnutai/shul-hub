import { describe, expect, it, vi } from "vitest";

// data.ts builds the shared Supabase client at import time; prayerLabel is pure
// and needs none of it.
vi.mock("@community/integrations/supabase/client", () => ({ supabase: {} }));

const { prayerLabel } = await import("./data");

describe("prayerLabel", () => {
  const fridaySubcategories = [
    { id: "shacharit", label: "שחרית" },
    { id: "mincha", label: "מנחה" },
  ];

  it("uses the category's own label when the category defines the prayer", () => {
    expect(prayerLabel(fridaySubcategories, "shacharit")).toBe("שחרית");
  });

  it("prefers a renamed label from the category over the built-in one", () => {
    expect(prayerLabel([{ id: "shacharit", label: "שחרית ותיקין" }], "shacharit")).toBe(
      "שחרית ותיקין",
    );
  });

  // The regression: a סליחות minyan stored as `other` under a category that
  // does not list `other` rendered the raw id "other" on the public page.
  it("falls back to the built-in Hebrew label when the category omits the prayer", () => {
    expect(prayerLabel(fridaySubcategories, "other")).toBe("אחר");
    expect(prayerLabel([], "arvit")).toBe("ערבית");
  });

  it("returns the raw id only for a prayer nobody knows", () => {
    expect(prayerLabel([], "musaf_custom")).toBe("musaf_custom");
  });
});
