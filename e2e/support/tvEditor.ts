import type { Page, Route } from "@playwright/test";

/**
 * The editor, with its database answered from here.
 *
 * The TV editor is admin-only, and a test machine has no session. Rather than
 * skip the editor's own tests (as the admin specs do when no credentials are
 * configured), every Supabase call it makes is answered with a fixture, so
 * the real panel runs against a known board on any machine.
 *
 * `saved` holds what the "database" currently has, so a save can be read back
 * and a discard can be checked against it.
 */
export interface EditorServer {
  /** The config the fake database holds, as the editor last saved it. */
  saved: () => Record<string, unknown>;
  /** How many times the editor wrote to it. */
  writes: () => number;
}

const SETTINGS = {
  id: "default",
  name: "בית הכנסת אושר של יהודי",
  address: "מצדה 9, בני ברק",
  city: "בני ברק",
  latitude: 32.0853,
  longitude: 34.7818,
  timezone: "Asia/Jerusalem",
  candle_lighting_minutes: 20,
  havdalah_minutes: 42,
};

const minyan = (id: string, label: string, fixed: string, order: number) => ({
  id,
  label,
  prayer: label,
  day_type: "weekday",
  time_mode: "fixed",
  fixed_time: fixed,
  relative_to: null,
  offset_minutes: 0,
  category_id: "c1",
  sort_order: order,
  active: true,
  note: "",
  room: "",
  reminder_minutes: 0,
  notification_enabled: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

const MINYANIM = [minyan("m1", "שחרית א'", "06:15:00", 1), minyan("m2", "מנחה", "13:30:00", 2)];

const CATEGORIES = [{ id: "c1", name: "ימות החול", sort_order: 1, active: true }];

const ANNOUNCEMENTS = [
  // A deliberately long notice: the card has to shrink its type to fit it
  // (src/tv/useFitText.ts) instead of cutting the last lines off.
  {
    id: "a2",
    title: "הודעה ארוכה במיוחד לבדיקת ההתאמה האוטומטית של גודל הטקסט",
    body: [
      "הציבור מתבקש לשים לב לשינויים בזמני התפילות בשבוע הקרוב, בעקבות ימי החג.",
      "שחרית תתקיים בשעה שש וחצי, מנחה עשר דקות לפני השקיעה, וערבית מיד אחריה.",
      "בנוסף, השיעור הקבוע של יום שלישי יתקיים השבוע ביום רביעי באותה השעה.",
      "מי שמעוניין להצטרף לסעודה שלישית מתבקש להירשם אצל הגבאים עד יום חמישי.",
      "תודה לכל המתנדבים שסייעו בהכנת בית הכנסת, ויישר כוח לכל הקהל הקדוש.",
    ].join("\n"),
    active: true,
    sort_order: 1,
    starts_at: null,
    ends_at: null,
    image_url: null,
  },
  { id: "a1", title: "שיעור העמוד היומי", body: "כל יום בשעה 16:15", active: true, sort_order: 2, starts_at: null, ends_at: null, image_url: null },
];

const SHIURIM = [
  { id: "s1", title: "דף יומי", teacher: "הרב נתי פורטנוי", time_text: "08:45", days: [0, 1, 2, 3, 4], active: true, sort_order: 1 },
];

/** Answers every request the editor makes, and remembers what it saved. */
export async function serveEditor(page: Page, config: Record<string, unknown> = {}): Promise<EditorServer> {
  let saved: Record<string, unknown> = config;
  let writes = 0;

  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

  await page.route("**/auth/v1/**", (route) =>
    json(route, { id: "00000000-0000-0000-0000-000000000001", email: "qa@example.com" }),
  );

  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split("/rest/v1/")[1]?.split("?")[0] ?? "";
    const method = request.method();

    if (method === "PATCH" || method === "POST" || method === "PUT") {
      if (table === "tv_config") {
        const body = request.postDataJSON() as { config?: Record<string, unknown> };
        if (body?.config) saved = body.config;
        writes += 1;
      }
      return json(route, [], 204);
    }

    switch (table) {
      case "tv_config":
        // .maybeSingle() asks for one row.
        return json(route, { config: saved, updated_at: new Date().toISOString() });
      case "tv_devices":
        return json(route, []);
      case "settings":
        return json(route, SETTINGS);
      case "minyanim":
        return json(route, MINYANIM);
      case "minyan_categories":
        return json(route, CATEGORIES);
      case "announcements":
        return json(route, ANNOUNCEMENTS);
      case "shiurim":
        return json(route, SHIURIM);
      default:
        return json(route, []);
    }
  });

  return { saved: () => saved, writes: () => writes };
}

/**
 * Nothing on the page has been left unclickable.
 *
 * A modal that closes badly leaves `pointer-events: none` on the body, and
 * the board then looks perfectly fine while nothing responds - the freeze
 * that was reported twice. The sentinel button lives outside every panel, so
 * a click that does not reach it means the page is stuck.
 */
export async function expectNotFrozen(page: Page, step: string): Promise<void> {
  // A dialog locks the page while it closes; that is fine as long as it lets
  // go. Anything still locked after two seconds is the freeze itself.
  const deadline = Date.now() + 2000;
  let pointerEvents = "none";
  while (Date.now() < deadline) {
    pointerEvents = await page.evaluate(() => getComputedStyle(document.body).pointerEvents);
    if (pointerEvents !== "none") break;
    await page.waitForTimeout(100);
  }
  if (pointerEvents === "none") throw new Error(`the page is frozen after: ${step}`);
  const before = await page.evaluate(() => (window as { __sentinel?: number }).__sentinel ?? 0);
  await page.locator("#sentinel").click({ timeout: 4000 });
  const after = await page.evaluate(() => (window as { __sentinel?: number }).__sentinel ?? 0);
  if (after !== before + 1) throw new Error(`a click did not reach the page after: ${step}`);
}
