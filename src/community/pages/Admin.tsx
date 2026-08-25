import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, LogOut, ShieldAlert } from "lucide-react";
import { CommunityHeader } from "@community/components/CommunityChrome";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MinyanimAdmin } from "@community/components/admin/MinyanimAdmin";
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

export function AdminPage() {
  const { session, isAdmin, loading } = useAuth();
  const { data: messages = [] } = useAdminMessages();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();

  const requestedTab = searchParams.get("tab");
  const activeTab = [
    "minyanim", "announcements", "shiurim", "chavrutot", "chavruta-requests",
    "messages", "widgets", "settings", "users", "data", "qr",
  ].includes(requestedTab ?? "") ? requestedTab! : "minyanim";

  const unread = messages.filter((m) => !m.is_read).length;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  }

  return (
    <div className="min-h-screen">
      <CommunityHeader />
      <main dir="rtl" className="mx-auto max-w-5xl px-3 py-5 text-right sm:px-4 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">ניהול האתר</h1>
            <p className="mt-1 text-sm text-muted-foreground">{session?.user.email}</p>
          </div>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="size-4" /> יציאה
          </Button>
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
            </TabsList>

            <TabsContent value="minyanim" className="mt-6">
              <MinyanimAdmin />
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
          </Tabs>
        )}
        <QuickAddButton />
      </main>
    </div>
  );
}
