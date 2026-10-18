import { lazy, Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { GlobalAppHeader } from "@community/components/CommunityChrome";
import { AdminFloatingButtons } from "@community/components/AdminFloatingButtons";

const AppSettings = lazy(() => import("@/components/Settings").then(module => ({ default: module.Settings })));

/**
 * Persistent application chrome shared by the synagogue, Siddur and Chumash.
 * Route-specific controls and content are rendered below it through Outlet.
 */
export function GlobalAppShell() {
  const { pathname, search } = useLocation();
  // The boards' editor takes the whole screen: the site's header (its name and menus) is not
  // needed there - "חזרה", the steps and "יציאה" of the gabbai's area lead out (18.10.2026).
  const boardsEditor = pathname.endsWith("/admin") && new URLSearchParams(search).get("tab") === "tv";
  return (
    <div className="min-h-screen">
      {!boardsEditor && <GlobalAppHeader />}
      <Suspense fallback={null}>
        <AppSettings showTrigger={false} />
      </Suspense>
      <Outlet />
      {/* The gabbai's floating buttons, once for every page (AdminFloatingButtons.tsx). */}
      <AdminFloatingButtons />
    </div>
  );
}
