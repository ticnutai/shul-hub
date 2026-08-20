import { chromium, devices } from "@playwright/test";

const pages = [
  ["home", "https://shul-hub.lovable.app/"],
  ["shiurim", "https://shul-hub.lovable.app/shiurim"],
  ["announcements", "https://shul-hub.lovable.app/announcements"],
  ["chavrutot", "https://shul-hub.lovable.app/chavrutot"],
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  ...devices["Pixel 5"],
  locale: "he-IL",
  timezoneId: "Asia/Jerusalem",
});

for (const [name, url] of pages) {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.addStyleTag({
    content: `
      [id*="lovable" i], [class*="lovable" i],
      iframe[src*="lovable" i], a[href*="lovable.dev" i] {
        display: none !important;
        visibility: hidden !important;
      }
    `,
  });
  const badgeText = page.getByText(/Edit with/i);
  if (await badgeText.count()) {
    await badgeText.first().evaluate((node) => {
      const container = node.closest("div, a, button") ?? node;
      container.style.setProperty("display", "none", "important");
    });
  }
  await page.screenshot({ path: new URL(`./${name}-mobile-raw.png`, import.meta.url).pathname.slice(1) });
  await page.close();
}

await browser.close();
