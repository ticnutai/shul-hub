import type { Page } from "@playwright/test";

/**
 * Every page of the site asks a first-time visitor which synagogue they came
 * to, when more than one is open to the public - the siddur and the login as
 * much as the community page. A test that is not about that choice makes it
 * up front, the way the site itself remembers it (community.ts), so the page
 * it wants is the page it gets.
 */
export async function rememberShul(page: Page, slug = "main") {
  await page.addInitScript((s) => {
    try {
      localStorage.setItem("shul-hub.community", s);
    } catch {
      /* storage closed: the chooser will show, and the test will say so */
    }
  }, slug);
}
