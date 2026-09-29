import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Building2, LayoutDashboard, LogOut, ShieldAlert, Tv } from "lucide-react";
import { CommunityHeader } from "@community/components/CommunityChrome";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MinyanimAdmin } from "@community/components/admin/MinyanimAdmin";
import { MinyanOverridesAdmin } from "@community/components/admin/MinyanOverridesAdmin";
import { AnnouncementsAdmin, ChavrutotAdmin, ShiurimAdmin } from "@community/components/admin/ContentAdmin";
import { MessagesAdmin } from "@community/components/admin/MessagesAdmin";
import { SiteDesignShortcuts, SiteHeaderSettings } from "@community/components/admin/SiteHeaderAdmin";
import { WidgetsAdmin } from "@community/components/admin/WidgetsAdmin";
import { UsersAdmin } from "@community/components/admin/UsersAdmin";
import { ChavrutaRequestsAdmin } from "@community/components/admin/ChavrutaRequestsAdmin";
import { DataExportImportAdmin } from "@community/components/admin/DataExportImportAdmin";
import { QrCodesAdmin } from "@community/components/admin/QrCodesAdmin";
import { AppDownloadsAdmin } from "@community/components/admin/AppDownloadsAdmin";
import { AiIntakeAdmin } from "@community/components/admin/AiIntakeAdmin";
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
  const activeTab = [
    "minyanim", "announcements", "shiurim", "chavrutot", "chavruta-requests",
    "messages", "widgets", "users", "data", "qr", "apps", "ai", "tv", "communities",
  ].includes(requestedTab ?? "") ? requestedTab! : "minyanim";

  const unread = messages.filter((m) => !m.is_read).length;

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
        className={`mx-auto px-3 py-5 text-right sm:px-4 sm:py-8 ${activeTab === "tv" ? "max-w-[1800px]" : "max-w-5xl"}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">ניהול האתר</h1>
            <ShulNow />
            <p className="mt-1 text-sm text-muted-foreground">{session?.user.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
          >
            <TabsList
              dir="rtl"
              aria-label="מדורי ניהול"
              className="admin-tabs-scroll flex h-auto w-full flex-nowrap justify-start gap-1 overflow-x-auto px-1 py-1.5 text-right [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>button]:shrink-0 [&>button]:whitespace-nowrap sm:flex-wrap sm:overflow-visible"
            >
              <TabsTrigger value="ai">✨ עוזר חכם</TabsTrigger>
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
              <TabsTrigger value="apps">הורדת אפליקציות</TabsTrigger>
              <TabsTrigger value="tv">
                <Tv className="size-4" /> תצוגות
              </TabsTrigger>
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
            <TabsContent value="apps" className="mt-6">
              <AppDownloadsAdmin />
            </TabsContent>
            <TabsContent value="tv" className="mt-6">
              <Suspense fallback={<p className="p-6 text-center text-muted-foreground">טוען את מרכז הבקרה…</p>}>
                <TvAdmin />
              </Suspense>
            </TabsContent>
          </Tabs>
        )}
        <QuickAddButton />
      </main>
    </div>
  );
}
