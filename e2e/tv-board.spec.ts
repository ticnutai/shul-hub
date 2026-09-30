import { expect, hasAdmin, test } from "./support/admin";
import { chooseDevice, openDeviceMenu } from "./support/deviceMenu";

/**
 * The wall board: the admin control center (screens, live editor, device
 * studio, click-to-edit, reports), the board in a browser (/admin/tv-board)
 * and the TV bundle itself.
 *
 * Read-only against the live project: nothing here presses "שמור ושדר",
 * sends a command to a real screen, or registers a new screen.
 *
 *   QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD   admin specs (skipped without them)
 *   TV_BASE_URL                          the TV bundle (npm run tv:preview),
 *                                        default http://127.0.0.1:4320
 */

const TV_BASE_URL = process.env.TV_BASE_URL ?? "http://127.0.0.1:4320";

/**
 * The synagogue's name on the board, wherever this layout puts it.
 *
 * These specs run against the design the gabbai has actually saved, and that
 * design changes. It was the rotating board when they were written, then the
 * full board - which is what broke the slide-dot assertion once already - and
 * it is now the painted one, which draws the name in a plaque or along a bar
 * and has no `.tv-title` anywhere. Three layouts, three pieces of markup for
 * one piece of information.
 */
const BOARD_NAME = ":is(.tv-title, .tv-ill-name-big, .tv-ill-bar)";

/**
 * These specs manage the main synagogue. With more than one open to the
 * public, a visitor who has not chosen is first asked which - so the choice
 * is made here, as a returning visitor's browser would already have it.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      if (!localStorage.getItem("shul-hub.community")) localStorage.setItem("shul-hub.community", "main");
    } catch {
      /* private mode */
    }
  });
});

/**
 * That a board really drew, rather than that one layout's markup exists.
 *
 * Every assertion here that named a class has failed the day the saved design
 * moved on, and each time the fix was to chase the new class. The question
 * these tests are actually asking is whether the board came up with something
 * on it, so that is what they ask now - the frame is there and it has text -
 * and the answer stays the same whichever layout the gabbai chooses next.
 */
async function expectBoardDrawn(frame: import("@playwright/test").Locator) {
  await expect(frame).toBeVisible();
  await expect(frame.locator(".tv-root")).toBeVisible();
  expect((await frame.innerText()).trim().length).toBeGreaterThan(0);
}

function collectErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function noHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

/* --------------------------------------------------------------- guests -- */

test("the browser board is for administrators only", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/admin/tv-board");
  await expect(page.getByText("תצוגת הלוח בדפדפן זמינה למנהלים בלבד")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".tv-frame")).toHaveCount(0);
  expect(errors).toEqual([]);
});

/* ---------------------------------------------------------------- admin -- */

test.describe("administrator", () => {
  test.skip(!hasAdmin, "QA admin credentials are not configured");

  test("every management tab opens, including the TV board", async ({ adminPage: page }, testInfo) => {
    const errors = collectErrors(page);
    await page.goto("/community/admin");
    await expect(page.getByRole("tab", { name: "מניינים" })).toBeVisible({ timeout: 20_000 });
    // "הגדרות" is gone: the synagogue's details are in its window under "בתי
    // כנסת", the site header and themes in "תצוגת דף הבית".
    for (const name of ["מודעות", "שיעורים", "חברותות", "בקשות חברותא", "הודעות", "תצוגת דף הבית", "משתמשים", "ייצוא/ייבוא", "קודי QR", "תצוגות", "מניינים"]) {
      const tab = page.getByRole("tab", { name: new RegExp(name) }).first();
      await tab.click();
      await expect(tab).toHaveAttribute("data-state", "active");
    }
    await expect(page.getByRole("tab", { name: "הגדרות" })).toHaveCount(0);
    await page.getByRole("button", { name: /בתי כנסת|פרטי בית הכנסת/ }).first().click();
    await expect(page.getByRole("heading", { name: "בתי הכנסת" })).toBeVisible();
    await noHorizontalOverflow(page);
    await testInfo.attach("admin", { body: await page.screenshot(), contentType: "image/png" });
    expect(errors).toEqual([]);
  });

  test("TV tab: screens, reports and the editor all render", async ({ adminPage: page }, testInfo) => {
    const errors = collectErrors(page);
    await page.goto("/community/admin?tab=tv&tvTab=screens");
    await expect(page.getByRole("tab", { name: "מסכים מחוברים" })).toHaveAttribute("data-state", "active", { timeout: 20_000 });
    await expect(page.getByLabel("קוד צימוד")).toBeVisible();
    await testInfo.attach("screens", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });

    await page.getByRole("tab", { name: /דוחות ויומן/ }).click();
    await expect(page.getByRole("heading", { name: "ניתוקים" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "יומן אירועים" })).toBeVisible();
    for (const period of ["24 שעות", "7 ימים", "30 ימים"]) await page.getByRole("button", { name: period }).click();
    await testInfo.attach("logs", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });

    await page.getByRole("tab", { name: /התצוגות והעיצוב/ }).click();
    await expect(page.getByRole("button", { name: /שמור ושדר/ }).first()).toBeVisible();
    await expect(page.locator(".tv-frame").first()).toBeVisible();
    await expect(page.getByText("הכל שמור").first()).toBeVisible();
    await noHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test("device studio shows the board on every kind of screen", async ({ adminPage: page }, testInfo) => {
    const errors = collectErrors(page);
    await page.goto("/community/admin?tab=tv&tvTab=design");
    await expect(page.getByTestId("device-menu").first()).toBeVisible({ timeout: 20_000 });

    for (const [device, size] of [
      ["Android TV", "960×540"],
      ["מחשב", "1920×"],
      ["לפטופ", "1440×"],
      ["טאבלט", "×"],
      ["מובייל", "390×"],
    ] as const) {
      await chooseDevice(page, device);
      // The menu closes on a choice; its button says what was chosen.
      await expect(page.getByTestId("device-menu").first()).toContainText(device);
      await expect(page.getByText(size, { exact: false }).first()).toBeVisible();
      await expectBoardDrawn(page.locator(".tv-frame").first());
      await testInfo.attach(`device-${device}`, { body: await page.locator(".tv-frame").first().screenshot(), contentType: "image/png" });
    }

    // The phone is drawn in portrait: the one-column layout must apply.
    const unit = await page.locator(".tv-root").first().evaluate((el) => getComputedStyle(el).getPropertyValue("--u").trim());
    expect(unit).toContain("cqw");

    await openDeviceMenu(page);
    await page.getByRole("button", { name: "לרוחב" }).click();
    await expect(page.getByRole("button", { name: "לאורך" })).toBeVisible();
    await page.getByRole("button", { name: "לאורך" }).click();

    await chooseDevice(page, "כל המסכים");
    // "All screens" shows one board by default - the change applies to every
    // device - and only draws the five side by side once comparison is on.
    // The button appeared after these specs were written, and without it the
    // count is 1, which read as the studio having broken.
    await page.getByRole("button", { name: /השוואה בין התצוגות/ }).click();
    await expect(page.locator(".tv-frame")).toHaveCount(5);
    await testInfo.attach("all-devices", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    await chooseDevice(page, "Android TV");
    expect(errors).toEqual([]);
  });

  test("click-to-edit changes the draft on every screen and undoes cleanly", async ({ adminPage: page }) => {
    const errors = collectErrors(page);
    await page.goto("/community/admin?tab=tv&tvTab=design");
    await expect(page.getByText("הכל שמור").first()).toBeVisible({ timeout: 20_000 });
    await chooseDevice(page, "כל המסכים");
    // "All screens" shows one board by default - the change applies to every
    // device - and only draws the five side by side once comparison is on.
    // The button appeared after these specs were written, and without it the
    // count is 1, which read as the studio having broken.
    await page.getByRole("button", { name: /השוואה בין התצוגות/ }).click();
    await expect(page.locator(".tv-frame")).toHaveCount(5);

    await page.getByRole("button", { name: "עריכה ישירה בלוח" }).click();
    await expect(page.locator("[data-edit]").first()).toBeVisible();

    // Rename (board only), on all five devices at once.
    await page.locator('[data-edit="header.title"]').first().click();
    const field = page.getByLabel("שם בית הכנסת", { exact: true });
    const original = await field.inputValue();
    await field.fill("בדיקת E2E");
    await expect(page.locator(BOARD_NAME).filter({ hasText: "בדיקת E2E" })).toHaveCount(5);
    await expect(page.getByText("יש שינויים שלא נשמרו").first()).toBeVisible();

    // Move: clock and name swap sides. Only the layouts with a header bar
    // have sides to swap - the painted board draws the name into the picture -
    // so this asks whether there is one rather than assuming the saved design
    // is still the one these specs were written against.
    const hasHeader = (await page.locator(".tv-header").count()) > 0;
    if (hasHeader) {
      await page.getByRole("button", { name: /החלפת צד: שם בית הכנסת/ }).click();
      await expect(page.locator(".tv-header.is-flipped")).toHaveCount(5);
    }

    // Hide and bring back from the hidden list.
    await page.getByRole("button", { name: "הסתרה מהלוח" }).click();
    await expect(page.locator(BOARD_NAME).filter({ hasText: "בדיקת E2E" })).toHaveCount(0);
    await page.locator("button.border-dashed", { hasText: "שם בית הכנסת" }).click();
    await expect(page.locator(BOARD_NAME).filter({ hasText: "בדיקת E2E" })).toHaveCount(5);

    // A single zman.
    await page.locator('[data-edit="zman.alot"]').first().click();
    await page.getByRole("button", { name: "הסתרה מהלוח" }).click();
    await expect(page.locator('[data-edit="zman.alot"]')).toHaveCount(0);

    // Undo everything: back to exactly what is saved.
    const undo = page.getByRole("button", { name: "ביטול (Ctrl+Z)" });
    for (let i = 0; i < 30 && (await undo.isEnabled()); i++) await undo.click();
    await expect(page.getByText("הכל שמור").first()).toBeVisible();
    await expect(page.locator(BOARD_NAME).first()).toContainText(original);
    if (hasHeader) await expect(page.locator(".tv-header.is-flipped")).toHaveCount(0);

    await page.getByRole("button", { name: "סיום עריכה בלוח" }).click();
    await expect(page.locator("[data-edit]")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("editor controls: themes, fonts, slides, alert preview and undo", async ({ adminPage: page }) => {
    const errors = collectErrors(page);
    await page.goto("/community/admin?tab=tv&tvTab=design");
    await expect(page.getByText("הכל שמור").first()).toBeVisible({ timeout: 20_000 });
    const root = page.locator(".tv-root").first();
    const accent = () => root.evaluate((el) => getComputedStyle(el).getPropertyValue("--tv-accent").trim());
    const before = await accent();

    for (const theme of ["זהב מלכותי", "ירוק שבת", "מודרני", "לילה כחול"]) {
      await page.getByRole("button", { name: new RegExp(theme) }).first().click();
      await expect(page.getByRole("button", { name: new RegExp(theme) }).first()).toHaveAttribute("aria-pressed", "true");
    }
    await page.getByRole("button", { name: /זהב מלכותי/ }).first().click();
    await expect.poll(accent).not.toBe(before);

    // The text size is a slider under "טקסט" (the painted board has its own of the same name).
    await page.getByTestId("layer-text").getByLabel("גודל הטקסט", { exact: true }).fill("1.1");
    for (const tab of await page.getByRole("tab").filter({ hasText: /^\d+\./ }).all()) await tab.click();

    await page.getByRole("button", { name: "דוגמת התראת זמנים" }).click();
    await expect(page.locator(".tv-alert-card, .tv-alert-chip").first()).toBeVisible();

    const undo = page.getByRole("button", { name: "ביטול (Ctrl+Z)" });
    for (let i = 0; i < 30 && (await undo.isEnabled()); i++) await undo.click();
    await expect(page.getByText("הכל שמור").first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("the board full screen in a browser: controls, swipe keys and the 3-second pause icon", async ({ adminPage: page }, testInfo) => {
    const errors = collectErrors(page);
    await page.goto("/admin/tv-board");
    await expectBoardDrawn(page.locator(".tv-frame").first());
    await expect(page.locator(".tv-pairing")).toHaveCount(0); // not registered as a screen

    // The control bar wakes on movement and fades again on its own, so every
    // press has to wake it first. Without that the click lands on a toolbar
    // already fading - Playwright waits for it to be "stable" and times out -
    // and the failure reads as a broken control rather than a hidden one.
    const wake = async () => {
      await page.mouse.move(200, 200);
      await page.mouse.move(210, 205);
    };
    await wake();
    const bar = page.getByRole("toolbar", { name: "שליטה בלוח" });
    await expect(bar).toBeVisible();
    await testInfo.attach("browser-board", { body: await page.screenshot(), contentType: "image/png" });

    // Which slide is showing. The dots exist only in the rotating layout, so
    // the "full board" layout (everything at once) is reported as a single
    // step - the test then checks the controls, not the slide movement.
    const rotating = (await page.locator(".tv-dot").count()) > 0;
    const dot = () =>
      rotating
        ? page.locator(".tv-dot.is-active").evaluate((d) => [...d.parentElement!.children].indexOf(d))
        : Promise.resolve(0);
    const start = await dot();
    await wake();
    await bar.getByRole("button", { name: "השקופית הבאה" }).click();
    if (rotating) await expect.poll(dot).not.toBe(start);
    await page.keyboard.press("ArrowRight");
    await expect.poll(dot).toBe(start);

    // Enter on a focused button presses that button - it must not pause.
    await wake();
    await bar.getByRole("button", { name: "השקופית הבאה" }).focus();
    const beforeEnter = await dot();
    await page.keyboard.press("Enter");
    if (rotating) await expect.poll(dot).not.toBe(beforeEnter);
    // Enter pressed a button, so the board must not have paused.
    await expect(page.locator(".tv-paused")).toHaveCount(0);
    await page.keyboard.press("ArrowRight");
    await page.mouse.move(210, 210);

    // Pause: the icon shows, then hides by itself after 3 seconds.
    await bar.getByRole("button", { name: /עצירה/ }).click();
    await expect(page.locator(".tv-paused")).toHaveText("⏸ מושהה");
    await expect(page.locator(".tv-paused")).toHaveCount(0, { timeout: 5_000 });
    await expect(bar.getByRole("button", { name: /המשך/ })).toBeVisible();
    await page.keyboard.press(" ");
    await expect(page.locator(".tv-paused")).toHaveText("▶ ממשיך");
    await expect(page.locator(".tv-paused")).toHaveCount(0, { timeout: 5_000 });

    // The bar and the cursor hide when idle.
    await expect(bar).toHaveClass(/is-hidden/, { timeout: 6_000 });
    await expect(page.locator(".tv-frame.is-idle")).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test("the browser board on a phone uses the portrait layout", async ({ adminPage: page, isMobile }, testInfo) => {
    test.skip(!isMobile, "phone project only");
    await page.goto("/admin/tv-board");
    await expectBoardDrawn(page.locator(".tv-frame").first());
    // The portrait rule is the one thing this asks, and only the layouts
    // with a header bar have one to stack - the painted board draws its own
    // and has no `.tv-header` at all. Ask the board what unit it is sized in
    // instead, which every layout answers and which is what portrait sets.
    const unit = await page.locator(".tv-root").first().evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--u").trim(),
    );
    expect(unit).toContain("cq");
    const header = page.locator(".tv-header");
    if (await header.count())
      expect(await header.evaluate((el) => getComputedStyle(el).flexDirection)).toBe("column");
    await noHorizontalOverflow(page);
    await testInfo.attach("phone-board", { body: await page.screenshot(), contentType: "image/png" });
  });
});

/* ---------------------------------------------------------- TV bundle -- */

test.describe("TV bundle", () => {
  test.skip(({ isMobile }) => isMobile, "the TV is landscape only");

  test.beforeEach(async ({ page }) => {
    // Never register this browser as a screen in the live project.
    await page.route(/\/rest\/v1\/rpc\/tv_(register|heartbeat|log|put_snapshot)/, (route) =>
      route.fulfill({ status: 503, body: "{}" }),
    );
    await page.setViewportSize({ width: 960, height: 540 });
  });

  test("renders the board with no editor markup and no endless animation at idle", async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    const res = await page.goto(TV_BASE_URL).catch(() => null);
    test.skip(!res, `TV bundle not served at ${TV_BASE_URL} (npm run tv:preview)`);
    await expectBoardDrawn(page.locator(".tv-frame").first());
    await expect(page.locator("[data-edit]")).toHaveCount(0);
    await expect(page.locator(".tv-web-bar")).toHaveCount(0);

    // Measured on the box: any endless animation costs ~45% CPU.
    await page.waitForTimeout(2_000);
    const endless = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations === Infinity && a.playState === "running")
        .map((a) => (a.effect as KeyframeEffect).target?.className ?? "?"),
    );
    expect(endless).toEqual([]);

    // The burn-in guard moves the background on every slide change. It must
    // JUMP: animating it repainted the full screen for four seconds out of
    // every twenty, which was two thirds of the board CPU on the TV box.
    const drift = await page
      .locator(".tv-bg")
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(drift === "0s" || drift === "").toBe(true);
    await testInfo.attach("tv", { body: await page.screenshot(), contentType: "image/png" });
    expect(errors).toEqual([]);
  });

  test("remote: OK pauses with a 3-second icon, arrows change slide, help opens", async ({ page }) => {
    const res = await page.goto(TV_BASE_URL).catch(() => null);
    test.skip(!res, `TV bundle not served at ${TV_BASE_URL}`);
    await expectBoardDrawn(page.locator(".tv-frame").first());

    await page.keyboard.press("Enter");
    await expect(page.locator(".tv-paused")).toHaveText("⏸ מושהה");
    await page.waitForTimeout(3_300);
    await expect(page.locator(".tv-paused")).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect(page.locator(".tv-paused")).toHaveText("▶ ממשיך");
    await expect(page.locator(".tv-paused")).toHaveCount(0, { timeout: 5_000 });

    // The dots exist only in the rotating layout; on a full board the arrow
    // key still has to answer with a toast, and that is what is checked.
    const rotating = (await page.locator(".tv-dot").count()) > 0;
    const dot = () =>
      rotating
        ? page.locator(".tv-dot.is-active").evaluate((d) => [...d.parentElement!.children].indexOf(d))
        : Promise.resolve(0);
    const start = await dot();
    await page.keyboard.press("ArrowLeft");
    if (rotating) await expect.poll(dot).not.toBe(start);
    await expect(page.locator(".tv-toast")).toBeVisible();

    await page.keyboard.press("m");
    await expect(page.getByRole("heading", { name: "שליטה בשלט" })).toBeVisible();
    await page.keyboard.press("m");
    await expect(page.getByRole("heading", { name: "שליטה בשלט" })).toHaveCount(0);
  });
});
