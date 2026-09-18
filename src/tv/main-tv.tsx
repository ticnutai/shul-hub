import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { TvDisplay } from "./TvDisplay";

/**
 * Entry point for the wall display build.
 *
 * Deliberately much smaller than `main.tsx`: no router, no auth, no Torah
 * database, no service-worker update dance. The display renders one screen and
 * is driven entirely by the realtime feed, so everything else is weight that
 * would only add failure modes to an appliance nobody can reach.
 */

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The realtime subscription is what triggers refetches, so polling on a
      // timer would only duplicate it. `useRealtimeSync` keeps a slow safety
      // refetch for the case where an event is missed.
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      // A TV has nobody to press retry. Keep trying, with backoff.
      retry: Infinity,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
    },
  },
});

if (Capacitor.isNativePlatform()) {
  SplashScreen.hide().catch(() => {});
}

// A display left on for weeks should never dim or sleep mid-shacharit. The
// wake lock is re-acquired whenever the system drops it (a common effect of
// the screen being turned off and on again at the TV).
if ("wakeLock" in navigator) {
  const requestWakeLock = async () => {
    try {
      await navigator.wakeLock.request("screen");
    } catch {
      // Denied or unsupported; the Android TV build also sets keepScreenOn.
    }
  };
  void requestWakeLock();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void requestWakeLock();
  });
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <TvDisplay />
  </QueryClientProvider>,
);
