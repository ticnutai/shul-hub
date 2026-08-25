import { useEffect, useState } from "react";
import { useAuth as useBaseAuth } from "@/contexts/AuthContext";
import { supabase } from "@community/integrations/supabase/client";

export function useAuth() {
  const { session, loading: sessionLoading } = useBaseAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      setIsAdmin(false);
      setRoleLoading(false);
      return () => { cancelled = true; };
    }

    setRoleLoading(true);
    void (async () => {
      const { data: alreadyAdmin } = await supabase.rpc("is_admin");
      if (alreadyAdmin === true) {
        if (!cancelled) {
          setIsAdmin(true);
          setRoleLoading(false);
        }
        return;
      }

      // Preserve Shul Hub's first-admin bootstrap rule. The RPC only grants the
      // role when the project has no administrator; it cannot elevate a later
      // arbitrary account.
      const { data: claimed } = await supabase.rpc("claim_admin");
      if (!cancelled) {
        setIsAdmin(claimed === true);
        setRoleLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  return { session, isAdmin, loading: sessionLoading || roleLoading };
}
