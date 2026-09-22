/**
 * Bakes the ready-made board backgrounds.
 *
 *   node scripts/tv-backdrops.mjs
 *
 * Sky, light, stone, parchment, velvet and water - the materials a
 * synagogue board can stand on without arguing with it. Drawn here from
 * gradients and fractal noise, the same way the panel materials are
 * (scripts/tv-textures.mjs): nothing is downloaded and nothing is licensed,
 * the recipes below are the source, and they stay sharp at any screen size
 * because they are re-baked rather than scaled.
 *
 * What they deliberately are not: pictures of anything. No figures, no
 * faces, no place. A board carries prayer times and has to be read across a
 * hall, so a background that draws the eye has failed at its job - and in a
 * shul a picture on the wall is a decision for the people who daven there,
 * not for a piece of software. These are surfaces, chosen so the panels on
 * top of them stay legible.
 *
 * Each one is baked twice: the background itself, and a small thumbnail for
 * the picker, so opening the editor does not pull down a megabyte of
 * full-size images.
 *
 * Re-run after changing a recipe, then commit the images.
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "tv", "assets", "backdrops");

const noise = (freq, octaves, seed, result = "n") =>
  `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" seed="${seed}" result="${result}"/>`;

/** A vertical wash, which is what a sky is before anything else. */
const sky = (stops) => `
  <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
    ${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("")}
  </linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#s)"/>`;

/** Soft cloud or haze laid over whatever is beneath it. */
const haze = (freq, seed, opacity, colour = "#ffffff") => `
  <defs><filter id="h${seed}" x="-10%" y="-10%" width="120%" height="120%">
    ${noise(freq, 5, seed)}
    <feColorMatrix in="n" type="matrix"
      values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.1 0 0 0 -0.45" result="m"/>
    <feGaussianBlur in="m" stdDeviation="6"/>
  </filter></defs>
  <rect width="100%" height="100%" fill="${colour}" filter="url(#h${seed})" opacity="${opacity}"/>`;

/**
 * Stars: noise pushed through a steep curve so that only the few brightest
 * points survive. A field of even dots reads as a texture; what makes it a
 * sky is that most of it is empty.
 *
 * type="turbulence" and not fractalNoise, which was the first attempt and
 * produced a sky with no stars at all: fractal noise clusters tightly around
 * its middle, so a threshold high enough to be sparse is a threshold nothing
 * reaches. Turbulence is mostly near zero with occasional peaks, which is
 * the shape this wants. The constants below were measured, not guessed -
 * the brighter layer lights 0.18% of the sky and the fainter one 0.28%.
 */
const stars = (seed, freq, k, c, opacity) => `
  <defs><filter id="st${seed}" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="turbulence" baseFrequency="${freq}" numOctaves="1" seed="${seed}" result="n"/>
    <feColorMatrix in="n" type="matrix"
      values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  ${k} 0 0 0 ${c}" result="s"/>
    <feGaussianBlur in="s" stdDeviation="0.4"/>
  </filter></defs>
  <rect width="100%" height="100%" fill="#ffffff" filter="url(#st${seed})" opacity="${opacity}"/>`;

/**
 * Cumulus: noise with a steep edge, blurred just enough to be soft.
 *
 * The difference between cloud and fog is the shape of that curve, not the
 * noise. A gentle ramp spreads the same turbulence into an even grey wash;
 * a steep one leaves defined shapes with blue between them, which is what
 * makes a sky look like a sky. `k` is the steepness, `c` moves the
 * threshold - higher k and lower c give fewer, whiter, better-defined
 * clouds - and the blur is how hard their edges are.
 *
 * Two layers at different scales read as depth: big shapes far off, small
 * ones nearer. One layer alone looks like wallpaper.
 */
const cloud = (id, freq, octaves, seed, k, c, blur, opacity, colour = "#ffffff") => `
  <defs><filter id="c${id}" x="-20%" y="-20%" width="140%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" seed="${seed}" result="n"/>
    <feColorMatrix in="n" type="matrix"
      values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  ${k} 0 0 0 ${c}" result="t"/>
    <feGaussianBlur in="t" stdDeviation="${blur}"/>
  </filter></defs>
  <rect width="100%" height="100%" fill="${colour}" filter="url(#c${id})" opacity="${opacity}"/>`;

/** A glow, for light coming from somewhere rather than everywhere. */
const glow = (cx, cy, r, colour, opacity) => `
  <defs><radialGradient id="g${cx}${cy}" cx="${cx}" cy="${cy}" r="${r}">
    <stop offset="0" stop-color="${colour}" stop-opacity="${opacity}"/>
    <stop offset="1" stop-color="${colour}" stop-opacity="0"/>
  </radialGradient></defs>
  <rect width="100%" height="100%" fill="url(#g${cx}${cy})"/>`;

/** Noise tinted into a material: veins, grain, weave. */
const grain = (freq, octaves, seed, matrix, blur, opacity) => `
  <defs><filter id="gr${seed}" x="0" y="0" width="100%" height="100%">
    ${noise(freq, octaves, seed)}
    <feColorMatrix in="n" type="matrix" values="${matrix}" result="v"/>
    <feGaussianBlur in="v" stdDeviation="${blur}"/>
  </filter></defs>
  <rect width="100%" height="100%" fill="#808080" filter="url(#gr${seed})" opacity="${opacity}"/>`;

const BACKDROPS = {
  /* ------------------------------------------------------------- sky --- */
  dawn: {
    name: "עלות השחר",
    note: "כחול עמוק שנפתח לאור ראשון בקצה התחתון",
    light: false,
    body: [
      sky([[0, "#0a1430"], [0.45, "#16305c"], [0.78, "#5a4a72"], [0.93, "#c98a5e"], [1, "#e8b77c"]]),
      haze("0.006 0.02", 7, 0.1),
      glow("50%", "100%", "70%", "#ffd9a0", 0.35),
    ],
  },
  dusk: {
    name: "בין הערביים",
    note: "אור חם ששוקע לכחול לילה",
    light: false,
    body: [
      sky([[0, "#1a1038"], [0.35, "#3d2352"], [0.66, "#8c4a52"], [0.86, "#c9793f"], [1, "#e0a55c"]]),
      haze("0.005 0.018", 13, 0.12),
      glow("50%", "102%", "62%", "#ffc17a", 0.3),
    ],
  },
  night: {
    name: "ליל כוכבים",
    note: "לילה עמוק עם כוכבים דקים",
    light: false,
    body: [
      sky([[0, "#05091c"], [0.55, "#0b1738"], [1, "#122352"]]),
      stars(21, 0.8, 2.6, -1.35, 0.85),
      stars(7, 0.8, 2.2, -1.05, 0.35),
      glow("50%", "95%", "55%", "#3f5f9e", 0.28),
    ],
  },
  morning: {
    name: "אור הבוקר",
    note: "אור רך שיורד מלמעלה, בהיר",
    light: true,
    body: [
      sky([[0, "#fdf6e6"], [0.5, "#f3e6c8"], [1, "#e4d3ab"]]),
      glow("50%", "-5%", "75%", "#ffffff", 0.75),
      grain("0.03", 4, 31, "0 0 0 0 0.5  0 0 0 0 0.45  0 0 0 0 0.35  0.35 0 0 0 -0.16", 0.4, 0.5),
    ],
  },

  /* --------------------------------------------------------- clouds --- */
  sky: {
    name: "שמי תכלת",
    note: "תכלת עם עננים לבנים, כמו יום בהיר",
    light: true,
    body: [
      sky([[0, "#3f93d8"], [0.55, "#79bbeb"], [1, "#bfe0f6"]]),
      cloud(1, "0.011", 7, 21, 4.2, -2.15, 2.4, 0.95),
      cloud(2, "0.03", 5, 6, 3.2, -1.9, 1.4, 0.4),
      glow("50%", "12%", "70%", "#ffffff", 0.22),
    ],
  },
  clouds: {
    name: "ענני בוקר",
    note: "עננים רכים ומפוזרים על תכלת בהירה",
    light: true,
    body: [
      sky([[0, "#4a9fe0"], [0.6, "#8cc6ee"], [1, "#cde8f8"]]),
      cloud(1, "0.009", 6, 3, 3.2, -1.5, 3.2, 0.95),
      glow("50%", "20%", "75%", "#ffffff", 0.2),
    ],
  },
  haze: {
    name: "שמיים רכים",
    note: "תכלת שקטה כמעט בלי צורות - הרקע הכי לא מפריע",
    light: true,
    body: [
      sky([[0, "#6fb4e8"], [0.6, "#a9d6f2"], [1, "#ddf0fb"]]),
      cloud(1, "0.006", 5, 5, 2.0, -0.95, 8, 0.85),
    ],
  },
  cirrus: {
    name: "עננים גבוהים",
    note: "פסי ענן דקים, רגועים",
    light: true,
    body: [
      sky([[0, "#5aa8e4"], [0.6, "#9acdf0"], [1, "#d8eefb"]]),
      cloud(1, "0.004 0.02", 5, 13, 2.6, -1.3, 4, 0.8),
      glow("50%", "85%", "60%", "#ffffff", 0.18),
    ],
  },

  /* -------------------------------------------------------- materials --- */
  stone: {
    name: "אבן ירושלים",
    note: "אבן חמה ובהירה, שקטה מאחורי הלוחות",
    light: true,
    body: [
      sky([[0, "#e9dcc0"], [0.6, "#e0d1b0"], [1, "#d2c09a"]]),
      grain("0.05", 5, 2, "0 0 0 0 0.42  0 0 0 0 0.36  0 0 0 0 0.26  0.6 0 0 0 -0.26", 0.5, 0.55),
      glow("30%", "10%", "85%", "#fffaf0", 0.4),
    ],
  },
  parchment: {
    name: "קלף",
    note: "קלף ישן, חם ונקי",
    light: true,
    body: [
      sky([[0, "#f8efd8"], [0.55, "#f2e5c6"], [1, "#e6d4ac"]]),
      grain("0.028", 5, 9, "0 0 0 0 0.45  0 0 0 0 0.36  0 0 0 0 0.2  0.5 0 0 0 -0.2", 0.35, 0.6),
      glow("50%", "45%", "80%", "#fffdf5", 0.45),
    ],
  },
  velvet: {
    name: "פרוכת",
    note: "קטיפה עמוקה עם ברק רך",
    light: false,
    body: [
      sky([[0, "#3d0713"], [0.5, "#63101f"], [1, "#39060f"]]),
      grain("0.5", 3, 4, "0 0 0 0 1  0 0 0 0 0.75  0 0 0 0 0.7  0.5 0 0 0 -0.24", 0.3, 0.3),
      glow("50%", "28%", "70%", "#ff9a86", 0.16),
    ],
  },
  waters: {
    name: "מי מנוחות",
    note: "כחול שקט עם אור על פני המים",
    light: false,
    body: [
      sky([[0, "#06243a"], [0.55, "#0c3c5c"], [1, "#0a2a42"]]),
      grain("0.004 0.09", 4, 17, "0 0 0 0 0.75  0 0 0 0 0.9  0 0 0 0 1  0.5 0 0 0 -0.26", 0.6, 0.35),
      glow("50%", "18%", "65%", "#9fd8ff", 0.18),
    ],
  },
};

const svg = (w, h, layers) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${layers.join("")}</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1000, height: 600 });
await mkdir(OUT, { recursive: true });

const bake = async (layers, w, h, quality) =>
  page.evaluate(
    async ({ markup, w, h, quality }) => {
      const img = new Image();
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup);
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      return canvas.toDataURL("image/jpeg", quality);
    },
    { markup: svg(w, h, layers), w, h, quality },
  );

let total = 0;
for (const [id, b] of Object.entries(BACKDROPS)) {
  for (const [suffix, w, h, q] of [["", 960, 540, 0.82], ["-thumb", 160, 90, 0.7]]) {
    const dataUrl = await bake(b.body, w, h, q);
    const bytes = Buffer.from(dataUrl.split(",")[1], "base64");
    const file = join(OUT, `${id}${suffix}.jpg`);
    await writeFile(file, bytes);
    total += bytes.length;
    console.log(`${(id + suffix).padEnd(20)} ${w}x${h}  ${(bytes.length / 1024).toFixed(0)} KB`);
  }
}
console.log(`\n${Object.keys(BACKDROPS).length} backdrops, ${(total / 1024).toFixed(0)} KB in all`);

await browser.close();
