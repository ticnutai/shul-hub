import { describe, expect, it } from "vitest";
import { normalizeTvConfig } from "./config";
import { BUILTIN_VARIANTS, eventSlides } from "./eventSlides";

describe("special-day pictures", () => {
  it("takes turns between the uploaded pictures, or the built-in designs", () => {
    expect(eventSlides(["https://x.test/a.jpg", "https://x.test/b.jpg"])).toEqual([
      { image: "https://x.test/a.jpg" },
      { image: "https://x.test/b.jpg" },
    ]);
    expect(eventSlides(undefined)).toHaveLength(BUILTIN_VARIANTS);
    expect(eventSlides([])).toEqual([{ variant: 0 }, { variant: 1 }, { variant: 2 }]);
  });

  it("keeps up to 8 safe https pictures a day, and reads the old single-picture form", () => {
    const many = Array.from({ length: 12 }, (_, i) => `https://x.test/${i}.jpg`);
    const c = normalizeTvConfig({
      eventImages: {
        chanukah: many,
        yom_kippur: "https://x.test/yk.jpg",
        purim: ["http://x.test/p.jpg", "javascript:alert(1)", "https://x.test/ok.jpg", "https://x.test/ok.jpg"],
        "Bad Key": ["https://x.test/z.jpg"],
        sukkot: [],
      },
    });
    expect(c.eventImages.chanukah).toHaveLength(8);
    expect(c.eventImages.yom_kippur).toEqual(["https://x.test/yk.jpg"]);
    expect(c.eventImages.purim).toEqual(["https://x.test/ok.jpg"]);
    expect(c.eventImages["Bad Key"]).toBeUndefined();
    expect(c.eventImages.sukkot).toBeUndefined();
    expect(c.eventSplash).toBe(true);
    expect(normalizeTvConfig({ eventSplash: false }).eventSplash).toBe(false);
  });
});
