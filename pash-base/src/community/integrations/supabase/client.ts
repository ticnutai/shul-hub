import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase as sharedClient } from "@/integrations/supabase/client";
import type { Database } from "./types";

// Community and Torah features intentionally share one authenticated client.
// The runtime boundary in the canonical client rejects every Supabase project
// except Shul Hub before this cast can be reached.
export const supabase = sharedClient as unknown as SupabaseClient<Database>;
