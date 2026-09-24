import { describe, expect, it } from "vitest";
import haftarot from "@/data/haftarot.json";
import {
  aliyahStartMarkers,
  getParshaAliyot,
  getParshaHaftarah,
  getUpcomingShabbatReading,
  hebcalParshaName,
  inSpan,
} from "./aliyot";

const at = (perek: number, pasuk: number) => ({ perek, pasuk });

describe("aliyot", () => {
  it("maps our parsha ids to hebcal names in order", () => {
    expect(hebcalParshaName(1)).toBe("Bereshit");
    expect(hebcalParshaName(21)).toBe("Ki Tisa");
    expect(hebcalParshaName(54)).toBe("Vezot Haberakhah");
    expect(hebcalParshaName(55)).toBeNull();
  });

  it("gives Shabbat seven aliyot plus maftir, named as called in shul", () => {
    const spans = getParshaAliyot(1, "shabbat");
    expect(spans.map((s) => s.label)).toEqual(["כהן", "לוי", "שלישי", "רביעי", "חמישי", "שישי", "שביעי", "מפטיר"]);
    expect(spans[0]).toMatchObject({ begin: at(1, 1), end: at(2, 3), verses: 34 });
    // Maftir repeats the last verses of Shevi'i.
    const shevii = spans[6];
    const maftir = spans[7];
    expect(inSpan(maftir.begin, shevii)).toBe(true);
    expect(maftir.end).toEqual(shevii.end);
  });

  it("shows where sources divide differently", () => {
    const shishi = getParshaAliyot(1, "shabbat")[5];
    expect(shishi.note).toMatch(/^יש מחלקים/);
  });

  it("uses the Monday/Thursday division, not the first three Shabbat aliyot", () => {
    const spans = getParshaAliyot(1, "weekday");
    expect(spans.map((s) => s.label)).toEqual(["כהן", "לוי", "ישראל"]);
    expect(spans[0]).toMatchObject({ begin: at(1, 1), end: at(1, 5) });
    expect(spans[2].end).toEqual(at(1, 13));
  });

  it("keeps every weekday reading to the halachic minimum", () => {
    for (let n = 1; n <= 54; n++) {
      const spans = getParshaAliyot(n, "weekday");
      expect(spans, `parsha ${n}`).toHaveLength(3);
      const total = spans.reduce((sum, s) => sum + s.verses, 0);
      // Ten verses in all, three per oleh (Megillah 21b).
      expect(total, `parsha ${n}`).toBeGreaterThanOrEqual(10);
      spans.forEach((s) => expect(s.verses, `parsha ${n} ${s.label}`).toBeGreaterThanOrEqual(3));
    }
  });

  it("marks where each aliyah starts, maftir included", () => {
    const markers = aliyahStartMarkers(getParshaAliyot(1, "shabbat"));
    expect(markers.get("1:1")?.[0].label).toBe("כהן");
    expect(markers.get("6:5")?.map((s) => s.label)).toEqual(["מפטיר"]);
  });

  it("picks the haftarah by minhag", () => {
    const ashk = getParshaHaftarah(1, "ashkenazi");
    const seph = getParshaHaftarah(1, "sephardi");
    expect(ashk[0]).toMatchObject({ bookHe: "ישעיהו", begin: at(42, 5), end: at(43, 10) });
    expect(seph[0].end).toEqual(at(42, 21));
  });

  it("has the text of every parsha haftarah, every minhag", () => {
    const texts = (haftarot as unknown as { texts: Record<string, unknown[]> }).texts;
    for (let n = 1; n <= 54; n++) {
      for (const m of ["ashkenazi", "sephardi", "chabad"] as const) {
        for (const r of getParshaHaftarah(n, m)) {
          expect(texts[r.textKey], `parsha ${n} ${m} ${r.textKey}`).toBeTruthy();
        }
      }
    }
  });

  it("knows a special Shabbat changes the haftarah", () => {
    // Shabbat Machar Chodesh, Bereshit 5787.
    const r = getUpcomingShabbatReading(true, new Date(2026, 9, 10));
    expect(r?.parshaNums).toEqual([1]);
    expect(r?.specialHaftarah?.label).toBe("שבת מחר חודש");
    expect(r?.specialHaftarah?.ranges.ashkenazi[0]).toMatchObject({ bookHe: "שמואל א", begin: at(20, 18) });
  });

  it("knows a doubled parsha and a special maftir", () => {
    // Vayakhel-Pekudei with Shabbat HaChodesh, 5786.
    const r = getUpcomingShabbatReading(true, new Date(2026, 2, 14));
    expect(r?.parshaNums).toEqual([22, 23]);
    expect(r?.specialMaftir).toMatchObject({ label: "פרשת החודש", bookHe: "שמות", begin: at(12, 1) });
  });
});
