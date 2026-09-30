import { beforeEach, describe, expect, it } from "vitest";
import { forgetServerTime } from "./clock";
import { normalizeTvConfig } from "./config";
import { applyDayLook } from "./dayLooks";
import { captureDesign, coloursOnScreen } from "./designs";
import { fromLegacy } from "./occasions";

/** An hour in Israel (UTC+3 in these months), whatever the machine's timezone. */
const il = (iso: string, hour: number) => new Date(`${iso}T${String(hour).padStart(2, "0")}:00:00+03:00`);

beforeEach(() => forgetServerTime());

describe("the design of the occasion that is on", () => {
  const base = normalizeTvConfig({ theme: "navy", screenLayout: "dashboard" });
  const mine = captureDesign(normalizeTvConfig({ theme: "forest", font: "bold" }), "שלי", ["text"], "d_mine01");
  const occasions = fromLegacy(base).map((o) =>
    o.id === "shabbat" ? { ...o, design: "d_curtain" } : o.id === "cal:chol_hamoed_sukkot" ? { ...o, design: "d_mine01" } : o,
  );
  const config = normalizeTvConfig({ ...base, designs: [mine], occasions });

  it("is worn while the occasion is on, and only then", () => {
    const shabbat = applyDayLook(config, il("2026-10-10", 12), null);
    expect(shabbat.screenLayout).toBe("medallion");
    expect(shabbat.backgroundImage).toBe("backdrop:royal");
    expect(applyDayLook(config, il("2026-10-14", 12), null)).toBe(config);
  });

  it("a saved design, only its parts: the rest of the board stays", () => {
    const sukkot = applyDayLook(config, il("2026-09-29", 12), null);
    expect(sukkot.font).toBe("bold");
    expect(sukkot.screenLayout).toBe("dashboard");
    expect(coloursOnScreen(sukkot)["--tv-text"]).toBe(mine.colours["--tv-text"]);
  });

  it("a look per day set before occasions is read as the occasion's design", () => {
    const old = normalizeTvConfig({ ...base, dayLooks: { shabbat: { design: "d_stone" } } });
    expect(applyDayLook(old, il("2026-10-10", 12), null).backgroundImage).toBe("backdrop:wall");
  });
});
