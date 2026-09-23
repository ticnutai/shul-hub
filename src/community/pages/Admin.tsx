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
import { SettingsAdmin } from "@community/components/admin/SettingsAdmin";
import { WidgetsAdmin } from "@community/components/admin/WidgetsAdmin";
import { UsersAdmin } from "@community/components/admin/UsersAdmin";
import { ChavrutaRequestsAdmin } from "@community/components/admin/ChavrutaRequestsAdmin";
import { DataExportImportAdmin } from "@community/components/admin/DataExportImportAdmin";
import { QrCodesAdmin } from "@community/components/admin/QrCodesAdmin";
import { QuickAddButton } from "@community/components/QuickAddButton";
import { supabase } from "@community/integrations/supabase/client";
import { useAuth } from "@community/lib/use-auth";
import { useAdminMessages } from "@community/lib/data";
import { CommunitySwitcher, ShulNow } from "@/community/components/admin/CommunitySwitcher";
import { listMyCommunities } from "@/community/lib/community";
import { CommunitiesAdmin } from "@/community/components/admin/CommunitiesAdmin";

// Loaded only when the tab is opened: it brings the whole TV board with it.
const TvAdmin = lazy(() => import("@community/components/admin/tv/TvAdmin"));

export function AdminPage() {
  const { session, isAdmin, loading } = useAuth();
  const { data: messages = [] } = useAdminMessages();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();

  const requestedTab = searchParams.get("tab");
  const activeTab = [
    "minyanim", "announcements", "shiurim", "chavrutot", "chavruta-requests",
    "messages", "widgets", "settings", "users", "data", "qr", "tv", "communities",
  ].includes(requestedTab ?? "") ? requestedTab! : "minyanim";

  const unread = messages.filter((m) => !m.is_read).length;

  // The synagogues tab is for whoever has more than one to keep straight, and
  // for whoever may add one. A gabbai of a single synagogue would get a page
  // listing that synagogue, which is a tab that only ever says what they
  // already know.
  const { data: myShuls = [] } = useQuery({
    queryKey: ["my-communities"],
    queryFn: listMyCommunities,
  });
  const { data: isPlatformAdmin = false } = useQuery({
    queryKey: ["is-platform-admin"],
    queryFn: async () => Boolean((await supabase.rpc("is_platform_admin")).data),
  });
  const showCommunities = myShuls.length > 1 || isPlatformAdmin;

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
          <div className="flex items-center gap-2">
            <CommunitySwitcher />
            <Button variant="outline" onClick={signOut}>
              <LogOut className="size-4" /> יציאה
            </Button>
          </div>
        </div>

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
            onValueChange={(tab) => {
              const next = new URLSearchParams(searchParams);
              next.set("tab", tab);
              if (tab !== "settings") next.delete("settingsTab");
              setSearchParams(next, { replace: true });
            }}
            className="mt-5 min-w-0 text-right sm:mt-6"
          >
            <TabsList
              dir="rtl"
              aria-label="מדורי ניהול"
              className="admin-tabs-scroll flex h-auto w-full flex-nowrap justify-start gap-1 overflow-x-auto px-1 py-1.5 text-right [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>button]:shrink-0 [&>button]:whitespace-nowrap sm:flex-wrap sm:overflow-visible"
            >
              <TabsTrigger value="minyanim">מניינים</TabsTrigger>
              <TabsTrigger value="announcements">מודעות</TabsTrigger>
              <TabsTrigger value="shiurim">שיעורים</TabsTrigger>
              <TabsTrigger value="chavrutot">חברותות</TabsTrigger>
              <TabsTrigger value="chavruta-requests">בקשות חברותא</TabsTrigger>
              <TabsTrigger value="messages">הודעות{unread > 0 ? ` (${unread})` : ""}</TabsTrigger>
              <TabsTrigger value="widgets">
                <LayoutDashboard className="size-4" /> תצוגת דף הבית
              </TabsTrigger>
              <TabsTrigger value="settings">הגדרות</TabsTrigger>
              <TabsTrigger value="users">משתמשים</TabsTrigger>
              <TabsTrigger value="data">ייצוא/ייבוא</TabsTrigger>
              <TabsTrigger value="qr">קודי QR</TabsTrigger>
              <TabsTrigger value="tv">
                <Tv className="size-4" /> תצוגות
              </TabsTrigger>
              {showCommunities && (
                <TabsTrigger value="communities">
                  <Building2 className="size-4" /> בתי כנסת
                </TabsTrigger>
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
            <TabsContent value="widgets" className="mt-6">
              <WidgetsAdmin />
            </TabsContent>
            <TabsContent value="settings" className="mt-6">
              <SettingsAdmin />
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
