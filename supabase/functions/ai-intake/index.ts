// "עוזר חכם" - turns a photo, a dictated sentence or a pasted message into
// proposed changes to the synagogue's data: minyanim, one-day changes,
// announcements and shiurim.
//
// It only proposes. Nothing is written here: the admin page shows every
// proposal, the gabbai corrects and approves, and the page writes what was
// approved with the admin's own session (RLS applies as for any edit).
//
// Needs the ANTHROPIC_API_KEY secret (Supabase → Edge Functions → Secrets).

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-opus-5";
const MAX_IMAGES = 6;
const MAX_IMAGE_CHARS = 7_000_000; // base64 of about 5 MB
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-community-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const RELATIVE = ["alot", "misheyakir", "sunrise", "chatzot", "mincha_gedola", "plag", "candle", "sunset", "tzeit"];
const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

/** What the model answers with. Every field is required; "none" is null or an empty list. */
const SCHEMA = obj({
  summary: { type: "string", description: "Hebrew, one or two sentences: what was understood." },
  questions: { type: "array", items: { type: "string" }, description: "Hebrew questions about anything unclear." },
  minyanim: {
    type: "array",
    items: obj({
      action: { type: "string", enum: ["create", "update"] },
      existing_id: nullable({ type: "string" }),
      category_id: nullable({ type: "string" }),
      new_category_name: nullable({ type: "string" }),
      prayer: { type: "string" },
      label: { type: "string" },
      time_mode: { type: "string", enum: ["fixed", "relative"] },
      fixed_time: nullable({ type: "string", description: "HH:MM, 24h" }),
      relative_to: nullable({ type: "string", enum: RELATIVE }),
      offset_minutes: { type: "integer", description: "negative = before, positive = after" },
      room: { type: "string" },
      note: { type: "string" },
      confidence: { type: "string", enum: ["high", "low"] },
      reason: { type: "string", description: "Hebrew: where in the input this came from." },
    }),
  },
  overrides: {
    type: "array",
    items: obj({
      minyan_id: { type: "string" },
      on_date: { type: "string", format: "date" },
      at_time: nullable({ type: "string", description: "HH:MM, 24h; null when cancelled" }),
      cancelled: { type: "boolean" },
      note: { type: "string" },
      reason: { type: "string" },
    }),
  },
  announcements: {
    type: "array",
    items: obj({
      kind: { type: "string", enum: ["mazal_tov", "general", "memorial"] },
      title: { type: "string" },
      body: { type: "string" },
      expires_at: nullable({ type: "string", format: "date" }),
      pinned: { type: "boolean" },
      reason: { type: "string" },
    }),
  },
  shiurim: {
    type: "array",
    items: obj({
      title: { type: "string" },
      teacher: { type: "string" },
      description: { type: "string" },
      location: { type: "string" },
      schedule_type: { type: "string", enum: ["weekly", "daily"] },
      day_of_week: { type: "integer", description: "0 = ראשון ... 6 = שבת; ignored when daily" },
      time_text: { type: "string" },
      reason: { type: "string" },
    }),
  },
});

const SYSTEM = `You help the gabbai of a synagogue keep its website and wall board up to date.
The input is a photo (a printed timetable, a notice, a WhatsApp screenshot), a sentence the gabbai
dictated, or a pasted message - in Hebrew. Turn it into proposed changes to the synagogue's data.
The gabbai reviews every proposal before anything is saved, so propose what the input says and flag
what you are unsure of; never invent times, names or dates that are not in the input.

The data:
- Minyanim belong to a category (a tab such as ימות החול / יום שישי / שבת). Use the category ids you
  are given. If no category fits (for example the input is about Shabbat and there is no Shabbat
  category), set category_id to null and new_category_name to the tab to create ("שבת").
  "prayer" is one of the category's subcategory ids when it has them, otherwise one of
  shacharit / mincha / arvit / other. "label" is the name shown ("שחרית א'", "מנחה גדולה").
  A time is either fixed (HH:MM, 24-hour) or relative to a zman: alot, misheyakir, sunrise, chatzot,
  mincha_gedola, plag, candle (הדלקת נרות), sunset (שקיעה), tzeit (צאת הכוכבים), with
  offset_minutes negative for before and positive for after ("10 דקות לפני השקיעה" = sunset, -10).
  When the input changes a minyan that already exists (same category and prayer/label), propose
  action "update" with its existing_id rather than a new one. Use confidence "low" when the time,
  day or prayer is a guess.
- A one-day change to an existing minyan ("מחר שחרית ב-7", "אין מנחה ביום חמישי") is an override:
  the minyan's id, the date (YYYY-MM-DD), the new time or cancelled.
- Announcements: mazal_tov (שמחות, מזל טוב), memorial (אבל, אזכרה, ניחום אבלים), general (the rest).
  Keep the wording of the notice; title short, body complete. expires_at when the notice has an
  end date (an event date, the end of shiva).
- Shiurim: title, teacher, weekly (day_of_week 0 = ראשון … 6 = שבת) or daily, time as written.

Write summary, questions and reason in Hebrew. Empty lists for what the input does not contain.`;

type Img = { media_type: (typeof IMAGE_TYPES)[number]; data: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "חסר מפתח: יש להגדיר ANTHROPIC_API_KEY בסודות של Supabase." }, 503);

  let body: { communityId?: string; text?: string; images?: Img[]; today?: string; weekday?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "בקשה לא תקינה" }, 400);
  }
  const communityId = body.communityId;
  const text = (body.text ?? "").slice(0, 8000).trim();
  const images = (body.images ?? []).slice(0, MAX_IMAGES).filter(
    (i) => IMAGE_TYPES.includes(i.media_type) && typeof i.data === "string" && i.data.length <= MAX_IMAGE_CHARS,
  );
  if (!communityId) return json({ error: "חסר בית כנסת" }, 400);
  if (!text && images.length === 0) return json({ error: "אין מה לנתח: צלמו, הקליטו או כתבו משהו." }, 400);

  // The caller's own session: RLS decides what they can read, and they must be this shul's admin.
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin_of", { _community: communityId });
  if (adminError || !isAdmin) return json({ error: "רק מנהל של בית הכנסת יכול להשתמש בעוזר." }, 403);

  const [cats, mins] = await Promise.all([
    supabase
      .from("minyan_categories")
      .select("id,name,system_key,subcategories,active")
      .eq("community_id", communityId)
      .order("sort_order"),
    supabase
      .from("minyanim")
      .select("id,category_id,day_type,prayer,label,time_mode,fixed_time,relative_to,offset_minutes,active")
      .eq("community_id", communityId)
      .order("sort_order"),
  ]);
  if (cats.error || mins.error) return json({ error: "טעינת הנתונים הקיימים נכשלה" }, 500);

  const context = JSON.stringify({ categories: cats.data, minyanim: mins.data });
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    ...images.map((i) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: i.media_type, data: i.data },
    })),
    {
      type: "text",
      text:
        `Today (Israel): ${body.today ?? ""} (${body.weekday ?? ""}).\n` +
        `The synagogue's current data:\n${context}\n\n` +
        (text ? `The gabbai wrote or said:\n${text}` : "Read the attached image(s)."),
    },
  ];

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content }],
    } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);

    if (response.stop_reason === "refusal") return json({ error: "הבקשה נדחתה. נסו לנסח אחרת." }, 422);
    if (response.stop_reason === "max_tokens") return json({ error: "יותר מדי חומר בבת אחת. נסו לחלק." }, 422);
    const out = response.content.find((b) => b.type === "text");
    if (!out || out.type !== "text") return json({ error: "לא התקבלה תשובה" }, 502);
    return json({ proposal: JSON.parse(out.text), usage: response.usage });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "מפתח ה-API לא תקין." }, 502);
    if (e instanceof Anthropic.RateLimitError) return json({ error: "עומס. נסו שוב בעוד דקה." }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `שגיאה מהשירות (${e.status})` }, 502);
    return json({ error: "הניתוח נכשל" }, 500);
  }
});
