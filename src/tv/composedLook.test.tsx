/**
 * The painted board's sliders, on a board built in the composer.
 *
 * Reported from the admin of תורה ואהבתה: brightness, saturation, hue, the
 * stone and the frames - moved, and nothing on the preview or the wall
 * changed. The sliders were writing their values; nothing was drawing them.
 * Saving screens in the composer had switched the painted board off
 * altogether, because the composer was written to make the layout choice
 * "step aside" - which treated the painted board as a rival arrangement of
 * content, when it is a look.
 *
 * So the rule held down here: the composer decides which screens and what is
 * on them, the layout decides how each is drawn. A composed screen of prayer
 * times on a painted board is painted.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { zmanimFor } from "@community/lib/minyan-time";

import { DEFAULT_TV_CONFIG, type Screen, type TvConfig } from "./config";
import { TvBoard } from "./TvBoard";
import { buildSlides, type BoardData } from "./useBoardData";

afterEach(cleanup);

const now = new Date("2026-09-16T10:00:00+03:00");
const z = zmanimFor(now, null);

const data: BoardData = {
  settings: null,
  minyanim: [],
  categories: [],
  announcements: [],
  shiurim: [],
  overrides: [],
  stale: false,
  anyLoaded: true,
  sync: { status: "live", lastSyncedAt: null },
};

function draw(config: TvConfig) {
  const slides = buildSlides(data, config, now, z);
  return render(
    <TvBoard
      data={data}
      config={config}
      now={now}
      zmanim={z}
      slides={slides}
      index={0}
      cycle={0}
      progress={0}
      paused={false}
    />,
  );
}

const screens: Screen[] = [
  { id: "board", name: "הלוח", seconds: 40, blocks: [{ block: "prayers" }, { block: "zmanim" }] },
];

const painted = (look: Partial<TvConfig["illustratedStyle"]> = {}): TvConfig => ({
  ...structuredClone(DEFAULT_TV_CONFIG),
  screenLayout: "illustrated",
  illustration: "modern",
  illustratedStyle: { ...DEFAULT_TV_CONFIG.illustratedStyle, ...look },
  screens,
});

describe("the painted look on a composed board", () => {
  it("still paints the board, rather than switching it off", () => {
    const { container } = draw(painted());
    expect(container.querySelector(".tv-ill")).toBeTruthy();
  });

  it("the picture sliders reach the picture", () => {
    const { container } = draw(painted({ brightness: 1.35, saturation: 1.25, hue: 55 }));
    const picture = container.querySelector(".tv-ill-picture") as HTMLElement | null;
    expect(picture, "no painted picture on the board").toBeTruthy();
    expect(picture!.style.filter).toContain("brightness(1.35)");
    expect(picture!.style.filter).toContain("saturate(1.25)");
    expect(picture!.style.filter).toContain("hue-rotate(55deg)");
  });

  it("and moving one changes what is drawn", () => {
    const before = (draw(painted({ brightness: 1 })).container.querySelector(".tv-ill-picture") as HTMLElement)
      .style.filter;
    cleanup();
    const after = (draw(painted({ brightness: 1.5 })).container.querySelector(".tv-ill-picture") as HTMLElement)
      .style.filter;
    expect(after).not.toBe(before);
  });

  it("a screen with nothing the painting holds is drawn as an ordinary screen", () => {
    // The painted board has frames for the prayer times and the zmanim and
    // nothing else; a screen of only the daf yomi has no place in it.
    const learningOnly: TvConfig = {
      ...painted(),
      screens: [{ id: "l", name: "לימוד", seconds: 40, blocks: [{ block: "learning" }] }],
    };
    const { container } = draw(learningOnly);
    expect(container.querySelector(".tv-ill")).toBeNull();
    expect(container.querySelector(".tv-composed")).toBeTruthy();
  });

  it("leaves a board with no composer exactly as it was", () => {
    const plain: TvConfig = { ...painted(), screens: undefined };
    const { container } = draw(plain);
    expect(container.querySelector(".tv-ill")).toBeTruthy();
  });
});

describe("the day on a board built of screens", () => {
  const cholHamoed = new Date("2026-09-29T10:00:00+03:00");
  /** The board at `at`, showing its first screen - or its first occasion's, with `occasion`. */
  const drawAt = (config: TvConfig, at: Date, occasion = false) => {
    const zm = zmanimFor(at, null);
    const slides = buildSlides(data, config, at, zm);
    const index = occasion ? Math.max(0, slides.findIndex((s) => s.kind === "occasion")) : 0;
    return render(
      <TvBoard data={data} config={config} now={at} zmanim={zm} slides={slides} index={index} cycle={0} progress={0} paused={false} />,
    );
  };

  it("beside the prayer times, is a line along the bottom and hides nothing", () => {
    const withDay = painted();
    withDay.screens = [{ ...screens[0], blocks: [...screens[0].blocks, { block: "festival" }] }];
    const { container } = drawAt(withDay, cholHamoed);
    expect(container.querySelector(".tv-ill"), "the painted board is still drawn").toBeTruthy();
    expect(container.querySelector(".tv-event-banner")?.textContent).toContain("חול המועד סוכות");
    // Not the day's full screen over the board.
    expect(container.querySelector(".tv-event-splash:not(.is-banner)")).toBeNull();
  });

  it("carries the countdown on its line, rather than covering it", () => {
    // אהל אברהם, הושענא רבה 2.10.2026: the day's line and "הדלקת נרות בעוד"
    // both stood centred at the foot of the board, one over the other.
    const withDay = painted();
    withDay.screens = [{ ...screens[0], blocks: [...screens[0].blocks, { block: "festival" }] }];
    withDay.alerts = { enabled: true, events: ["sunset"], leadMinutes: [10], popupSeconds: 10 };
    const sunset = zmanimFor(cholHamoed, null).sunset!;
    const { container } = drawAt(withDay, new Date(sunset.getTime() - 5 * 60_000));
    expect(container.querySelector(".tv-event-banner")?.textContent).toContain("שקיעה בעוד");
    expect(container.querySelector(".tv-alert-chip")).toBeNull();
  });

  it("alone on its screen, is the day's full screen - also in the admin's preview", () => {
    const dayOnly = painted();
    dayOnly.screens = [{ id: "festival", name: "מסך החג", seconds: 40, blocks: [{ block: "festival" }] }];
    const { container } = drawAt(dayOnly, cholHamoed, true);
    expect(container.querySelector(".tv-event-splash:not(.is-banner)")).toBeTruthy();
    expect(container.querySelector(".tv-event-title")?.textContent).toContain("סוכות");
  });
});

describe("Shabbat on a board built of screens", () => {
  it("is Shabbat's screen over the whole board, not the painting", () => {
    const at = new Date("2026-10-10T10:00:00+03:00");
    const config = painted();
    config.screens = [...screens, { id: "shabbat", name: "מסך השבת", seconds: 40, blocks: [{ block: "shabbat" }] }];
    const zm = zmanimFor(at, null);
    const slides = buildSlides(data, config, at, zm);
    const { container } = render(
      <TvBoard data={data} config={config} now={at} zmanim={zm} slides={slides} index={0} cycle={0} progress={0} paused={false} />,
    );
    expect(container.querySelector('.tv-occasion[data-occasion="shabbat"]')).toBeTruthy();
    expect(container.querySelector(".tv-event-title")?.textContent).toBe("שבת שלום");
    expect(container.querySelector(".tv-ill")).toBeNull();
  });
});

describe("the medallion, on a board built of screens", () => {
  const at = new Date("2026-10-14T10:00:00+03:00");
  const draw = (blocks: Screen["blocks"]) => {
    const config: TvConfig = {
      ...structuredClone(DEFAULT_TV_CONFIG),
      screenLayout: "medallion",
      screens: [{ id: "s", name: "מסך", seconds: 20, blocks }],
    };
    const zm = zmanimFor(at, null);
    const slides = buildSlides(data, config, at, zm);
    return render(
      <TvBoard data={data} config={config} now={at} zmanim={zm} slides={slides} index={0} cycle={0} progress={0} paused={false} />,
    ).container;
  };

  it("shows what is ticked on the screen, and only that", () => {
    const withLearning = draw([{ block: "prayers" }, { block: "learning" }]);
    expect(withLearning.querySelector(".tv-med")).toBeTruthy();
    expect(withLearning.querySelector('.tv-med-cell[data-block="learning"]'), "the daf yomi gets a frame").toBeTruthy();
    expect(withLearning.querySelector('[data-frame="zmanim"]'), "the zmanim were not ticked").toBeNull();
    cleanup();
    const zmanimOnly = draw([{ block: "zmanim" }]);
    expect(zmanimOnly.querySelector(".tv-med")).toBeTruthy();
    expect(zmanimOnly.querySelector('[data-frame="prayers"]')).toBeNull();
    expect(zmanimOnly.querySelector('[data-frame="zmanim"]')).toBeTruthy();
  });
});

describe("a screen's bars", () => {
  const at = new Date("2026-10-14T10:00:00+03:00");
  const draw = (layout: TvConfig["screenLayout"], blocks: Screen["blocks"]) => {
    const config: TvConfig = {
      ...structuredClone(DEFAULT_TV_CONFIG),
      screenLayout: layout,
      screens: [{ id: "s", name: "מסך", seconds: 20, blocks }],
    };
    const zm = zmanimFor(at, null);
    return render(
      <TvBoard data={data} config={config} now={at} zmanim={zm} slides={buildSlides(data, config, at, zm)} index={0} cycle={0} progress={0} paused={false} />,
    ).container;
  };

  it("on the medallion: the plaques, the clock and the strip each follow their switch", () => {
    const all = draw("medallion", [{ block: "header" }, { block: "clock" }, { block: "footer" }, { block: "prayers" }]);
    expect(all.querySelector(".tv-med-plaque")).toBeTruthy();
    expect(all.querySelector(".tv-med-clock")).toBeTruthy();
    expect(all.querySelector(".tv-med-strip")).toBeTruthy();
    cleanup();
    const bare = draw("medallion", [{ block: "clock" }, { block: "prayers" }]);
    expect(bare.querySelector(".tv-med-plaque")).toBeNull();
    expect(bare.querySelector(".tv-med-clock")).toBeTruthy();
    expect(bare.querySelector(".tv-med-strip")).toBeNull();
  });

  it("on the other layouts: the name at the top, and the clock, each follow their switch", () => {
    const noName = draw("rotate", [{ block: "clock" }, { block: "prayers" }]);
    expect(noName.querySelector(".tv-title")).toBeNull();
    expect(noName.querySelector(".tv-clock")).toBeTruthy();
    cleanup();
    const nothing = draw("rotate", [{ block: "prayers" }]);
    expect(nothing.querySelector(".tv-header")).toBeNull();
  });
});

describe("the board's logos", () => {
  const at = new Date("2026-10-14T10:00:00+03:00");
  const effi = { id: "effi", name: "אפי קפיטל", url: "https://x/light.png", urlDark: "https://x/dark.png" };
  const draw = (layout: TvConfig["screenLayout"], blocks: Screen["blocks"], logos = [effi], theme?: string) => {
    const config: TvConfig = {
      ...structuredClone(DEFAULT_TV_CONFIG),
      ...(theme ? { theme } : {}),
      screenLayout: layout,
      logos,
      screens: [{ id: "s", name: "מסך", seconds: 20, blocks }],
    };
    const zm = zmanimFor(at, null);
    return render(
      <TvBoard data={data} config={config} now={at} zmanim={zm} slides={buildSlides(data, config, at, zm)} index={0} cycle={0} progress={0} paused={false} />,
    ).container;
  };
  const srcs = (c: HTMLElement) => [...c.querySelectorAll(".tv-logos img, .tv-med-logos img")].map((i) => i.getAttribute("src"));

  it("shows the chosen logos where the screen's switch is on, and nothing that is not chosen", () => {
    expect(srcs(draw("rotate", [{ block: "header" }, { block: "logo" }, { block: "prayers" }])).length).toBe(1);
    cleanup();
    expect(srcs(draw("rotate", [{ block: "header" }, { block: "prayers" }]))).toEqual([]);
    cleanup();
    expect(srcs(draw("rotate", [{ block: "header" }, { block: "logo" }, { block: "prayers" }], []))).toEqual([]);
    cleanup();
    expect(srcs(draw("medallion", [{ block: "logo" }, { block: "prayers" }])).length).toBe(1);
  });

  it("draws the dark cut on a dark board and the light one on a light board", () => {
    expect(srcs(draw("medallion", [{ block: "logo" }, { block: "prayers" }], [effi], "navy"))).toEqual(["https://x/dark.png"]);
    cleanup();
    expect(srcs(draw("medallion", [{ block: "logo" }, { block: "prayers" }], [effi], "stone"))).toEqual(["https://x/light.png"]);
  });

  it("no logo of anybody's is built into the board any more", () => {
    expect(srcs(draw("rotate", [{ block: "header" }, { block: "logo" }, { block: "prayers" }], []))).toEqual([]);
  });
});
