import { HDate } from "@hebcal/core";
import { getLeyningOnDate, type Aliyah } from "@hebcal/leyning";
import { toHebrewNumber } from "@/utils/hebrewNumbers";

/**
 * What is read from the Torah on a day, in the words a gabbai would write on
 * the board: "ויקרא כב כו - כג מד", then the maftir and the haftarah.
 *
 * Nothing is worked out here. The readings are a fixed table - the parasha,
 * the festival's own portion, a special maftir - and @hebcal/leyning carries
 * it, the same library the chumash's aliyot come from.
 */

const BOOK_HE: Record<string, string> = {
  Genesis: "בראשית", Exodus: "שמות", Leviticus: "ויקרא", Numbers: "במדבר", Deuteronomy: "דברים",
  Joshua: "יהושע", Judges: "שופטים", "I Samuel": "שמואל א", "II Samuel": "שמואל ב",
  "I Kings": "מלכים א", "II Kings": "מלכים ב", Isaiah: "ישעיהו", Jeremiah: "ירמיהו",
  Ezekiel: "יחזקאל", Hosea: "הושע", Joel: "יואל", Amos: "עמוס", Obadiah: "עובדיה",
  Jonah: "יונה", Micah: "מיכה", Nachum: "נחום", Habakkuk: "חבקוק", Zephaniah: "צפניה",
  Haggai: "חגי", Zechariah: "זכריה", Malachi: "מלאכי",
};

export interface TorahReading {
  /** "פרשת האזינו" on a Shabbat; absent on a festival, whose name is on the card already. */
  parasha?: string;
  /** The reading itself, e.g. "ויקרא כב כו – כג מד". */
  reading: string;
  /** From the second scroll, when there is one. */
  maftir?: string;
  haftarah?: string;
}

const ref = (s: string) => {
  const [p, v] = s.split(":").map(Number);
  return { p, v };
};

/** "ויקרא כב כו – כג מד", or within one chapter "במדבר כט יב – טז". */
export function rangeHe(book: string, b: string, e: string): string {
  const x = ref(b);
  const y = ref(e);
  const start = `${BOOK_HE[book] ?? book} ${toHebrewNumber(x.p)} ${toHebrewNumber(x.v)}`;
  return y.p === x.p ? `${start} – ${toHebrewNumber(y.v)}` : `${start} – ${toHebrewNumber(y.p)} ${toHebrewNumber(y.v)}`;
}

const asList = (h: Aliyah | Aliyah[] | undefined) => (Array.isArray(h) ? h : h ? [h] : []);

/**
 * The reading of the day's main service, or null on a day with none.
 * `il`: Israel's calendar (one day of Yom Tov, and the parashot that follow it).
 */
export function torahReadingOn(date: Date, il = true): TorahReading | null {
  let found;
  try {
    found = getLeyningOnDate(new HDate(date), il);
  } catch {
    return null;
  }
  const leyning = [found].flat().find((l) => l && "fullkriyah" in l && l.fullkriyah);
  if (!leyning || !("fullkriyah" in leyning) || !leyning.fullkriyah) return null;

  const aliyot = Object.entries(leyning.fullkriyah)
    .filter(([k]) => /^\d+$/.test(k))
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, a]) => a as Aliyah);
  if (!aliyot.length) return null;
  const first = aliyot[0];
  const last = aliyot.filter((a) => a.k === first.k).at(-1)!;
  // Simchat Torah reads the end of דברים and then goes on into בראשית.
  const books: Aliyah[][] = [];
  for (const a of aliyot) {
    const run = books.at(-1);
    if (run && run[0].k === a.k) run.push(a);
    else books.push([a]);
  }
  const reading = books.map((run) => rangeHe(run[0].k, run[0].b, run.at(-1)!.e)).join(" · ");
  const maftir = leyning.fullkriyah.M as Aliyah | undefined;
  const haft = asList("haft" in leyning ? (leyning.haft as Aliyah | Aliyah[]) : undefined)[0];

  const parasha =
    "parsha" in leyning && Array.isArray(leyning.parsha) && leyning.name?.he
      ? `פרשת ${leyning.name.he.replace(/[֑-ׇ]/g, "")}`
      : undefined;

  return {
    parasha,
    reading,
    // Only a maftir read from somewhere else (a second scroll) is worth a line.
    maftir: maftir && (maftir.k !== first.k || ref(maftir.b).p > ref(last.e).p + 5) ? rangeHe(maftir.k, maftir.b, maftir.e) : undefined,
    haftarah: haft ? rangeHe(haft.k, haft.b, haft.e) : undefined,
  };
}
