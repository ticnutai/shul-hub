import { expect, test } from "@playwright/test";

test.describe("Android safe areas", () => {
  test("community header and page footer stay outside system bars", async ({ page }) => {
    await page.goto("/community");
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--safe-area-inset-top", "32px");
      document.documentElement.style.setProperty("--safe-area-inset-bottom", "36px");
    });

    const header = page.locator("header").first();
    const headerRow = header.locator(":scope > div").first();
    await expect(header).toBeVisible();
    await expect(header).toHaveCSS("padding-top", "32px");

    const rowBox = await headerRow.boundingBox();
    expect(rowBox).not.toBeNull();
    expect(rowBox!.y).toBeGreaterThanOrEqual(32);

    const rootPadding = await page.locator("#root").evaluate(element =>
      Number.parseFloat(getComputedStyle(element).paddingBottom),
    );
    expect(rootPadding).toBeGreaterThanOrEqual(36);

    const footerInner = page.locator("footer > div").last();
    await footerInner.scrollIntoViewIfNeeded();
    const footerPadding = await footerInner.evaluate(element =>
      Number.parseFloat(getComputedStyle(element).paddingBottom),
    );
    expect(footerPadding).toBeGreaterThanOrEqual(68);

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
  });
});

test("Torah Luxury remains an optional persisted community theme", async ({ page }) => {
  await page.goto("/community");
  await page.evaluate(() => localStorage.removeItem("torah-theme"));
  await page.reload();
  await expect(page.locator(".primary-destination-item")).toHaveCount(3);
  await page.evaluate(() => document.fonts.ready);
  const baseDimensions = await page.locator(".primary-destination-item").evaluateAll(elements =>
    elements.map(element => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }),
  );
  await page.evaluate(() => localStorage.setItem("torah-theme", JSON.stringify("torah-luxury")));
  await page.reload();
  await page.evaluate(() => document.fonts.ready);

  await expect(page.locator("html")).toHaveClass(/torah-luxury/);
  const nav = page.locator(".primary-destination-nav").first();
  const activeItem = nav.locator('.primary-destination-item[aria-current="page"]');
  await expect(nav).toBeVisible();
  await expect(activeItem).toBeVisible();
  await expect(activeItem).toHaveCSS("border-top-width", "1px");
  await expect(activeItem).toHaveCSS("border-top-style", "solid");

  const colors = await activeItem.evaluate(element => ({
    text: getComputedStyle(element).color,
    icon: getComputedStyle(element.querySelector("svg")!).color,
    border: getComputedStyle(element).borderTopColor,
    navBackground: getComputedStyle(element.parentElement!).backgroundColor,
    itemBackground: getComputedStyle(element).backgroundColor,
    outerBorderWidth: getComputedStyle(element, "::after").borderTopWidth,
    outerContent: getComputedStyle(element, "::after").content,
  }));
  expect(colors.icon).toBe(colors.text);
  expect(colors.border).not.toBe("rgba(0, 0, 0, 0)");
  expect(colors.navBackground).toBe("rgba(0, 0, 0, 0)");
  expect(colors.itemBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(colors.outerBorderWidth).toBe("0px");
  expect(colors.outerContent).toBe("none");

  const themedDimensions = await page.locator(".primary-destination-item").evaluateAll(elements =>
    elements.map(element => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }),
  );
  expect(themedDimensions).toEqual(baseDimensions);

  for (const route of ["/community", "/siddur", "/chumash"]) {
    await page.goto(route);
    const destinationItems = page.locator(".primary-destination-nav").first().locator(".primary-destination-item");
    await expect(destinationItems).toHaveCount(3);
    const independentCards = await destinationItems.evaluateAll(elements => elements.every(element => {
      const style = getComputedStyle(element);
      const outer = getComputedStyle(element, "::after");
      return style.backgroundColor !== "rgba(0, 0, 0, 0)"
        && style.borderTopWidth === "1px"
        && outer.borderTopWidth === "0px"
        && outer.content === "none";
    }));
    expect(independentCards).toBeTruthy();
  }

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/torah-luxury/);
});
