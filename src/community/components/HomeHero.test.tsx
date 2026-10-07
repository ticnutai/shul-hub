/**
 * The strip at the top of the home page: every layout and look draws, the
 * name is not shown twice on one screen, and what is stored is read safely.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HomeHero } from "./HomeHero";
import { DEFAULT_HOME_HERO, HERO_LAYOUTS, HERO_LOOKS, heroShowsName, normalizeHomeHero, type HomeHero as Hero } from "@community/lib/homeHero";
import { formatHebrewDate, hebrewNumeral } from "@community/lib/hebrewDate";

afterEach(cleanup);

const draw = (hero: Partial<Hero>, headerShowsName = true) =>
  render(
    <HomeHero
      hero={{ ...DEFAULT_HOME_HERO, ...hero }}
      headerShowsName={headerShowsName}
      settings={{ name: "אהל משה", subtitle: "תורה ותפילה" }}
      hebrewDate="כ״ו תשרי תשפ״ז"
      dateLabel="יום רביעי, 7 באוקטובר 2026"
      sunrise="06:38"
      sunset="18:18"
      preview
    />,
  );
const visibleName = () => screen.queryAllByText("אהל משה").filter((el) => !el.classList.contains("sr-only"));

describe("the strip at the top of the home page", () => {
  it("reads what is stored safely: anything unknown is the default", () => {
    expect(normalizeHomeHero(null)).toEqual(DEFAULT_HOME_HERO);
    expect(normalizeHomeHero({ layout: "huge", look: "neon", name: 1, date: "no" })).toEqual(DEFAULT_HOME_HERO);
    expect(normalizeHomeHero({ layout: "split", look: "emerald", name: "hide", subtitle: false, date: true, zmanim: false })).toEqual({
      layout: "split", look: "emerald", name: "hide", subtitle: false, date: true, zmanim: false,
    });
  });

  it("does not show the name twice: only where the header does not show it, unless asked", () => {
    expect(heroShowsName(DEFAULT_HOME_HERO, true)).toBe(false);
    expect(heroShowsName(DEFAULT_HOME_HERO, false)).toBe(true);
    expect(heroShowsName({ ...DEFAULT_HOME_HERO, name: "show" }, true)).toBe(true);
    expect(heroShowsName({ ...DEFAULT_HOME_HERO, name: "hide" }, false)).toBe(false);
    draw({}, true);
    expect(visibleName()).toHaveLength(0);
    cleanup();
    draw({}, false);
    expect(visibleName()).toHaveLength(1);
  });

  for (const layout of HERO_LAYOUTS) {
    for (const look of HERO_LOOKS) {
      it(`draws "${layout.name}" in "${look.name}", with one heading for the page`, () => {
        const { container } = draw({ layout: layout.id, look: look.id, name: "show" });
        expect(container.querySelectorAll("h1")).toHaveLength(1);
        if (layout.id === "none") {
          expect(container.querySelector('[data-testid="home-hero"]')).toBeNull();
          return;
        }
        const strip = container.querySelector('[data-testid="home-hero"]')!;
        expect(strip.getAttribute("data-hero-layout")).toBe(layout.id);
        expect(screen.getByTestId("hebrew-date").textContent).toBe("כ״ו תשרי תשפ״ז");
        expect(strip.textContent).toContain("06:38");
        expect(strip.textContent).toContain("18:18");
        expect(visibleName()).toHaveLength(1);
      });
    }
  }

  it("leaves out what is switched off", () => {
    const { container } = draw({ layout: "classic", subtitle: false, date: false, zmanim: false });
    expect(container.textContent).not.toContain("תורה ותפילה");
    expect(screen.queryByTestId("hebrew-date")).toBeNull();
    expect(container.textContent).not.toContain("06:38");
  });

  it("writes the Hebrew date in letters, as before", () => {
    expect(hebrewNumeral(15)).toBe("ט״ו");
    expect(hebrewNumeral(5787)).toBe("תשפ״ז");
    expect(formatHebrewDate(new Date("2026-10-07T10:00:00+03:00"))).toBe("כ״ו תשרי תשפ״ז");
  });
});
