/**
 * Bakes the board's materials into image files.
 *
 *   node scripts/tv-textures.mjs
 *
 * Marble, walnut, stone, parchment, gold and velvet are generated here from
 * SVG filters - fractal noise that is either tinted into veins and grain or
 * lit into a rough or brushed surface. Nothing is downloaded and nothing is
 * licensed; the recipes below are the source.
 *
 * They are baked rather than kept as data URIs because a filtered SVG is
 * recomputed for every element that uses it and for every size: measured on
 * the bundle, the stone board spent 950 ms rasterising against 146 ms for the
 * plain one. A JPEG is decoded once and shared by every element, so the same
 * board costs what a flat colour costs.
 *
 * Re-run this after changing a recipe, then commit the images.
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "tv", "assets");

/** Noise tinted into veins or grain: a colour matrix over the turbulence. */
const tinted = (fill, turbulence, matrix, blur = 0.5) => `
  <defs><filter id="f" x="0" y="0" width="100%" height="100%">
    ${turbulence}
    <feColorMatrix in="n" type="matrix" values="${matrix}" result="v"/>
    <feGaussianBlur in="v" stdDeviation="${blur}" result="vb"/>
    <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="vb"/></feMerge>
  </filter></defs>
  <rect width="100%" height="100%" fill="${fill}" filter="url(#f)"/>`;

/** Noise lit from the side: turns the same noise into a real surface. */
const lit = (fill, turbulence, { scale, constant, light, azimuth, elevation, k1 }) => `
  <defs><filter id="f" x="0" y="0" width="100%" height="100%">
    ${turbulence}
    <feDiffuseLighting in="n" surfaceScale="${scale}" diffuseConstant="${constant}" lighting-color="${light}" result="l">
      <feDistantLight azimuth="${azimuth}" elevation="${elevation}"/>
    </feDiffuseLighting>
    <feComposite in="l" in2="SourceGraphic" operator="arithmetic" k1="${k1}" k2="0" k3="0" k4="0"/>
  </filter></defs>
  <rect width="100%" height="100%" fill="${fill}" filter="url(#f)"/>`;

const noise = (freq, octaves, seed) =>
  `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" seed="${seed}" result="n"/>`;

const TEXTURES = {
  // cream marble with grey veins
  "tex-marble": {
    w: 640, h: 440, quality: 0.82,
    body: tinted("#efe8d8", noise("0.012 0.06", 7, 3), "0 0 0 0 0.55  0 0 0 0 0.5  0 0 0 0 0.42  2.4 0 0 0 -0.75", 0.4),
  },
  // the same stone in deep blue, for panels that carry light text
  "tex-marble-dark": {
    w: 640, h: 440, quality: 0.82,
    body: tinted("#152441", noise("0.03 0.1", 5, 15), "0 0 0 0 0.55  0 0 0 0 0.6  0 0 0 0 0.75  0.22 0 0 0 -0.12", 0.5),
  },
  // walnut, the grain stretched along the plank
  "tex-walnut": {
    w: 640, h: 440, quality: 0.82,
    body: tinted("#6b3a1c", noise("0.002 0.09", 5, 11), "0 0 0 0 0.18  0 0 0 0 0.09  0 0 0 0 0.03  1.3 0 0 0 -0.2", 0.3),
  },
  // aged parchment
  "tex-parchment": {
    w: 640, h: 440, quality: 0.8,
    body: tinted("#f6ecd4", noise("0.035", 5, 9), "0 0 0 0 0.62  0 0 0 0 0.5  0 0 0 0 0.3  0.55 0 0 0 -0.08", 0.3),
  },
  // Jerusalem stone: rough, lit from the upper left
  "tex-stone": {
    w: 640, h: 440, quality: 0.84,
    body: lit("#e3d8bd", noise("0.09", 4, 2), { scale: 2.2, constant: 1.05, light: "#fdf6e6", azimuth: 225, elevation: 52, k1: 1.15 }),
  },
  // brushed gold: fine noise lit along one axis, so it reads as metal
  "tex-gold": {
    w: 420, h: 320, quality: 0.88,
    body: `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff3c9"/><stop offset="0.35" stop-color="#e3bd5c"/>
        <stop offset="0.55" stop-color="#a9821f"/><stop offset="0.8" stop-color="#f0d68f"/>
        <stop offset="1" stop-color="#8a6a1a"/></linearGradient>
      <filter id="f" x="0" y="0" width="100%" height="100%">
        ${noise("0.9 0.02", 2, 5)}
        <feDiffuseLighting in="n" surfaceScale="1.4" diffuseConstant="1" lighting-color="#fff8e0" result="l">
          <feDistantLight azimuth="235" elevation="55"/>
        </feDiffuseLighting>
        <feComposite in="l" in2="SourceGraphic" operator="arithmetic" k1="1" k2="0" k3="0" k4="0"/>
      </filter></defs>
      <rect width="100%" height="100%" fill="url(#g)" filter="url(#f)"/>`,
  },
  // velvet: a fine nap with a soft sheen
  "tex-velvet": {
    w: 420, h: 320, quality: 0.84,
    body: lit("#7a1226", noise("0.55", 3, 4), { scale: 1.1, constant: 1.15, light: "#ffd2c0", azimuth: 215, elevation: 42, k1: 1.25 }),
  },
};

const svg = ({ w, h, body }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await mkdir(OUT, { recursive: true });

for (const [name, tex] of Object.entries(TEXTURES)) {
  const dataUrl = await page.evaluate(
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
    { markup: svg(tex), w: tex.w, h: tex.h, quality: tex.quality },
  );
  const bytes = Buffer.from(dataUrl.split(",")[1], "base64");
  await writeFile(join(OUT, `${name}.jpg`), bytes);
  console.log(`${name}.jpg  ${tex.w}x${tex.h}  ${(bytes.length / 1024).toFixed(0)} KB`);
}

await browser.close();
