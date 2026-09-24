// Builds src/data/haftarot.json — the text of every haftarah the app can show.
//
// Which verses make up each haftarah is decided by @hebcal/leyning (the same
// library the app uses at runtime), so this file only holds text, never the
// division. Text: Sefaria, "Miqra according to the Masorah" (CC-BY-SA).
//
// Run: node scripts/fetch-haftarot.mjs
import { writeFileSync } from "node:fs";
import { HDate, HebrewCalendar, parshiot } from "@hebcal/core";
import { getLeyningForParsha, getLeyningOnDate, lookupParsha } from "@hebcal/leyning";

const OUT = new URL("../src/data/haftarot.json", import.meta.url);

const asList = (h) => (h ? (Array.isArray(h) ? h : [h]) : []);
const keyOf = (a) => `${a.k}|${a.b}|${a.e}`;

const refs = new Map();
const add = (h) => asList(h).forEach((a) => refs.set(keyOf(a), a));

// 1. Every parsha, single and doubled, in all three minhagim.
const doubled = ["Vayakhel-Pekudei", "Tazria-Metzora", "Achrei Mot-Kedoshim", "Behar-Bechukotai", "Chukat-Balak", "Matot-Masei", "Nitzavim-Vayeilech"];
for (const name of [...parshiot, ...doubled]) {
  const meta = lookupParsha(name);
  add(meta.haft); add(meta.seph); add(meta.chabad);
  add(getLeyningForParsha(name).haft);
}

// 2. Every Shabbat whose haftarah is replaced (Shekalim, Zachor, Rosh Chodesh,
//    Machar Chodesh, Shabbat Shuva, the three of affliction and seven of comfort…).
//    Eight years covers every combination the calendar produces.
for (const il of [true, false]) {
  let d = new HDate(new Date(2025, 0, 4));
  const end = new HDate(new Date(2033, 0, 1));
  for (; d.deltaDays(end) < 0; d = d.add(7)) {
    for (const l of [getLeyningOnDate(d, il, false)].flat()) {
      if (!l) continue;
      add(l.haft); add(l.seph); add(l.chabad);
    }
  }
}

const clean = (s) =>
  s
    .replace(/&thinsp;/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\{[פס]\}/g, "")
    .replace(/\s+/g, " ")
    .trim();

async function fetchRange(a) {
  const ref = `${a.k.replace(/ /g, "_")}.${a.b.replace(":", ".")}-${a.e.replace(":", ".")}`;
  const url = `https://www.sefaria.org/api/v3/texts/${encodeURIComponent(ref)}?version=hebrew&return_format=text_only`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url);
    if (res.ok) {
      const j = await res.json();
      const v = j.versions?.[0];
      if (!v) throw new Error(`no hebrew version: ${ref}`);
      const [bp, bv] = a.b.split(":").map(Number);
      // A single verse comes back as a string, one chapter as a flat array.
      const chapters = typeof v.text === "string" ? [[v.text]] : Array.isArray(v.text[0]) ? v.text : [v.text];
      const out = [];
      chapters.forEach((verses, ci) => {
        verses.forEach((t, vi) => out.push([bp + ci, (ci === 0 ? bv : 1) + vi, clean(t)]));
      });
      return { title: v.versionTitle, verses: out };
    }
    if (attempt >= 4) throw new Error(`${res.status} ${ref}`);
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
}

const texts = {};
let title = "";
const list = [...refs.values()];
for (const [i, a] of list.entries()) {
  const r = await fetchRange(a);
  title = r.title;
  texts[keyOf(a)] = r.verses;
  const expected = a.v ?? r.verses.length;
  if (r.verses.length !== expected) console.warn(`! ${keyOf(a)}: ${r.verses.length} verses, hebcal says ${expected}`);
  process.stdout.write(`\r${i + 1}/${list.length}`);
}

writeFileSync(
  OUT,
  JSON.stringify({
    source: `Sefaria — ${title}`,
    license: "CC-BY-SA",
    texts,
  }),
);
console.log(`\nwrote ${list.length} ranges`);
