import Anthropic from "@anthropic-ai/sdk";
import {
  AI_INTAKE_MODEL,
  AI_INTAKE_SCHEMA,
  AI_INTAKE_SYSTEM,
  aiIntakeText,
} from "../../../supabase/functions/_shared/aiIntakePrompt";

/**
 * "עוזר חכם" with the admin's own Claude API key. The key is kept only in
 * this browser (localStorage) - never in the database, the code or the site -
 * and goes only to Anthropic. It lets the assistant work without the ai-intake
 * edge function; the same prompt and schema are used either way.
 */

const STORAGE_KEY = "shul-ai-personal-key";

export function looksLikeApiKey(key: string): boolean {
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key.trim());
}

export function getPersonalKey(): string | null {
  try {
    const k = localStorage.getItem(STORAGE_KEY);
    return k && looksLikeApiKey(k) ? k : null;
  } catch {
    return null;
  }
}

export function setPersonalKey(key: string | null): void {
  try {
    if (key) localStorage.setItem(STORAGE_KEY, key.trim());
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode or blocked storage: the key simply is not remembered.
  }
}

/** "sk-ant-…XXXX": enough to recognise the key, never the whole of it. */
export function maskKey(key: string): string {
  return `sk-ant-…${key.slice(-4)}`;
}

export type DirectInput = {
  apiKey: string;
  text: string;
  images: Array<{ media_type: "image/jpeg"; data: string }>;
  today: string;
  weekday: string;
  context: unknown;
};

/** Runs the analysis against Claude directly; resolves to the proposal, or throws a Hebrew message. */
export async function analyzeDirect(input: DirectInput): Promise<unknown> {
  const client = new Anthropic({ apiKey: input.apiKey, dangerouslyAllowBrowser: true });
  const content: Anthropic.ContentBlockParam[] = [
    ...input.images.map((i) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: i.media_type, data: i.data },
    })),
    { type: "text", text: aiIntakeText({ today: input.today, weekday: input.weekday, context: input.context, text: input.text }) },
  ];
  try {
    // Streamed so a long answer does not hit a request timeout; only the final message is used.
    const response = await client.messages
      .stream({
        model: AI_INTAKE_MODEL,
        max_tokens: 16000,
        system: AI_INTAKE_SYSTEM,
        output_config: { effort: "medium", format: { type: "json_schema", schema: AI_INTAKE_SCHEMA } },
        messages: [{ role: "user", content }],
      } as unknown as Anthropic.MessageStreamParams)
      .finalMessage();
    if (response.stop_reason === "refusal") throw new Error("הבקשה נדחתה. נסו לנסח אחרת.");
    if (response.stop_reason === "max_tokens") throw new Error("יותר מדי חומר בבת אחת. נסו לחלק.");
    const out = response.content.find((b) => b.type === "text");
    if (!out || out.type !== "text") throw new Error("לא התקבלה תשובה");
    return JSON.parse(out.text);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error("המפתח האישי לא תקין. בדקו אותו בהגדרות העוזר.");
    if (e instanceof Anthropic.PermissionDeniedError) throw new Error("למפתח אין הרשאה למודל. בדקו את החשבון ב-Anthropic.");
    if (e instanceof Anthropic.RateLimitError) throw new Error("עומס או שנגמרה המכסה בחשבון. נסו שוב בעוד דקה.");
    if (e instanceof Anthropic.BadRequestError && /credit balance/i.test(e.message)) {
      throw new Error("אין יתרה בחשבון Anthropic של המפתח. יש להוסיף קרדיט ב-console.anthropic.com.");
    }
    if (e instanceof Anthropic.APIError) throw new Error(`שגיאה מהשירות (${e.status ?? "רשת"})`);
    throw e instanceof Error ? e : new Error("הניתוח נכשל");
  }
}
