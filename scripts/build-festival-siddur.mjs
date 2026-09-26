#!/usr/bin/env node
/**
 * The festival parts the siddur data is missing, from Sefaria (public domain
 * public domain or CC-BY editions, credited in the file), into src/data/siddur/festival_{family}.json.
 *
 *   ashkenaz  Siddur Ashkenaz (Daat): Hallel, Musaf for Rosh Chodesh and the
 *             festivals, the festival Amidah, lulav, the Hoshanot of each day,
 *             Hoshana Rabba, Tal and Geshem, taking out and returning the
 *             Torah, Chanukah candles.
 *   sefard    Siddur Sefard (Torat Emet 357): the Hoshanot of each day (the
 *             rest is in our own data already).
 *
 * Every piece is { key, title, lines }. The Hoshanot are also split into
 * their piyutim, keyed by the opening words, because which one is said on a
 * day depends on the day Sukkot began (lib/siddurService.ts has the table).
 *
 * Run: node scripts/build-festival-siddur.mjs
 */
import { writeFileSync } from "node:fs";

const API = "https://www.sefaria.org/api/v3/texts/";
const LICENSES = new Set();

async function text(ref) {
  const url = API + encodeURIComponent(ref.replace(/ /g, "_")).replace(/%2C/g, ",") + "?version=hebrew";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${ref}: ${res.status}`);
  const j = await res.json();
  const v = j.versions?.[0];
  if (!v) throw new Error(`${ref}: no Hebrew version`);
  // Free to reuse: public domain, CC0, or CC-BY / CC-BY-SA with attribution (kept in the file).
  if (!/public domain|cc0|cc-by/i.test(v.license ?? "")) throw new Error(`${ref}: license ${v.license}`);
  LICENSES.add(`${v.versionTitle} (${v.license})`);
  const flat = (t) => (Array.isArray(t) ? t.flatMap(flat) : [t]);
  return flat(v.text)
    .map((l) => String(l).replace(/<br\s*\/?>/g, " ").trim())
    // Some editions wrap the prayer itself in <small>, which the siddur shows
    // as an instruction (grey). Text with niqqud is prayer: unwrap it.
    .map((l) => (/[ְ-ּ]/.test(l) ? l.replace(/<\/?small>/g, "").replace(/<\/?big>/g, "") : l))
    .filter((l) => l.length > 0);
}

async function joined(prefix, leaves) {
  const out = [];
  for (const leaf of leaves) out.push(...(await text(`${prefix}, ${leaf}`)));
  return out;
}

const plain = (s) => s.replace(/<[^>]+>/g, "").replace(/[֑-ׇ]/g, "").replace(/[^א-ת ]/g, " ").replace(/\s+/g, " ").trim();

/** The piyut keys, by their first words (without niqqud). */
const PIYUTIM = [
  ["lemaan_amitach", /^למען אמתך/],
  ["even_shetiya", /^אבן שתיה/],
  ["eerokh_shui", /^אערו?ך שועי/],
  ["om_ani_choma", /^או?ם אני חומה/],
  ["el_lemoshaot", /^אל למושעות/],
  ["adon_hamoshia", /^אדון המושיע/],
  ["om_netzura", /^או?ם נצורה/],
];
const piyutOf = (line) => PIYUTIM.find(([, re]) => re.test(plain(line)))?.[0];

/**
 * A day's Hoshanot page into its opening, its piyutim, and its closing.
 * A piyut runs from its first line to the next heading, piyut or closing.
 */
function splitHoshanot(lines) {
  const opening = [];
  const closing = [];
  const piyutim = {};
  let current = null;
  let inClosing = false;
  let closed = false; // the closing is taken once, from after the first piyut
  for (const line of lines) {
    const p = plain(line);
    const key = piyutOf(line);
    if (key) {
      if (closing.length) closed = true;
      current = key;
      piyutim[key] = piyutim[key] ?? [];
      piyutim[key].push(line);
      inClosing = false;
      continue;
    }
    if (/^אני והו/.test(p) || /^כהושעת/.test(p) || /^הושיעה את עמך/.test(p)) {
      current = null;
      inClosing = true;
      if (!closed) closing.push(line);
      continue;
    }
    // Headings between piyutim ("כשחל ביום א'", "ליו"ט ראשון..."), and the list of what follows.
    if (/^(כשחל|ליו|ליום|לאחר|קדיש)/.test(p) || /דחוה"?מ/.test(line)) {
      current = null;
      continue;
    }
    if (current) piyutim[current].push(line);
    else if (!inClosing && !Object.keys(piyutim).length && !/^הושענות/.test(p)) opening.push(line);
  }
  return { opening, closing, piyutim };
}

async function hoshanot(prefix, pages) {
  const merged = { opening: [], closing: [], piyutim: {} };
  for (const page of pages) {
    const part = splitHoshanot(await text(`${prefix}, ${page}`));
    if (!merged.opening.length) merged.opening = part.opening;
    if (!merged.closing.length) merged.closing = part.closing;
    for (const [k, v] of Object.entries(part.piyutim)) merged.piyutim[k] ??= v;
  }
  return merged;
}

const A = "Siddur Ashkenaz";
const ashkenaz = {
  source: "Sefaria, Siddur Ashkenaz (Daat), Public Domain",
  pieces: {
    hallel: {
      title: "הלל",
      lines: await joined(`${A}, Festivals, Rosh Chodesh, Hallel`, [
        "Berakhah before the Hallel", "Psalm 113", "Psalm 114", "Psalm 115", "Psalm 116", "Psalm 117", "Psalm 118",
        "Berakhah after the Hallel",
      ]),
    },
    musaf_rc: {
      title: "מוסף לראש חודש",
      lines: await joined(`${A}, Festivals, Rosh Chodesh, Musaf Amidah for Rosh Chodesh`, [
        "Avot", "Gevurot", "Kedushah, Kedushat HaShem", "Sanctity of the Day", "Avodah", "Hodayah", "Birkat Kohanim",
        "Peace", "Passages Ending Amidah",
      ]),
    },
    musaf_regalim: {
      title: "מוסף לשלוש רגלים",
      lines: await joined(`${A}, Festivals, Shalosh Regalim, Mussaf`, [
        "Avot", "Gevurot", "Kedusha", "Sanctity of the Name", "Sanctity of the Day", "Avodah", "Modim",
        "Birkat Kohanim", "Peace", "Concluding Prayer",
      ]),
    },
    amidah_regalim: {
      title: "עמידה לשלוש רגלים",
      lines: await joined(`${A}, Festivals, Shalosh Regalim, Amida for Maariv, Shacharit, Mincha`, [
        "Avot", "Gevurot", "Kedusha", "Sanctity of the Day", "Avodah", "Modim", "Birkat Kohanim", "Peace",
        "Concluding Prayer",
      ]),
    },
    lulav: { title: "נטילת לולב", lines: await text(`${A}, Festivals, Sukkot, Blessing on Lulav`) },
    hoshana_rabba: { title: "הושענות להושענא רבה", lines: await text(`${A}, Festivals, Sukkot, Hosha'anot, Hosha'ana Rabba`) },
    tal: { title: "תפילת טל", lines: await text(`${A}, Festivals, Prayer for Dew`) },
    geshem: { title: "תפילת גשם", lines: await text(`${A}, Festivals, Prayer for Rain`) },
    torah_out: {
      title: "הוצאת ספר תורה",
      lines: await joined(`${A}, Weekday, Shacharit, Torah Reading, Removing the Torah from Ark`, [
        "El Erech Appayim", "Vayehi Binsoa", "Berich Shmei", "Lekha Hashem", "Av Harachamim", "Vetigaleh Veteraeh",
      ]).then(async (l) => [...l, ...(await text(`${A}, Weekday, Shacharit, Torah Reading, Reading from Sefer, Birkat HaTorah`))]),
    },
    torah_in: {
      title: "הגבהה והכנסת ספר תורה",
      lines: [
        ...(await text(`${A}, Weekday, Shacharit, Torah Reading, Reading from Sefer, Raising the Torah`)),
        ...(await joined(`${A}, Weekday, Shacharit, Torah Reading, Returning Sefer to Aron`, ["Yehalelu", "LeDavid Mizmor", "Uvenucho Yomar"])),
      ],
    },
    chanukah: {
      title: "הדלקת נרות חנוכה",
      lines: await joined(`${A}, Festivals, Chanukah, Service for Lighting Chanukah Candles`, [
        "Blessings on Chanukah Candles", "Hanerot Hallalu", "Maoz Tzur",
      ]),
    },
  },
  hoshanot: await hoshanot(`${A}, Festivals, Sukkot, Hosha'anot`, [
    "First Day of Sukkot", "Second Day of Sukkot", "Third Day of Sukkot", "Fourth Day of Sukkot", "Fifth Day of Sukkot",
    "Sixth Day of Sukkot", "For Shabbat Chol Hamoed",
  ]),
};

const ashkenazLicenses = [...LICENSES];
LICENSES.clear();
const sefard = {
  source: "Sefaria, Siddur Sefard (Torat Emet 357), Public Domain",
  pieces: {},
  hoshanot: await hoshanot("Siddur Sefard, Sukkot", ["First Day & Chol HaMoed", "Sabbath"]),
};

const licenses = { ashkenaz: ashkenazLicenses, sefard: [...LICENSES] };
for (const [name, data] of Object.entries({ ashkenaz, sefard })) {
  const missing = PIYUTIM.map(([k]) => k).filter((k) => !data.hoshanot.piyutim[k]);
  if (missing.length) throw new Error(`${name}: hoshanot missing ${missing}`);
  const file = new URL(`../src/data/siddur/festival_${name}.json`, import.meta.url);
  writeFileSync(file, JSON.stringify({ ...data, source: `Sefaria: ${licenses[name].join("; ")}` }));
  const counts = Object.fromEntries(Object.entries(data.pieces).map(([k, v]) => [k, v.lines.length]));
  console.log(name, counts, "hoshanot:", Object.fromEntries(Object.entries(data.hoshanot.piyutim).map(([k, v]) => [k, v.length])), "opening", data.hoshanot.opening.length, "closing", data.hoshanot.closing.length);
}
