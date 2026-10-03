import Anthropic from "@anthropic-ai/sdk";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@community/integrations/supabase/client";
import { looksLikeApiKey } from "@community/lib/aiIntakeDirect";

/**
 * The gabbai's own Claude API key, kept with his account (user_api_keys).
 *
 * It lived in one browser: typed again on every phone and computer and gone
 * with the browser's data. Now it is entered once under "מפתח API" and is
 * there wherever the gabbai signs in. Each account reads its own key only;
 * it goes from the browser to Anthropic and nowhere else.
 */
const QUERY_KEY = ["user_api_keys", "anthropic"];

async function readKey(): Promise<string | null> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return null;
  const { data, error } = await supabase
    .from("user_api_keys" as never)
    .select("api_key")
    .eq("provider", "anthropic")
    .maybeSingle();
  if (error) throw error;
  const key = (data as { api_key?: string } | null)?.api_key ?? null;
  return key && looksLikeApiKey(key) ? key : null;
}

/** The signed-in account's Claude key, or null. */
export function useAccountApiKey() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: readKey, staleTime: 5 * 60_000 });
}

export function useApiKeyActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: QUERY_KEY });
  return {
    /** Keeps the key with the account, in place of any it had. */
    save: async (key: string) => {
      const clean = key.trim();
      if (!looksLikeApiKey(clean)) throw new Error("זה לא נראה כמו מפתח של Claude (מתחיל ב-sk-ant-)");
      const { error } = await supabase
        .from("user_api_keys" as never)
        .upsert({ provider: "anthropic", api_key: clean, updated_at: new Date().toISOString() } as never, {
          onConflict: "user_id,provider",
        });
      if (error) throw new Error(error.message.includes("row-level security") ? "רק מנהל יכול לשמור מפתח" : error.message);
      await refresh();
    },
    remove: async () => {
      const { error } = await supabase.from("user_api_keys" as never).delete().eq("provider", "anthropic");
      if (error) throw error;
      await refresh();
    },
  };
}

/**
 * Asks Anthropic whether the key works, without spending anything: listing
 * the models is free. Says why it does not, in words.
 */
export async function checkApiKey(key: string): Promise<{ ok: boolean; message: string }> {
  try {
    const client = new Anthropic({ apiKey: key.trim(), dangerouslyAllowBrowser: true });
    await client.models.list({ limit: 1 });
    return { ok: true, message: "המפתח עובד" };
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 401) return { ok: false, message: "המפתח לא תקין או שבוטל - בדקו אותו בחשבון ב-Anthropic" };
    if (status === 403) return { ok: false, message: "למפתח אין הרשאה - בדקו את ההגדרות שלו ב-Anthropic" };
    if (status === 429) return { ok: false, message: "יותר מדי בקשות כרגע - נסו שוב בעוד רגע" };
    return { ok: false, message: "לא הצלחנו להגיע ל-Anthropic - בדקו את החיבור לאינטרנט" };
  }
}
