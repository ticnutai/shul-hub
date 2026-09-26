import { HDate } from "@hebcal/core";
import { getLeyningOnDate, type Aliyah } from "@hebcal/leyning";
import { lazyLoadSefer } from "@/utils/lazyLoadSefer";
import { loadHaftarahTexts } from "@/utils/aliyot";
import { rangeHe } from "@/tv/torahReading";
import { toHebrewNumber } from "@/utils/hebrewNumbers";
import type { Section } from "./siddurService";

/**
 * The day's Torah reading as a section of the siddur: each aliyah with its
 * verses, then the maftir and the haftarah - so the one davening has the
 * text in front of him and does not need to open a chumash.
 *
 * The readings come from @hebcal/leyning (the same table as the rest of the
 * app), the verses from the app's own chumash, the haftarah from the
 * haftarot file the chumash uses.
 */

const SEFER_ID: Record<string, number> = { Genesis: 1, Exodus: 2, Leviticus: 3, Numbers: 4, Deuteronomy: 5 };
const ALIYAH = ["", "כהן", "לוי", "שלישי", "רביעי", "חמישי", "שישי", "שביעי", "שמיני"];

const ref = (s: string) => s.split(":").map(Number) as [number, number];

/** The day's reading (aliyot, maftir, haftarah), or null on a day without one. */
export function readingOn(hd: HDate, il = true) {
  let found;
  try {
    found = getLeyningOnDate(hd, il);
  } catch {
    return null;
  }
  const l = [found].flat().find((x) => x && (("fullkriyah" in x && x.fullkriyah) || ("weekday" in x && x.weekday)));
  if (!l) return null;
  const table = (("fullkriyah" in l && l.fullkriyah) || ("weekday" in l && l.weekday)) as Record<string, Aliyah>;
  const aliyot = Object.entries(table)
    .filter(([k]) => /^\d+$/.test(k))
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([k, a]) => ({ label: ALIYAH[Number(k)] ?? k, aliyah: a }));
  const maftir = table.M;
  const pick = (k: string) => (k in l ? ((l as Record<string, unknown>)[k] as Aliyah | Aliyah[] | undefined) : undefined);
  return {
    name: (l.name?.he ?? "").replace(/[֑-ׇ]/g, ""),
    aliyot,
    maftir: maftir ? { label: "מפטיר", aliyah: maftir } : null,
    haft: { ashkenazi: pick("haft"), sephardi: pick("seph") ?? pick("haft"), chabad: pick("chabad") ?? pick("haft") },
  };
}

// The verse number in bold at the start, which the siddur shows as prayer text
// (a line that opens with <small> is an instruction, and grey).
const verseLine = (_p: number, v: number, text: string) => `<b>(${toHebrewNumber(v)})</b> ${text}`;

async function versesOf(a: Aliyah): Promise<string[]> {
  const id = SEFER_ID[a.k];
  if (!id) return [];
  const sefer = await lazyLoadSefer(id);
  const [bp, bv] = ref(a.b);
  const [ep, ev] = ref(a.e);
  const out: string[] = [];
  for (const parsha of sefer.parshiot) {
    for (const perek of parsha.perakim) {
      if (perek.perek_num < bp || perek.perek_num > ep) continue;
      for (const pasuk of perek.pesukim) {
        const after = perek.perek_num > bp || pasuk.pasuk_num >= bv;
        const before = perek.perek_num < ep || pasuk.pasuk_num <= ev;
        if (after && before) out.push(verseLine(perek.perek_num, pasuk.pasuk_num, pasuk.text));
      }
    }
  }
  return out;
}

export async function readingSection(
  hd: HDate,
  il: boolean,
  minhag: "ashkenazi" | "sephardi" | "chabad",
): Promise<Section | null> {
  const r = readingOn(hd, il);
  if (!r) return null;
  const lines: string[] = [];
  for (const { label, aliyah } of [...r.aliyot, ...(r.maftir ? [r.maftir] : [])]) {
    lines.push(`<b>${label}</b> · ${rangeHe(aliyah.k, aliyah.b, aliyah.e)}`);
    lines.push(...(await versesOf(aliyah)));
  }
  const haft = [r.haft[minhag]].flat().filter(Boolean) as Aliyah[];
  if (haft.length) {
    const texts = await loadHaftarahTexts().catch(() => ({}) as Record<string, [number, number, string][]>);
    for (const h of haft) {
      lines.push(`<b>הפטרה</b> · ${rangeHe(h.k, h.b, h.e)}`);
      const verses = texts[`${h.k}|${h.b}|${h.e}`];
      if (verses) lines.push(...verses.map(([p, v, t]) => verseLine(p, v, t)));
    }
  }
  return { title: r.name ? `קריאת התורה: ${r.name}` : "קריאת התורה להיום", lines };
}
