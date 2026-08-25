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
  await page.evaluate(() => localStorage.setItem("torah-theme", JSON.stringify("torah-luxury")));
  await page.reload();

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
  }));
  expect(colors.icon).toBe(colors.text);
  expect(colors.border).not.toBe("rgba(0, 0, 0, 0)");
  expect(colors.navBackground).toBe("rgba(0, 0, 0, 0)");

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/torah-luxury/);
});
