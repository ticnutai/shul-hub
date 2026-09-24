import { describe, expect, it } from "vitest";

import {
  configForDevice,
  DEFAULT_TV_CONFIG,
  deviceHasOverrides,
  editForDevice,
  normalizeTvConfig,
  type TvConfig,
} from "./config";
import { classOfPreviewDevice, deviceClassFor } from "./devices";

const base = (over: Partial<TvConfig> = {}): TvConfig => ({
  ...structuredClone(DEFAULT_TV_CONFIG),
  texts: { "header.title": "בית הכנסת אושר של יהודי", "dash.prayers": "זמני התפילות" },
  hidden: ["dash.clock"],
  ...over,
});

describe("which kind of screen this is", () => {
  it("takes the television's word for it rather than guessing from its size", () => {
    // A TV box reports 960 CSS pixels, which by width alone is a laptop.
    expect(deviceClassFor(960, true)).toBe("tv");
    expect(deviceClassFor(960, false)).toBe("desktop");
  });

  it("calls a narrow screen a phone and a wide one a computer", () => {
    expect(deviceClassFor(390, false)).toBe("mobile");
    expect(deviceClassFor(820, false)).toBe("mobile"); // a tablet, held like one
    expect(deviceClassFor(901, false)).toBe("desktop");
    expect(deviceClassFor(1920, false)).toBe("desktop");
  });

  it("folds the five devices in the preview onto the three that differ", () => {
    expect(classOfPreviewDevice("tv")).toBe("tv");
    expect(classOfPreviewDevice("desktop")).toBe("desktop");
    expect(classOfPreviewDevice("laptop")).toBe("desktop");
    expect(classOfPreviewDevice("tablet")).toBe("mobile");
    expect(classOfPreviewDevice("mobile")).toBe("mobile");
  });
});

describe("a board seen by one kind of screen", () => {
  it("is the board itself when that screen has nothing of its own", () => {
    const c = base();
    expect(configForDevice(c, "mobile")).toBe(c);
    expect(configForDevice(c, null)).toBe(c);
    expect(deviceHasOverrides(c, "mobile")).toBe(false);
  });

  it("changes the one word that was changed, and nothing else", () => {
    const c = base({ perDevice: { mobile: { texts: { "header.title": "בית הכנסת" } } } });
    const phone = configForDevice(c, "mobile");

    expect(phone.texts["header.title"]).toBe("בית הכנסת");
    // Everything else still follows the board.
    expect(phone.texts["dash.prayers"]).toBe("זמני התפילות");
    expect(phone.hidden).toEqual(["dash.clock"]);
    expect(phone.theme).toBe(c.theme);

    // And the board itself is untouched - this is the whole point.
    expect(c.texts["header.title"]).toBe("בית הכנסת אושר של יהודי");
    expect(configForDevice(c, "tv").texts["header.title"]).toBe("בית הכנסת אושר של יהודי");
  });

  it("keeps the three apart: the wall, the laptop and the phone", () => {
    const c = base({
      perDevice: {
        tv: { texts: { "header.title": "בית הכנסת אושר של יהודי" } },
        desktop: { texts: { "header.title": "אושר של יהודי" } },
        mobile: { texts: { "header.title": "אושר" } },
      },
    });
    expect(configForDevice(c, "tv").texts["header.title"]).toBe("בית הכנסת אושר של יהודי");
    expect(configForDevice(c, "desktop").texts["header.title"]).toBe("אושר של יהודי");
    expect(configForDevice(c, "mobile").texts["header.title"]).toBe("אושר");
  });

  it("replaces the list of what is hidden rather than adding to it", () => {
    // A union could never put something back that the board hides, which is
    // half of what a screen needs to be able to say.
    const c = base({ hidden: ["dash.clock", "dash.strip"], perDevice: { mobile: { hidden: [] } } });
    expect(configForDevice(c, "mobile").hidden).toEqual([]);
    expect(configForDevice(c, "tv").hidden).toEqual(["dash.clock", "dash.strip"]);
  });

  it("lets a screen take its own layout, theme and style", () => {
    const c = base({
      screenLayout: "dashboard",
      theme: "navy",
      perDevice: { mobile: { screenLayout: "rotate", theme: "parchment", textScale: 1.2 } },
    });
    const phone = configForDevice(c, "mobile");
    expect([phone.screenLayout, phone.theme, phone.textScale]).toEqual(["rotate", "parchment", 1.2]);
    expect([c.screenLayout, c.theme]).toEqual(["dashboard", "navy"]);
  });

  it("merges per-element styling by element, not wholesale", () => {
    const c = base({
      styles: { "header.title": { scale: 2 }, "dash.prayers": { color: "#fff" } },
      perDevice: { mobile: { styles: { "header.title": { scale: 1 } } } },
    });
    const phone = configForDevice(c, "mobile");
    expect(phone.styles["header.title"]).toEqual({ scale: 1 });
    expect(phone.styles["dash.prayers"]).toEqual({ color: "#fff" });
  });
});

describe("reading a board back", () => {
  it("survives a board saved before screens existed", () => {
    const old = structuredClone(DEFAULT_TV_CONFIG) as unknown as Record<string, unknown>;
    delete old.perDevice;
    const c = normalizeTvConfig(old);
    expect(c.perDevice).toEqual({});
    expect(configForDevice(c, "mobile")).toBe(c);
  });

  it("keeps an overlay that says something and drops one that does not", () => {
    const c = normalizeTvConfig({
      ...structuredClone(DEFAULT_TV_CONFIG),
      perDevice: { mobile: { textScale: 1.2 }, desktop: {}, tv: { nonsense: 1 } },
    });
    expect(c.perDevice.mobile).toEqual({ textScale: 1.2 });
    expect(c.perDevice.desktop).toBeUndefined();
    // An unknown key is not a reason to keep an otherwise empty overlay.
    expect(c.perDevice.tv).toBeUndefined();
  });

  it("ignores a screen it has never heard of", () => {
    const c = normalizeTvConfig({
      ...structuredClone(DEFAULT_TV_CONFIG),
      perDevice: { smartwatch: { textScale: 3 } },
    });
    expect(c.perDevice).toEqual({});
  });
});

/**
 * Redirecting an edit at one screen.
 *
 * These matter more than they look: the editor's controls are all
 * (config) => config and none of them know screens exist. If this is
 * wrong, an edit meant for the phone quietly lands on the wall.
 */
describe("an edit aimed at one screen", () => {
  it("leaves the board alone and shows up only on that screen", () => {
    const c = base();
    const next = editForDevice(c, "mobile", (x) => ({
      ...x,
      texts: { ...x.texts, "header.title": "אושר" },
    }));

    expect(next.texts["header.title"]).toBe("בית הכנסת אושר של יהודי"); // the board
    expect(configForDevice(next, "mobile").texts["header.title"]).toBe("אושר");
    expect(configForDevice(next, "tv").texts["header.title"]).toBe("בית הכנסת אושר של יהודי");
  });

  it("keeps only what differs, not a copy of the whole board", () => {
    const c = base();
    const next = editForDevice(c, "mobile", (x) => ({ ...x, textScale: 1.4 }));
    expect(next.perDevice.mobile).toEqual({ textScale: 1.4 });
  });

  it("forgets the screen entirely once it is back to the board's own value", () => {
    let c = editForDevice(base(), "mobile", (x) => ({ ...x, textScale: 1.4 }));
    expect(c.perDevice.mobile).toBeDefined();
    c = editForDevice(c, "mobile", (x) => ({ ...x, textScale: base().textScale }));
    expect(c.perDevice.mobile).toBeUndefined();
  });

  it("can say 'not styled on this screen', which needs more than leaving it out", () => {
    // Dropping the key would let the board's styling show through again.
    const c = base({ styles: { "header.title": { scale: 2 } } });
    const next = editForDevice(c, "mobile", (x) => ({ ...x, styles: {} }));
    expect(next.perDevice.mobile?.styles).toEqual({ "header.title": {} });
    expect(configForDevice(next, "mobile").styles["header.title"]).toEqual({});
    expect(configForDevice(next, "tv").styles["header.title"]).toEqual({ scale: 2 });
  });

  it("can put back on one screen something the board hides", () => {
    const c = base({ hidden: ["dash.clock"] });
    const next = editForDevice(c, "desktop", (x) => ({ ...x, hidden: [] }));
    expect(configForDevice(next, "desktop").hidden).toEqual([]);
    expect(configForDevice(next, "tv").hidden).toEqual(["dash.clock"]);
  });

  it("with no screen chosen, edits the board as it always did", () => {
    const c = base();
    const next = editForDevice(c, null, (x) => ({ ...x, textScale: 1.4 }));
    expect(next.textScale).toBe(1.4);
    expect(next.perDevice).toEqual({});
  });

  it("stacks up several edits to the same screen instead of replacing them", () => {
    let c = base();
    c = editForDevice(c, "mobile", (x) => ({ ...x, textScale: 1.4 }));
    c = editForDevice(c, "mobile", (x) => ({ ...x, texts: { ...x.texts, "header.title": "אושר" } }));
    expect(c.perDevice.mobile).toEqual({ textScale: 1.4, texts: { "header.title": "אושר" } });
  });

  it("survives a round trip through the database", () => {
    const c = editForDevice(base(), "mobile", (x) => ({ ...x, textScale: 1.4 }));
    const back = normalizeTvConfig(JSON.parse(JSON.stringify(c)));
    expect(configForDevice(back, "mobile").textScale).toBe(1.4);
    expect(configForDevice(back, "tv").textScale).toBe(base().textScale);
  });
});
