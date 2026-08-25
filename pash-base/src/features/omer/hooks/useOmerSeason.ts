import { useEffect, useState } from "react";
import { isOmerSeason } from "../utils/omerUtils";

/**
 * Keeps Omer visibility aligned with the effective Hebrew date while the app
 * remains open. The utility advances the Hebrew day in the evening, and this
 * hook refreshes on visibility changes and once per minute.
 */
export function useOmerSeason() {
  const [inSeason, setInSeason] = useState(() => isOmerSeason());

  useEffect(() => {
    const refresh = () => setInSeason(isOmerSeason());
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return inSeason;
}
