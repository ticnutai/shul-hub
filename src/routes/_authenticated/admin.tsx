import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldAlert } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MinyanimAdmin } from "@/components/admin/MinyanimAdmin";
import { AnnouncementsAdmin, ChavrutotAdmin, ShiurimAdmin } from "@/components/admin/ContentAdmin";
import { MessagesAdmin } from "@/components/admin/MessagesAdmin";
import { SettingsAdmin } from "@/components/admin/SettingsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useAdminMessages } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "ניהול האתר — בית הכנסת אושר של יהודי" },
      {
        name: "description",
        content: "פאנל ניהול לגבאי: זמני תפילות, מניינים, מודעות, שיעורים וחברותות.",
      },
      { property: "og:title", content: "ניהול האתר — בית הכנסת אושר של יהודי" },
      { property: "og:description", content: "פאנל הניהול של בית הכנסת." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { session, isAdmin, loading } = useAuth();
  const { data: messages = [] } = useAdminMessages();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const unread = messages.filter((m) => !m.is_read).length;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">ניהול האתר</h1>
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
          <Tabs defaultValue="minyanim" className="mt-6">
            <TabsList className="flex h-auto flex-wrap justify-start">
              <TabsTrigger value="minyanim">מניינים</TabsTrigger>
              <TabsTrigger value="announcements">מודעות</TabsTrigger>
              <TabsTrigger value="shiurim">שיעורים</TabsTrigger>
              <TabsTrigger value="chavrutot">חברותות</TabsTrigger>
              <TabsTrigger value="messages">הודעות{unread > 0 ? ` (${unread})` : ""}</TabsTrigger>
              <TabsTrigger value="settings">הגדרות</TabsTrigger>
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
            <TabsContent value="messages" className="mt-6">
              <MessagesAdmin />
            </TabsContent>
            <TabsContent value="settings" className="mt-6">
              <SettingsAdmin />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
