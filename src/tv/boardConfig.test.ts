/**
 * The admin's picture of a screen is the screen's own board.
 *
 * At אהל אברהם the TV has settings of its own - a light-blue skin, the forest
 * theme, no logo, the split layout - and the admin's "מה מוצג עכשיו על המסך"
 * ignored them and drew the saved board: dark, with two logos. Both now go
 * through boardConfig, and this holds the TV's settings to it.
 */
import { describe, expect, it } from "vitest";

import { boardConfig } from "./boardConfig";
import { DEFAULT_TV_CONFIG, type TvConfig } from "./config";

const now = new Date("2026-09-29T12:00:00+03:00"); // a weekday in chol hamoed, no day look set

const ohelAvraham: TvConfig = {
  ...structuredClone(DEFAULT_TV_CONFIG),
  theme: "navy",
  skin: "plain",
  screenLayout: "rotate",
  perDevice: { tv: { skin: "sky", theme: "forest", screenLayout: "split", clockStyle: "both" } },
} as TvConfig;

describe("the board a screen draws", () => {
  it("on the TV, has the TV's own settings", () => {
    const c = boardConfig(ohelAvraham, { deviceClass: "tv", now, settings: null });
    expect([c.skin, c.theme, c.screenLayout, c.clockStyle]).toEqual(["sky", "forest", "split", "both"]);
  });

  it("on a computer, has the board as saved", () => {
    const c = boardConfig(ohelAvraham, { deviceClass: "desktop", now, settings: null });
    expect([c.skin, c.theme, c.screenLayout]).toEqual(["plain", "navy", "rotate"]);
  });

  it("takes a theme chosen from the remote, and ignores one that no longer exists", () => {
    expect(boardConfig(ohelAvraham, { deviceClass: "tv", themeOverride: "royal", now, settings: null }).theme).toBe("royal");
    expect(boardConfig(ohelAvraham, { deviceClass: "tv", themeOverride: "gone", now, settings: null }).theme).toBe("forest");
  });

  it("ends Shabbat when the synagogue says it does", () => {
    const c = boardConfig(ohelAvraham, { deviceClass: "tv", now, settings: { shabbat_end_minutes: 72 } as never });
    expect(c.shabbat.endMinutesAfterSunset).toBe(72);
  });
});
