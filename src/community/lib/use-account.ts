import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@community/integrations/supabase/client";
import { useAuth as useCommunityAuth } from "@community/lib/use-auth";

/**
 * Who is signed in, as the site shows them: their name, what they are here,
 * and where their own door leads.
 *
 *   guest   nobody, or an anonymous session: the door is signing in
 *   member  a signed-in member: their area, with what they sent the gabbai
 *   gabbai  an administrator: the admin, with everything in it
 *
 * The name is the one given at sign-up (profiles.display_name, which the
 * database fills from the sign-up form), the e-mail's first part when there
 * is none. One hook for every place that names the account - the header,
 * the member's area - so they never disagree.
 */
export type AccountRole = "guest" | "member" | "gabbai";

export interface Account {
  signedIn: boolean;
  role: AccountRole;
  /** What to call them: their name, or "אורח". */
  name: string;
  email: string | null;
  /** The role, as the site says it. */
  roleLabel: string;
  /** Where their own door leads. */
  href: string;
  loading: boolean;
}

const ROLE_LABEL: Record<AccountRole, string> = { guest: "אורח", member: "חבר רשום", gabbai: "גבאי" };
const ROLE_HREF: Record<AccountRole, string> = { guest: "/auth", member: "/community/my", gabbai: "/community/admin" };

export function useAccount(): Account {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useCommunityAuth();
  const signedIn = Boolean(user && !user.is_anonymous);
  const profile = useQuery({
    queryKey: ["profile-name", user?.id],
    enabled: signedIn,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("display_name").eq("id", user!.id).maybeSingle();
      return data?.display_name ?? null;
    },
  });
  const role: AccountRole = !signedIn ? "guest" : isAdmin ? "gabbai" : "member";
  const metaName = typeof user?.user_metadata?.display_name === "string" ? user.user_metadata.display_name : null;
  const email = signedIn ? (user?.email ?? null) : null;
  const name = signedIn ? (profile.data || metaName || email?.split("@")[0] || "חבר").trim() : "אורח";
  return {
    signedIn,
    role,
    name,
    email,
    roleLabel: ROLE_LABEL[role],
    href: ROLE_HREF[role],
    loading: loading || (signedIn && roleLoading),
  };
}
