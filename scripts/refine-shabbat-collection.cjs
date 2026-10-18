// The Shabbat collection (add-shabbat-collection.cjs), made to read from across a synagogue (18.10.2026):
// bigger letters where they were tiny, the day's main times only, the table off the arches, the header and the
// footer readable on a light wall, each container one group, and "הבא בתור" in the kit's own colour.
// Absolute values only - run again, the same result.
const fs = require('node:fs');
const file = 'public/new-shul-catalog.json';
const c = JSON.parse(fs.readFileSync(file, 'utf8'));
const IDS = ['d_shabbatwalnut', 'd_shbwalnut', 'd_shbivory', 'd_shbsapphire', 'd_shbsky', 'd_shbpalace', 'd_shblibrary', 'd_shbjerusalem', 'd_shbmodern'];
// The day's main times - nine, not thirteen, in letters that can be read; candle lighting for Friday.
const MAIN_ZMANIM = ['alot', 'sunrise', 'sof_zman_shma', 'sof_zman_tefila', 'chatzot', 'plag', 'candle', 'sunset', 'tzeit'];
const r1 = (v) => Math.round(v * 10) / 10;
const lum = (hex) => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const darken = (hex, by) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - by)).toString(16).padStart(2, '0')).join('');

for (const id of IDS) {
  const d = c.designs.find((x) => x.id === id);
  if (!d) throw new Error(`חסרה ערכה: ${id}`);
  const els = d.values.elements;
  const by = (end) => els.find((e) => e.id.endsWith(end));
  const pre = els[0].id.split('_')[0];
  // A light wall: the boxes' letters are dark. Its header and footer then dark enough to read, not a pale gold.
  const light = lum(d.colours['--tv-text']) < 0.4;
  const accent = d.colours['--tv-accent'];
  const ink = light ? darken(accent, lum(accent) > 0.25 ? 0.35 : 0.15) : accent;

  for (const k of ['zmanim', 'prayers', 'notices', 'lessons'])
    for (const e of els.filter((x) => x.id.startsWith(`${pre}_${k}_`))) e.group = `${pre}_${k}`;

  const header = ['_title', '_clock', '_date', '_parasha', '_shabbat_greeting'].map(by).filter(Boolean);
  for (const e of header) {
    e.color = ink;
    if (!light) e.shadow = true;
  }
  for (const [end, size] of [['_date', 2.4], ['_parasha', 2.6], ['_shabbat_greeting', 3]]) {
    const e = by(end);
    if (e) e.fontSize = r1(Math.min(size, e.height * 0.78));
  }

  const zmanim = els.find((e) => e.binding === 'zmanim');
  zmanim.zmanKeys = MAIN_ZMANIM;
  zmanim.rowsPerPage = MAIN_ZMANIM.length;
  zmanim.fontSize = r1(Math.min(2.1, (zmanim.height / MAIN_ZMANIM.length) * 0.58));
  const notices = els.find((e) => e.binding === 'announcements');
  notices.fontSize = 1.8;
  notices.scroll = 'pause';
  const lessons = els.find((e) => e.binding === 'lessons');
  // A lesson is two lines (its name, and its rabbi under it in smaller letters): as big as both fit in its row.
  lessons.fontSize = r1(Math.min(1.9, lessons.height / (lessons.rowsPerPage ?? 2) / 2.7));

  // "הבא בתור" in the kit's own colour, soft.
  for (const e of els.filter((x) => ['zmanim', 'prayers', 'lessons'].includes(x.binding))) e.nextMark = { shape: 'fill', color: ink, alpha: 0.3 };

  // The long table: smaller, at the foot between the arches - the times above it in sight.
  const table = by('_table');
  const footer = by('_footer');
  if (table && table.width >= 50) {
    const ratio = table.height / table.width;
    table.width = 44;
    table.height = r1(44 * ratio);
    table.x = 28;
    table.y = r1(96 - table.height);
  }
  // The day's learning and the seasonal additions, in turns, readable - not one long line in tiny letters.
  Object.assign(footer, {
    binding: 'dafYomi', alternates: ['amudYomi', 'seasonal'], alternateSeconds: 12, name: 'לימוד יומי ותוספות בתפילה',
    color: ink, fontSize: 1.8, height: 3.6, y: 96.2, ...(light ? {} : { shadow: true }),
  });

  // Its picture layers, a part each in the catalogue: as they are now.
  for (const e of els.filter((x) => x.kind === 'image')) {
    const p = c.parts.find((x) => x.id === `catalog_${id}_${e.id}`);
    if (p) p.elements = [structuredClone(e)];
  }
}
fs.writeFileSync(file, JSON.stringify(c, null, 2) + '\n');
console.log('עודכנו', IDS.length, 'ערכות');
