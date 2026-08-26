import { lazy, Suspense } from "react";
import { Outlet } from "react-router-dom";

import { GlobalAppHeader } from "@community/components/CommunityChrome";

const AppSettings = lazy(() => import("@/components/Settings").then(module => ({ default: module.Settings })));

/**
 * Persistent application chrome shared by the synagogue, Siddur and Chumash.
 * Route-specific controls and content are rendered below it through Outlet.
 */
export function GlobalAppShell() {
  return (
    <div className="min-h-screen">
      <GlobalAppHeader />
      <Suspense fallback={null}>
        <AppSettings showTrigger={false} />
      </Suspense>
      <Outlet />
    </div>
  );
}
