// The Shabbat collection of the New Shul package (18.10.2026): only what the shared catalogue does not have yet.
// Its pictures are named as the catalogue's are ("catalog-..."); a kit or a part already here is left as it is.
// Usage: node scripts/add-shabbat-collection.cjs <the unzipped package's folder>
const fs = require('node:fs'), path = require('node:path');
const pkgDir = process.argv[2];
if (!pkgDir) throw new Error('חסרה תיקיית החבילה');
const file = 'public/new-shul-catalog.json', assets = 'public/new-shul-assets';
const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'catalog.json'), 'utf8'));
const c = JSON.parse(fs.readFileSync(file, 'utf8'));
// The package names a picture "/new-shul-assets/x.png"; the catalogue's copy is "catalog-x.png".
const rename = (v) => JSON.parse(JSON.stringify(v).replace(/\/new-shul-assets\/(?!catalog-|thumbs\/)/g, '/new-shul-assets/catalog-'));
const pictures = new Set();
const note = (v) => JSON.stringify(v).replace(/\/new-shul-assets\/(catalog-[\w.-]+)/g, (_, f) => (pictures.add(f), _));

const added = { designs: [], parts: [], pictures: [] };
for (const raw of pkg.designs) {
  if (c.designs.some((d) => d.id === raw.id)) continue;
  const d = rename(raw);
  note(d);
  c.designs.push(d);
  added.designs.push(d.id);
  // As the collection's kits already here (d_salonivory): each picture layer a part of its own.
  for (const e of d.values.elements.filter((x) => x.kind === 'image'))
    c.parts.push({ id: `catalog_${d.id}_${e.id}`, name: e.name, designId: d.id, elements: [structuredClone(e)], note: 'שכבת תמונה עצמאית' });
}
for (const raw of pkg.elementSets) {
  if (c.parts.some((p) => p.id === raw.id)) continue;
  const s = rename(raw);
  note(s);
  c.parts.push({ id: s.id, name: s.name, designId: 'standalone', elements: s.elements, note: 'פריט עצמאי מהספרייה' });
  added.parts.push(s.id);
}
// The pictures they need: copied once, never over one already here.
for (const f of pictures) {
  const to = path.join(assets, f);
  if (fs.existsSync(to)) continue;
  const from = path.join(pkgDir, 'public/new-shul-assets', f.replace(/^catalog-/, ''));
  if (!fs.existsSync(from)) throw new Error(`תמונה חסרה בחבילה: ${f}`);
  fs.copyFileSync(from, to);
  added.pictures.push(f);
}
// A kit's name is kept to 40 letters (normalizeDesigns): a longer one was cut in the middle of a word, and not found
// by its full name. "· חלקים עצמאיים" is what goes - every kit here is of parts.
for (const d of c.designs) if ([...d.name].length > 40) d.name = d.name.replace(/ · חלקים עצמאיים$/, '');
if (c.designs.some((d) => [...d.name].length > 40)) throw new Error('שם ערכה ארוך מ־40 אותיות');
if (new Set(c.designs.map((d) => d.id)).size !== c.designs.length) throw new Error('ערכה כפולה');
if (new Set(c.parts.map((p) => p.id)).size !== c.parts.length) throw new Error('חלק כפול');
fs.writeFileSync(file, JSON.stringify(c, null, 2) + '\n');
console.log(JSON.stringify(added, null, 1), { designs: c.designs.length, parts: c.parts.length });
