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
import { AI_INTAKE_MODEL, AI_INTAKE_SCHEMA, AI_INTAKE_SYSTEM, aiIntakeText } from "../_shared/aiIntakePrompt.ts";

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

  const content: Anthropic.ContentBlockParam[] = [
    ...images.map((i) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: i.media_type, data: i.data },
    })),
    {
      type: "text",
      text: aiIntakeText({
        today: body.today ?? "",
        weekday: body.weekday ?? "",
        context: { categories: cats.data, minyanim: mins.data },
        text,
      }),
    },
  ];

  const client = new Anthropic({ apiKey });
  try {
    // Structured output: the answer is JSON in the schema above, nothing to parse around.
    const response = await client.messages.create({
      model: AI_INTAKE_MODEL,
      max_tokens: 16000,
      system: AI_INTAKE_SYSTEM,
      output_config: { effort: "medium", format: { type: "json_schema", schema: AI_INTAKE_SCHEMA } },
      messages: [{ role: "user", content }],
    } as unknown as Anthropic.MessageCreateParamsNonStreaming);

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
