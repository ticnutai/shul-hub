// WCAG contrast for every theme in a design-tokens file, as a board is read:
// from across a lit hall. Text 7:1, secondary text, accents and the text on a
// gold tag 4.5:1, the pinned-notice colour 3:1. Surfaces are semi-transparent,
// so they are composited over the background before measuring.
// Exits non-zero when anything fails.
import { readFileSync } from "node:fs";
const pack = JSON.parse(readFileSync(process.argv[2], "utf8"));
const parse = (c) => { let m = c.match(/^#([0-9a-f]{6})$/i); if (m) { const n = parseInt(m[1],16); return [n>>16&255,n>>8&255,n&255,1]; }
  m = c.match(/rgba?\(([^)]+)\)/); const p = m[1].split(",").map(Number); return [p[0],p[1],p[2],p[3] ?? 1]; };
const over = (fg, bg) => { const a = fg[3]; return [0,1,2].map(i => fg[i]*a + bg[i]*(1-a)).concat(1); };
const L = ([r,g,b]) => { const f = v => { v/=255; return v<=0.03928? v/12.92 : ((v+0.055)/1.055)**2.4; }; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
const ratio = (a,b) => { const [x,y] = [L(a),L(b)].sort((p,q)=>q-p); return (x+0.05)/(y+0.05); };
let fail = 0;
for (const t of pack.themes) {
  const r = t.roles, bg = parse(r.background), surf = over(parse(r.surface), bg);
  const checks = [["text/bg",r.text,bg,7],["text/surface",r.text,surf,7],["muted/surface",r.textMuted,surf,4.5],["accent/bg",r.accent,bg,4.5],["accent/surface",r.accent,surf,4.5],["onAccent/accent",r.onAccent,parse(r.accent),4.5],["highlight/surface",r.highlight,surf,3]];
  const res = checks.map(([n,fg,b,min]) => { const v = ratio(parse(fg), b); if (v < min) fail++; return `${n} ${v.toFixed(1)}${v<min?"✗":""}`; });
  console.log(t.name.padEnd(18), res.join(" | "));
}
console.log(fail ? `FAILS: ${fail}` : "all pass");
if (fail) process.exit(1);
