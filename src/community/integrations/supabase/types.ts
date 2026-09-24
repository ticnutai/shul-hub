/**
 * The community features read the same database as the rest of the app, so
 * they use the one generated schema (src/integrations/supabase/types.ts).
 * This file used to be an older, narrower copy of it: it had no
 * `community_id`, no `minyan_overrides`, and none of the community
 * functions, and every query that used them failed the type check.
 */
export * from "@/integrations/supabase/types";
