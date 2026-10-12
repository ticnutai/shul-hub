import { useNavigate, useSearchParams } from "react-router-dom";
import { AdminButtonsSettings } from "@community/components/admin/AdminButtonsSettings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Building2, LayoutGrid, LogOut, Rows3, ShieldAlert } from "lucide-react";
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
import { AdminTiles } from "@community/components/admin/AdminTiles";
import { ADMIN_SECTIONS } from "@community/lib/adminSections";
import { useAdminLayout } from "@community/lib/adminLayout";

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
  // One list of the sections (AdminTiles.tsx): the phone's list and the tiles read it.
  const sections = ADMIN_SECTIONS.filter((section) => !storeApp || (section.value !== "apps" && section.value !== "tv"));
  const mobileSections = sections.map((section) => ({
    value: section.value,
    label: section.value === "messages" && unread > 0 ? `${section.label} (${unread})` : section.label,
  }));
  const { layout, setLayout } = useAdminLayout();

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

  /** A section's own screen - the same whether its tab or its tile opened it. */
  function sectionScreen(value: string) {
    switch (value) {
      case "communities":
        return <CommunitiesAdmin />;
      case "minyanim":
        return (
          <>
            <MinyanimAdmin />
            {/* Under the timetable, because it is about the timetable and
                not instead of it: the regular week first, then whatever is
                different about one day. */}
            <MinyanOverridesAdmin />
          </>
        );
      case "announcements":
        return <AnnouncementsAdmin />;
      case "shiurim":
        return <ShiurimAdmin />;
      case "chavrutot":
        return <ChavrutotAdmin />;
      case "chavruta-requests":
        return <ChavrutaRequestsAdmin />;
      case "messages":
        return <MessagesAdmin />;
      case "widgets":
        return (
          <>
            {/* The site as a whole first - its header and its themes - then
                what stands on the home page. */}
            <SiteHeaderSettings />
            <AdminButtonsSettings />
            <HomeHeroSettings />
            <SiteDesignShortcuts />
            <WidgetsAdmin />
          </>
        );
      case "users":
        return <UsersAdmin />;
      case "data":
        return <DataExportImportAdmin />;
      case "qr":
        return <QrCodesAdmin />;
      case "ai":
        return <AiIntakeAdmin />;
      case "api":
        return <ApiKeysAdmin />;
      case "apps":
        return <AppDownloadsAdmin />;
      case "tv":
        return (
          <Suspense fallback={<p className="p-6 text-center text-muted-foreground">טוען את מרכז הבקרה…</p>}>
            <TvAdmin />
          </Suspense>
        );
      default:
        return null;
    }
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
            {/* Two ways into the same screens (adminLayout.ts): the tabs, or tiles step by step.
                Only for a gabbai - to anyone else there are no screens to lay out. */}
            {isAdmin && (
            <div role="radiogroup" aria-label="פריסת מסך הניהול" className="flex rounded-lg border p-0.5" data-testid="admin-layout-switch">
              {([["tabs", "לשוניות", Rows3], ["tiles", "אריחים", LayoutGrid]] as const).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={layout === value}
                  onClick={() => setLayout(value)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm ${layout === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                >
                  <Icon className="size-4" aria-hidden /> {label}
                </button>
              ))}
            </div>
            )}
            <Button variant="outline" onClick={signOut}>
              <LogOut className="size-4" /> יציאה
            </Button>
          </div>
        </div>

        {/* A screen nobody has heard from, on every tab - the device panel
            already knew, but only said so to somebody who opened it. */}
        {/* Not on "תצוגות": its own line says the same, with the details. */}
        {!loading && isAdmin && activeTab !== "tv" && <SilentScreensAlert />}

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
        ) : layout === "tiles" ? (
          <AdminTiles sections={sections} badges={{ messages: unread }} renderSection={sectionScreen} />
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
              {/* The same list and order as the phone's and the tiles' (adminSections.ts); the
                  synagogues are the button beside the switcher, above. */}
              {sections.filter((section) => section.value !== "communities").map((section) => (
                <TabsTrigger key={section.value} value={section.value} className="gap-1.5">
                  <section.icon className="size-4" aria-hidden />
                  {section.value === "messages" && unread > 0 ? `${section.label} (${unread})` : section.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {sections.map((section) => (
              <TabsContent key={section.value} value={section.value} className="mt-6 space-y-6">
                {sectionScreen(section.value)}
              </TabsContent>
            ))}
          </Tabs>
        )}
        <QuickAddButton />
      </main>
    </div>
  );
}
