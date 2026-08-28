import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, HashRouter, Navigate, Routes, Route } from "react-router-dom";

// Use HashRouter in Electron (file:// protocol) and BrowserRouter in web
const isElectron = navigator.userAgent.toLowerCase().includes('electron');
const Router = isElectron ? HashRouter : BrowserRouter;
import { ThemeProvider } from "@/contexts/ThemeContext";
import { FontAndColorSettingsProvider } from "@/contexts/FontAndColorSettingsContext";
import { DisplayModeProvider } from "@/contexts/DisplayModeContext";
import { HighlightsProvider } from "@/contexts/HighlightsContext";
import { NotesProvider } from "@/contexts/NotesContext";
import { BookmarksProvider } from "@/contexts/BookmarksContext";
import { ContentProvider } from "@/contexts/ContentContext";
import { DeviceProvider } from "@/contexts/DeviceContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { lazy, Suspense, useEffect, useState, Profiler, type ProfilerOnRenderCallback } from "react";
import { Loader2, WifiOff } from "lucide-react";
import { PWAReloadPrompt } from "@/components/PWAReloadPrompt";
import { ReminderPopup } from "@/components/ReminderPopup";
import { OmerEntryPopup } from "@/components/OmerEntryPopup";
import { useNotifications } from "@/hooks/useNotifications";
import { MetaSyncInitializer } from "@/components/MetaSyncInitializer";
import { MobilePageSwipeNavigation } from "@/components/MobilePageSwipeNavigation";
import { AndroidBackNavigation } from "@/components/AndroidBackNavigation";
import { useOmerSeason } from "@/features/omer/hooks/useOmerSeason";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EditModeProvider } from "@community/lib/edit-mode";
import { LiveDesignProvider } from "@/lib/live-design";
import { GlobalAppShell } from "@/components/GlobalAppShell";

const communityQueryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

// Lazy load ALL pages for optimal initial bundle size
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth").then(m => ({ default: m.Auth })));
const Commentaries = lazy(() => import("./pages/Commentaries").then(m => ({ default: m.Commentaries })));
const UserProfile = lazy(() => import("./pages/UserProfile").then(m => ({ default: m.UserProfile })));
const NotFound = lazy(() => import("./pages/NotFound"));
const LayoutEditor = lazy(() => import("./pages/LayoutEditor").then(m => ({ default: m.LayoutEditor })));
const Siddur = lazy(() => import("./pages/Siddur").then(m => ({ default: m.Siddur })));
const Omer = lazy(() => import("./pages/Omer"));
const AdminPermissions = lazy(() => import("./pages/AdminPermissions"));
const CommunityHome = lazy(() => import("@community/pages/CommunityHome").then(m => ({ default: m.CommunityHome })));
const CommunityAnnouncements = lazy(() => import("@community/pages/Announcements").then(m => ({ default: m.AnnouncementsPage })));
const CommunityShiurim = lazy(() => import("@community/pages/Shiurim").then(m => ({ default: m.ShiurimPage })));
const CommunityChavrutot = lazy(() => import("@community/pages/Chavrutot").then(m => ({ default: m.ChavrutotPage })));
const CommunityContact = lazy(() => import("@community/pages/Contact").then(m => ({ default: m.ContactPage })));
const CommunityAdmin = lazy(() => import("@community/pages/Admin").then(m => ({ default: m.AdminPage })));
const YamimNoraimEvent = lazy(() => import("./pages/YamimNoraimEvent"));

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

function SeasonalOmerRoute() {
  const inSeason = useOmerSeason();
  return inSeason ? <Omer /> : <Navigate to="/community" replace />;
}

function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const setOnline = () => setIsOnline(true);
    const setOffline = () => setIsOnline(false);
    window.addEventListener("online", setOnline);
    window.addEventListener("offline", setOffline);
    return () => {
      window.removeEventListener("online", setOnline);
      window.removeEventListener("offline", setOffline);
    };
  }, []);
  if (isOnline) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 bg-amber-500 text-white text-sm py-1.5 px-4">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>אין חיבור לאינטרנט — עובד במצב לא מקוון</span>
    </div>
  );
}

// Renders the reminder popup only when explicitly enabled (after first idle).
// Isolating useNotifications inside its own component prevents its 4 mount
// effects + setInterval from running during the initial render of <App />.
function DeferredReminderPopup() {
  const { popupReminder, dismissPopup } = useNotifications();
  return <ReminderPopup reminder={popupReminder} onDismiss={dismissPopup} />;
}

// Dense React render tracer. Forwards every Profiler callback to
// window.__pashRecordRender so startupDiagnostics can attribute every render
// to a specific subtree id with phase + actualDuration. Activated by the same
// trigger as the diagnostics overlay (?traceFonts=1 / debug-font-trace=true).
const recordRender: ProfilerOnRenderCallback = (id, phase, actualDuration) => {
  const w = window as unknown as { __pashRecordRender?: (id: string, phase: string, actualDuration: number) => void };
  w.__pashRecordRender?.(id, phase, actualDuration);
};
function Trace({ id, children }: { id: string; children: React.ReactNode }) {
  return <Profiler id={id} onRender={recordRender}>{children}</Profiler>;
}

const App = () => {
  // Defer mounting the reminder popup hook until after first paint so its
  // localStorage reads + permission checks don't run on the critical path.
  // Without this, useNotifications fired its mount effects during initial
  // render and could pop a dialog (auto-enabled on first install) before the
  // user saw the app, registering as a perceived "second render".
  const [reminderHookEnabled, setReminderHookEnabled] = useState(false);
  useEffect(() => {
    const idle = (cb: () => void) => {
      const w = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
      if (typeof w.requestIdleCallback === "function") {
        w.requestIdleCallback(cb, { timeout: 2000 });
      } else {
        window.setTimeout(cb, 800);
      }
    };
    idle(() => setReminderHookEnabled(true));
  }, []);

  return (
    <ErrorBoundary fallbackTitle="שגיאה כללית באפליקציה">
    <Trace id="App.root">
    <AuthProvider>
      <QueryClientProvider client={communityQueryClient}>
      <EditModeProvider>
      <MetaSyncInitializer />
      <Trace id="App.Device">
      <DeviceProvider>
        <Trace id="App.Theme">
        <ThemeProvider>
          <LiveDesignProvider>
          <Trace id="App.FontAndColor">
          <FontAndColorSettingsProvider>
            <Trace id="App.DisplayMode">
            <DisplayModeProvider>
              <Trace id="App.Highlights">
              <HighlightsProvider>
                <Trace id="App.Notes">
                <NotesProvider>
                  <Trace id="App.Bookmarks">
                  <BookmarksProvider>
                    <Trace id="App.Content">
                    <ContentProvider>
                      <TooltipProvider>
                      <Toaster />
                      <Sonner />
                      <PWAReloadPrompt />
                      <OfflineBanner />
                      {reminderHookEnabled && <DeferredReminderPopup />}
                      <Router
                        future={{
                          v7_startTransition: true,
                          v7_relativeSplatPath: true,
                        }}
                      >
                        <MobilePageSwipeNavigation />
                        <AndroidBackNavigation />
                        <OmerEntryPopup />
                        <ErrorBoundary fallbackTitle="שגיאה בטעינת הדף">
                          <Trace id="App.Routes">
                          <Suspense fallback={<LoadingFallback />}>
                            <Routes>
                              <Route path="/" element={<Navigate to="/community" replace />} />
                              <Route path="/auth" element={<Auth />} />
                              <Route path="/profile" element={<UserProfile />} />
                              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                              <Route path="/layout-editor" element={<LayoutEditor />} />
                              <Route path="/admin/permissions" element={<AdminPermissions />} />
                              <Route path="/events/yamim-noraim-concord-2026" element={<YamimNoraimEvent />} />
                              <Route element={<GlobalAppShell />}>
                                <Route path="/chumash" element={<Index />} />
                                <Route path="/commentaries/:seferId/:perek/:pasuk" element={<Commentaries />} />
                                <Route path="/siddur" element={<Siddur />} />
                                <Route path="/omer" element={<SeasonalOmerRoute />} />
                                <Route path="/community" element={<CommunityHome />} />
                                <Route path="/community/announcements" element={<CommunityAnnouncements />} />
                                <Route path="/community/shiurim" element={<CommunityShiurim />} />
                                <Route path="/community/chavrutot" element={<CommunityChavrutot />} />
                                <Route path="/community/contact" element={<CommunityContact />} />
                                <Route path="/community/admin" element={<CommunityAdmin />} />
                              </Route>
                              <Route path="*" element={<NotFound />} />
                            </Routes>
                          </Suspense>
                          </Trace>
                        </ErrorBoundary>
                      </Router>
                      </TooltipProvider>
                    </ContentProvider>
                    </Trace>
                  </BookmarksProvider>
                  </Trace>
                </NotesProvider>
                </Trace>
              </HighlightsProvider>
              </Trace>
            </DisplayModeProvider>
            </Trace>
          </FontAndColorSettingsProvider>
          </Trace>
          </LiveDesignProvider>
        </ThemeProvider>
        </Trace>
      </DeviceProvider>
      </Trace>
      </EditModeProvider>
      </QueryClientProvider>
    </AuthProvider>
    </Trace>
  </ErrorBoundary>
  );
};

export default App;
