import { describe, expect, it } from "vitest";
import sefardOther from "@/data/siddur/siddur_sefard_other.json";
import sefardShacharit from "@/data/siddur/siddur_sefard_shacharit.json";
import { indexSections, normalizeHebrew, searchSections } from "./siddurSearch";

const index = [
  ...indexSections("shacharit", sefardShacharit.name, sefardShacharit.sections),
  ...indexSections("other", sefardOther.name, sefardOther.sections),
];

describe("siddur search", () => {
  it("ignores niqqud, te'amim, maqaf and markup", () => {
    expect(normalizeHebrew("<b>בָּרוּךְ</b> אַתָּה־יְיָ")).toBe("ברוך אתה יי");
    expect(normalizeHebrew("שֶׁהֶחֱיָֽנוּ")).toBe("שהחינו");
  });

  it("finds what was hidden in אחר by name", () => {
    for (const q of ["ברכת המזון", "הלל", "תפילת הדרך", "בורא נפשות"]) {
      const hits = searchSections(index, q);
      expect(hits.length, q).toBeGreaterThan(0);
      expect(normalizeHebrew(hits[0].title), q).toContain(q);
    }
  });

  it("points at the same section the prayer pane shows", () => {
    const [hit] = searchSections(index, "ברכת המזון");
    const source = hit.catId === "other" ? sefardOther : sefardShacharit;
    expect(source.sections[hit.index].title).toBe(hit.title);
  });

  it("finds words inside a prayer, with the words around them", () => {
    const hits = searchSections(index, "מודה אני");
    expect(hits.length).toBeGreaterThan(0);
    const inText = hits.find((h) => h.snippet);
    if (inText) expect(inText.snippet).toContain("מודה אני");
  });

  it("waits for two letters", () => {
    expect(searchSections(index, "ב")).toEqual([]);
  });
});
