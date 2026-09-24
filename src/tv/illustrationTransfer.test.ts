import { describe, expect, it } from "vitest";
import { DEFAULT_TV_CONFIG, normalizeTvConfig } from "./config";
import {
  ILLUSTRATION_DEFS,
  MAX_CUSTOM_ILLUSTRATIONS,
  dataUrlToFile,
  normalizeCustomIllustrations,
  readPortableIllustration,
  toPortableIllustration,
} from "./illustrated";
import { newCustomThemeId, newGradientId } from "./themes";
import { applyImport, buildExport, parseImport, planIllustrations } from "./transfer";

/** A 1×1 JPEG - enough for the format; the uploader decodes real pictures. */
const PIXEL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

const painted = {
  name: "היכל הכותל",
  hint: "אבני הכותל בשקיעה",
  ink: "#2e2414",
  accent: "#6a4a12",
  clockInk: "#2e2414",
  boxes: {
    clock: [44, 4, 56, 22],
    plaqueR: [62, 6, 90, 18],
    plaqueL: [10, 6, 38, 18],
    panelR: [53, 28, 90, 86],
    panelL: [10, 28, 47, 86],
  },
  image: PIXEL,
};
const file = (illustrations: unknown[], extra: object = {}) =>
  JSON.stringify({ format: "design-tokens", version: 1, themes: [], gradients: [], illustrations, ...extra });

describe("a painted board in a file", () => {
  it("is read with its frames, inks and picture", () => {
    const r = parseImport(file([painted]), newCustomThemeId, newGradientId);
    expect(r.illustrations).toHaveLength(1);
    expect(r.illustrations[0].name).toBe("היכל הכותל");
    expect(r.illustrations[0].boxes.panelR).toEqual([53, 28, 90, 86]);
    expect(r.skipped).toBe(0);
  });

  it("refuses a picture that is not a JPEG, PNG or WEBP inside the file", () => {
    const svg = "data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+";
    for (const image of [svg, "https://evil.example/board.jpg", "http://x/y.png", "data:image/png;base64,@@@", ""]) {
      expect(readPortableIllustration({ ...painted, image })).toBeNull();
    }
  });

  it("refuses frames outside the picture, missing frames and unsafe ink", () => {
    expect(readPortableIllustration({ ...painted, boxes: { ...painted.boxes, panelR: [53, 28, 120, 86] } })).toBeNull();
    expect(readPortableIllustration({ ...painted, boxes: { ...painted.boxes, clock: [50, 10, 50.5, 20] } })).toBeNull();
    const { clock: _c, ...noClock } = painted.boxes;
    expect(readPortableIllustration({ ...painted, boxes: noClock })).toBeNull();
    expect(readPortableIllustration({ ...painted, ink: "url(https://evil.example)" })).toBeNull();
    expect(readPortableIllustration({ ...painted, name: "" })).toBeNull();
  });

  it("counts a refused board as skipped, and a file of only boards is a file", () => {
    const r = parseImport(file([painted, { ...painted, image: "https://x.example/a.jpg" }]), newCustomThemeId, newGradientId);
    expect(r.illustrations).toHaveLength(1);
    expect(r.skipped).toBe(1);
  });
});

describe("importing it", () => {
  it("recognises the four built in and does not upload them again", () => {
    const builtin = ILLUSTRATION_DEFS.map((d) => toPortableIllustration(d, PIXEL));
    const r = parseImport(file([...builtin, painted]), newCustomThemeId, newGradientId);
    const plan = planIllustrations(r);
    expect(plan.builtin).toEqual(["curtain", "stone", "wood", "modern"]);
    expect(plan.upload.map((i) => i.name)).toEqual(["היכל הכותל"]);
  });

  it("stores the uploaded URL, never the picture, with a new id and a free name", () => {
    const r = parseImport(file([painted]), newCustomThemeId, newGradientId);
    const { image: _p, ...shape } = r.illustrations[0];
    const url = "https://project.supabase.co/storage/v1/object/public/community-media/tv/a.jpg";
    const once = applyImport(DEFAULT_TV_CONFIG, r, [{ ...shape, image: url }]);
    const twice = applyImport(once, r, [{ ...shape, image: url }]);
    expect(twice.customIllustrations.map((i) => i.name)).toEqual(["היכל הכותל", "היכל הכותל (2)"]);
    expect(twice.customIllustrations.every((i) => /^i_/.test(i.id) && i.image === url)).toBe(true);
    expect(JSON.stringify(twice)).not.toContain("base64");
    expect(normalizeTvConfig(twice)).toEqual(twice);
  });

  it("keeps a stored board only with an uploaded (https) picture", () => {
    const ok = { ...painted, id: "i_abcdef12", image: "https://cdn.example/a.jpg" };
    expect(normalizeCustomIllustrations([ok, { ...ok, id: "i_bbbbbbbb", image: PIXEL }, { ...ok, id: "x" }])).toHaveLength(1);
    expect(normalizeCustomIllustrations(Array.from({ length: 20 }, (_, i) => ({ ...ok, id: `i_${String(i).padStart(8, "a")}` })))).toHaveLength(
      MAX_CUSTOM_ILLUSTRATIONS,
    );
  });

  it("lets the illustrated layout show an imported board, and forgets one that is gone", () => {
    const ok = { ...painted, id: "i_abcdef12", image: "https://cdn.example/a.jpg" };
    expect(normalizeTvConfig({ customIllustrations: [ok], illustration: "i_abcdef12" }).illustration).toBe("i_abcdef12");
    expect(normalizeTvConfig({ customIllustrations: [], illustration: "i_abcdef12" }).illustration).toBe("curtain");
  });
});

describe("exporting it", () => {
  it("writes the boards into the file, and the file imports back whole", () => {
    const ok = { ...painted, id: "i_abcdef12", image: "https://cdn.example/a.jpg" };
    const config = normalizeTvConfig({ customIllustrations: [ok] });
    const out = buildExport(config, { board: true }, config.customIllustrations.map((i) => toPortableIllustration(i, PIXEL)));
    const back = parseImport(JSON.stringify(out), newCustomThemeId, newGradientId);
    expect(back.illustrations).toHaveLength(1);
    expect(back.illustrations[0].boxes).toEqual(ok.boxes);
    expect(back.illustrations[0].image).toBe(PIXEL);
  });

  it("turns a picture from a file into something the uploader takes", () => {
    const f = dataUrlToFile(PIXEL, "היכל הכותל");
    expect(f.type).toBe("image/jpeg");
    expect(f.name).toBe("היכל-הכותל.jpg");
    expect(f.size).toBeGreaterThan(100);
  });
});
