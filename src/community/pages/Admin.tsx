import { useNavigate, useSearchParams } from "react-router-dom";
import { AdminButtonsSettings } from "@community/components/admin/AdminButtonsSettings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Building2, LayoutDashboard, LogOut, ShieldAlert, Tv } from "lucide-react";
import { CommunityHeader } from "@community/components/CommunityChrome";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import "@community/components/admin/adminMobile.css";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MinyanimAdmin } from "@community/components/admin/MinyanimAdmin";
import { MinyanOverridesAdmin } from "@community/components/admin/MinyanOverridesAdmin";
import { AnnouncementsAdmin, ChavrutotAdmin, ShiurimAdmin } from "@community/components/admin/ContentAdmin";
import { MessagesAdmin } from "@community/components/admin/MessagesAdmin";
import { SiteDesignShortcuts, SiteHeaderSettings } from "@community/components/admin/SiteHeaderAdmin";
import { HomeHeroSettings } from "@community/components/admin/HomeHeroSettings";
import { WidgetsAdmin } from "@community/components/admin/WidgetsAdmin";
import { UsersAdmin } from "@community/components/admin/UsersAdmin";
import { ChavrutaRequestsAdmin } from "@community/components/admin/ChavrutaRequestsAdmin";
import { DataExportImportAdmin } from "@community/components/admin/DataExportImportAdmin";
import { QrCodesAdmin } from "@community/components/admin/QrCodesAdmin";
import { AppDownloadsAdmin } from "@community/components/admin/AppDownloadsAdmin";
import { useIsStoreApp } from "@/lib/storeApp";
import { AiIntakeAdmin } from "@community/components/admin/AiIntakeAdmin";
import { ApiKeysAdmin } from "@community/components/admin/ApiKeysAdmin";
import { QuickAddButton } from "@community/components/QuickAddButton";
import { supabase } from "@community/integrations/supabase/client";
import { useAuth } from "@community/lib/use-auth";
import { useAdminMessages } from "@community/lib/data";
import { CommunitySwitcher, ShulNow } from "@/community/components/admin/CommunitySwitcher";
import { listMyCommunities } from "@/community/lib/community";
import { CommunitiesAdmin } from "@/community/components/admin/CommunitiesAdmin";
import { SilentScreensAlert } from "@community/components/admin/tv/SilentScreensAlert";

// Loaded only when the tab is opened: it brings the whole TV board with it.
const TvAdmin = lazy(() => import("@community/components/admin/tv/TvAdmin"));

export function AdminPage() {
  const { session, isAdmin, loading } = useAuth();
  const { data: messages = [] } = useAdminMessages();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();

  // "הגדרות" is gone: the synagogue's details moved to its window under
  // "בתי כנסת", the site header and themes to "תצוגת דף הבית". An old link
  // or bookmark to it lands where the details are now.
  const requestedTab = searchParams.get("tab") === "settings" ? "communities" : searchParams.get("tab");
  // The app from Google Play has no TV boards (storeApp.ts): run from the website.
  const storeApp = useIsStoreApp();
  const activeTab = [
    "minyanim", "announcements", "shiurim", "chavrutot", "chavruta-requests",
    "messages", "widgets", "users", "data", "qr", "ai", "api", "communities",
    ...(storeApp ? [] : ["apps", "tv"]),
  ].includes(requestedTab ?? "") ? (requestedTab ?? "minyanim") : "minyanim";

  const unread = messages.filter((m) => !m.is_read).length;
  const mobileSections = [
    { value: "minyanim", label: "מניינים" },
    { value: "announcements", label: "מודעות" },
    { value: "shiurim", label: "שיעורים" },
    { value: "chavrutot", label: "חברותות" },
    { value: "chavruta-requests", label: "בקשות חברותא" },
    { value: "messages", label: `הודעות${unread > 0 ? ` (${unread})` : ""}` },
    { value: "widgets", label: "תצוגת דף הבית" },
    { value: "users", label: "משתמשים" },
    { value: "data", label: "ייצוא/ייבוא" },
    { value: "qr", label: "קודי QR" },
    { value: "ai", label: "עוזר חכם" },
    { value: "api", label: "מפתח API" },
    { value: "communities", label: "בתי כנסת ופרטים" },
    ...(!storeApp ? [{ value: "apps", label: "הורדת אפליקציות" }, { value: "tv", label: "תצוגות" }] : []),
  ];

  // Every admin has at least the synagogue they run, and its details (the
  // address, the location, its logos) live in its window under this button.
  // With several, or for the platform admin, it is the list of them.
  const { data: myShuls = [] } = useQuery({
    queryKey: ["my-communities"],
    queryFn: listMyCommunities,
  });
  const { data: isPlatformAdmin = false } = useQuery({
    queryKey: ["is-platform-admin"],
    queryFn: async () => Boolean((await supabase.rpc("is_platform_admin")).data),
  });
  const manyShuls = myShuls.length > 1 || isPlatformAdmin;

  function openTab(tab: string) {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    next.delete("settingsTab");
    setSearchParams(next, { replace: true });
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  }

  return (
    <div className="min-h-screen">
      <CommunityHeader />
      {/* Forms read better in a narrow column; the TV editor is a preview
          beside its controls and needs the whole screen. */}
      <main
        dir="rtl"
        className={`gabbai-admin mx-auto min-w-0 px-3 py-5 text-right sm:px-4 sm:py-8 ${activeTab === "tv" ? "max-w-[1800px]" : "max-w-5xl"}`}
        data-focus-tight
      >
        {/* data-focus-hide: hidden while the TV editor is in its work mode (tvEdit.css). */}
        <div className="flex flex-wrap items-center justify-between gap-3" data-focus-hide>
          <div className="min-w-0 max-w-full">
            <h1 className="text-2xl font-bold sm:text-3xl">ניהול האתר</h1>
            <ShulNow />
            <p className="mt-1 break-all text-sm text-muted-foreground">{session?.user.email}</p>
          </div>
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
            {/* Beside the switcher rather than among the tabs: it is about all
                the synagogues, and the tabs below are about the one chosen. */}
            {isAdmin && (
              <Button
                variant={activeTab === "communities" ? "default" : "outline"}
                aria-pressed={activeTab === "communities"}
                onClick={() => openTab("communities")}
              >
                <Building2 className="size-4" /> {manyShuls ? "בתי כנסת" : "פרטי בית הכנסת"}
              </Button>
            )}
            <CommunitySwitcher />
            <Button variant="outline" onClick={signOut}>
              <LogOut className="size-4" /> יציאה
            </Button>
          </div>
        </div>

        {/* A screen nobody has heard from, on every tab - the device panel
            already knew, but only said so to somebody who opened it. */}
        {!loading && isAdmin && <SilentScreensAlert />}

        {!loading && !isAdmin ? (
          <div className="card-elev mt-8 flex items-start gap-3 p-6">
            <ShieldAlert className="size-5 text-destructive" />
            <div>
              <p className="font-medium">אין לך הרשאת ניהול</p>
              <p className="mt-1 text-sm text-muted-foreground">
                החשבון מחובר אך אינו מוגדר כגבאי. יש לפנות לגבאי הראשי כדי לקבל הרשאה.
              </p>
            </div>
          </div>
        ) : (
          <Tabs
            dir="rtl"
            value={activeTab}
            onValueChange={openTab}
            className="mt-5 min-w-0 text-right sm:mt-6"
            data-focus-tight
          >
            <div className="sticky top-[var(--app-header-height,7rem)] z-20 bg-background py-2 sm:hidden" data-focus-hide>
              <Select dir="rtl" value={activeTab} onValueChange={openTab}>
                <SelectTrigger aria-label="מדור ניהול" className="h-12 w-full font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl" position="popper" className="max-h-[60dvh]">
                  {mobileSections.map((section) => (
                    <SelectItem key={section.value} value={section.value} className="min-h-11 py-3">
                      {section.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <TabsList
              dir="rtl"
              aria-label="מדורי ניהול"
              data-focus-hide
              className="hidden h-auto w-full flex-wrap justify-start gap-1 px-1 py-1.5 text-right [&>button]:whitespace-nowrap sm:flex"
            >
              <TabsTrigger value="ai">✨ עוזר חכם</TabsTrigger>
              <TabsTrigger value="api">🔑 מפתח API</TabsTrigger>
              <TabsTrigger value="minyanim">מניינים</TabsTrigger>
              <TabsTrigger value="announcements">מודעות</TabsTrigger>
              <TabsTrigger value="shiurim">שיעורים</TabsTrigger>
              <TabsTrigger value="chavrutot">חברותות</TabsTrigger>
              <TabsTrigger value="chavruta-requests">בקשות חברותא</TabsTrigger>
              <TabsTrigger value="messages">הודעות{unread > 0 ? ` (${unread})` : ""}</TabsTrigger>
              <TabsTrigger value="widgets">
                <LayoutDashboard className="size-4" /> תצוגת דף הבית
              </TabsTrigger>
              <TabsTrigger value="users">משתמשים</TabsTrigger>
              <TabsTrigger value="data">ייצוא/ייבוא</TabsTrigger>
              <TabsTrigger value="qr">קודי QR</TabsTrigger>
              {!storeApp && (
                <>
                  <TabsTrigger value="apps">הורדת אפליקציות</TabsTrigger>
                  <TabsTrigger value="tv">
                    <Tv className="size-4" /> תצוגות
                  </TabsTrigger>
                </>
              )}
            </TabsList>

            <TabsContent value="communities" className="mt-6">
              <CommunitiesAdmin />
            </TabsContent>
            <TabsContent value="minyanim" className="mt-6 space-y-6">
              <MinyanimAdmin />
              {/* Under the timetable, because it is about the timetable and
                  not instead of it: the regular week first, then whatever is
                  different about one day. */}
              <MinyanOverridesAdmin />
            </TabsContent>
            <TabsContent value="announcements" className="mt-6">
              <AnnouncementsAdmin />
            </TabsContent>
            <TabsContent value="shiurim" className="mt-6">
              <ShiurimAdmin />
            </TabsContent>
            <TabsContent value="chavrutot" className="mt-6">
              <ChavrutotAdmin />
            </TabsContent>
            <TabsContent value="chavruta-requests" className="mt-6">
              <ChavrutaRequestsAdmin />
            </TabsContent>
            <TabsContent value="messages" className="mt-6">
              <MessagesAdmin />
            </TabsContent>
            <TabsContent value="widgets" className="mt-6 space-y-6">
              {/* The site as a whole first - its header and its themes - then
                  what stands on the home page. */}
              <SiteHeaderSettings />
              <AdminButtonsSettings />
              <HomeHeroSettings />
              <SiteDesignShortcuts />
              <WidgetsAdmin />
            </TabsContent>
            <TabsContent value="users" className="mt-6">
              <UsersAdmin />
            </TabsContent>
            <TabsContent value="data" className="mt-6">
              <DataExportImportAdmin />
            </TabsContent>
            <TabsContent value="qr" className="mt-6">
              <QrCodesAdmin />
            </TabsContent>
            <TabsContent value="ai" className="mt-6">
              <AiIntakeAdmin />
            </TabsContent>
            <TabsContent value="api" className="mt-6">
              <ApiKeysAdmin />
            </TabsContent>
            {!storeApp && (
              <>
                <TabsContent value="apps" className="mt-6">
                  <AppDownloadsAdmin />
                </TabsContent>
                <TabsContent value="tv" className="mt-6">
                  <Suspense fallback={<p className="p-6 text-center text-muted-foreground">טוען את מרכז הבקרה…</p>}>
                    <TvAdmin />
                  </Suspense>
                </TabsContent>
              </>
            )}
          </Tabs>
        )}
        <QuickAddButton />
      </main>
    </div>
  );
}
