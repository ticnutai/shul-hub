/**
 * Settles which synagogue this visit is about, before anything is fetched.
 *
 * Nothing below renders until the question is answered, and that is the
 * whole point: a query that ran first would have had to guess, and the
 * wrong guess is not a blank screen - it is one synagogue's prayer times
 * shown under another's name.
 *
 * While there is one synagogue nobody ever sees this: it resolves to that
 * one and gets out of the way. It only shows itself once there are
 * several and the visitor has not said which they came for.
 */
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  type Community,
  currentCommunity,
  resolveCommunity,
  setCommunity,
} from "@/community/lib/community";

export function CommunityProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<{
    status: "resolving" | "ready" | "choose" | "empty";
    all: Community[];
  }>(() => (currentCommunity() ? { status: "ready", all: [] } : { status: "resolving", all: [] }));

  useEffect(() => {
    if (currentCommunity()) return;
    let alive = true;
    void resolveCommunity()
      .then(({ community, all }) => {
        if (!alive) return;
        if (community) setState({ status: "ready", all });
        else setState({ status: all.length ? "choose" : "empty", all });
      })
      .catch(() => alive && setState({ status: "empty", all: [] }));
    return () => {
      alive = false;
    };
  }, []);

  const choose = useCallback(
    (c: Community) => {
      setCommunity(c);
      // Everything cached was another synagogue's. Clearing is blunt and
      // it is correct: a stale list of minyanim under a new name would be
      // worse than a moment of loading.
      queryClient.clear();
      setState((s) => ({ ...s, status: "ready" }));
    },
    [queryClient],
  );

  if (state.status === "resolving") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        רגע…
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
        לא נמצא בית כנסת פעיל. אם זו טעות, נסו לרענן את הדף.
      </div>
    );
  }

  if (state.status === "choose") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-lg font-semibold">לאיזה בית כנסת?</h1>
        <div className="flex w-full max-w-xs flex-col gap-2">
          {state.all.map((c) => (
            <Button key={c.id} variant="outline" onClick={() => choose(c)}>
              {c.name}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">אפשר להחליף בכל רגע מתוך ההגדרות.</p>
      </div>
    );
  }

  return <>{children}</>;
}
