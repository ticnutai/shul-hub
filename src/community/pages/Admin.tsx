import { useNavigate, useSearchParams } from "react-router-dom";
import { AdminButtonsSettings } from "@community/components/admin/AdminButtonsSettings";
import { useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useEffect } from "react";
import { Building2, LayoutGrid, List, LogOut, ShieldAlert } from "lucide-react";
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
import { supabase } from "@community/integrations/supabase/client";
import { useAuth } from "@community/lib/use-auth";
import { useAdminMessages } from "@community/lib/data";
import { CommunitySwitcher, ShulNow } from "@/community/components/admin/CommunitySwitcher";
import { CommunitiesAdmin } from "@/community/components/admin/CommunitiesAdmin";
import { SilentScreensAlert } from "@community/components/admin/tv/SilentScreensAlert";
import { AdminTiles } from "@community/components/admin/AdminTiles";
import { ADMIN_SECTIONS, SECTION_ALIASES, type AdminSection } from "@community/lib/adminSections";
import { useAdminLayout } from "@community/lib/adminLayout";
import { confirmLeave } from "@community/lib/unsavedChanges";

// Loaded only when the tab is opened: it brings the whole TV board with it.
const TvAdmin = lazy(() => import("@community/components/admin/tv/TvAdmin"));

export function AdminPage() {
  const { session, isAdmin, loading } = useAuth();
  const { data: messages = [] } = useAdminMessages();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();

  // The app from Google Play has no TV boards (storeApp.ts): run from the website.
  const storeApp = useIsStoreApp();
  // One list of the sections (adminSections.ts): the tabs, the phone's list
  // and the tiles all read it, and which tabs are valid comes from it too.
  const sections = ADMIN_SECTIONS.filter((section) => !storeApp || section.value !== "tv");

  // A section that was merged into another (an old link or bookmark to
  // "מפתח API", "קודי QR", "הגדרות"…) opens the one it is part of now, on
  // the panel it became there.
  const requested = searchParams.get("tab") ?? "";
  const alias = SECTION_ALIASES[requested];
  useEffect(() => {
    if (!alias) return;
    const next = new URLSearchParams(searchParams);
    next.set("tab", alias.tab);
    if (alias.focus) next.set("focus", alias.focus);
    setSearchParams(next, { replace: true });
  }, [alias, searchParams, setSearchParams]);
  const requestedTab = alias?.tab ?? requested;
  const activeTab = sections.some((section) => section.value === requestedTab) ? requestedTab : "minyanim";

  const unread = messages.filter((m) => !m.is_read).length;
  /** A section's name, with the count of new messages beside "הודעות" - the same in every list of them. */
  const sectionLabel = (section: AdminSection) =>
    section.value === "messages" && unread > 0 ? `${section.label} (${unread})` : section.label;
  const { layout, setLayout } = useAdminLayout();

  /** Another section - after asking, when a form on this one has unsaved changes. */
  async function openTab(tab: string) {
    if (tab === activeTab || !(await confirmLeave())) return;
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    next.delete("settingsTab");
    next.delete("focus");
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
      case "ai":
        return (
          <>
            {/* The assistant, then the key it works with ("מפתח API" was a section of its own). */}
            <AiIntakeAdmin />
            <ApiKeysAdmin />
          </>
        );
      case "share":
        return (
          <>
            {/* The codes to print, then the installers ("קודי QR" and "הורדת אפליקציות" were two sections).
                The app from Google Play installs nothing beside itself. */}
            <QrCodesAdmin />
            {!storeApp && <AppDownloadsAdmin />}
          </>
        );
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
    if (!(await confirmLeave())) return;
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  }

  const communities = sections.find((section) => section.value === "communities");

  return (
    <div className="min-h-screen">
      {/* The boards' editor takes the whole screen: the site's own header (its menus) is not
          needed there - "חזרה", the steps and "יציאה" lead out (18.10.2026). */}
      {activeTab !== "tv" && <CommunityHeader />}
      {/* Forms read better in a narrow column; the TV editor is a preview
          beside its controls and needs the whole screen. */}
      <main
        dir="rtl"
        className={`gabbai-admin mx-auto min-w-0 px-3 text-right sm:px-4 ${activeTab === "tv" ? "max-w-[1800px] py-2 sm:py-3" : "max-w-5xl py-5 sm:py-8"}`}
        data-focus-tight
      >
        {/* data-focus-hide: hidden while the TV editor is in its work mode (tvEdit.css). */}
        <div className="flex flex-wrap items-center justify-between gap-3" data-focus-hide>
          {activeTab === "tv" ? (
            // The boards' editor: the title, the synagogue and who is signed in - one line.
            <div className="flex min-w-0 max-w-full flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <h1 className="text-xl font-bold">ניהול האתר</h1>
              <ShulNow />
              <span className="break-all text-xs text-muted-foreground">{session?.user.email}</span>
            </div>
          ) : (
            <div className="min-w-0 max-w-full">
              <h1 className="text-2xl font-bold sm:text-3xl">ניהול האתר</h1>
              <ShulNow />
              <p className="mt-1 break-all text-sm text-muted-foreground">{session?.user.email}</p>
            </div>
          )}
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
            {/* Beside the switcher rather than among the tabs: it is about all
                the synagogues, and the tabs below are about the one chosen.
                Not with the tiles: there it is a tile of its own, by the same name. */}
            {isAdmin && layout === "tabs" && communities && (
              <Button
                variant={activeTab === "communities" ? "default" : "outline"}
                aria-pressed={activeTab === "communities"}
                onClick={() => void openTab("communities")}
              >
                <Building2 className="size-4" /> {communities.label}
              </Button>
            )}
            <CommunitySwitcher />
            {/* Two ways into the same screens (adminLayout.ts): a list of tabs (on a
                phone, a list to choose from), or tiles step by step.
                Only for a gabbai - to anyone else there are no screens to lay out. */}
            {isAdmin && (
            <div role="radiogroup" aria-label="פריסת מסך הניהול" className="flex rounded-lg border p-0.5" data-testid="admin-layout-switch">
              {([["tabs", "רשימה", List], ["tiles", "אריחים", LayoutGrid]] as const).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={layout === value}
                  onClick={async () => {
                    if (layout !== value && (await confirmLeave())) setLayout(value);
                  }}
                  className={`flex min-h-11 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm sm:min-h-0 ${layout === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                >
                  <Icon className="size-4" aria-hidden /> {label}
                </button>
              ))}
            </div>
            )}
            <Button variant="outline" onClick={() => void signOut()}>
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
            onValueChange={(tab) => void openTab(tab)}
            className="mt-5 min-w-0 text-right sm:mt-6"
            data-focus-tight
          >
            <div className="sticky top-[var(--app-header-height,7rem)] z-20 bg-background py-2 sm:hidden" data-focus-hide>
              <Select dir="rtl" value={activeTab} onValueChange={(tab) => void openTab(tab)}>
                <SelectTrigger aria-label="מדור ניהול" className="h-12 w-full font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl" position="popper" className="max-h-[60dvh]">
                  {sections.map((section) => (
                    <SelectItem key={section.value} value={section.value} className="min-h-11 py-3">
                      {sectionLabel(section)}
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
                  {sectionLabel(section)}
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
        {/* "הוספה מהירה" does not float here: every section has its own add
            button, and the top bar keeps its small one (AdminFloatingButtons). */}
      </main>
    </div>
  );
}
