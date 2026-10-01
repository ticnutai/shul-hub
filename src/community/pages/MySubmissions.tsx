import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { BookMarked, CheckCheck, Clock, MessageSquareText, Palette, Pencil, ShieldCheck, Users, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CommunityFooter, CommunityHeader } from "@community/components/CommunityChrome";
import { Button } from "@/components/ui/button";
import { supabase } from "@community/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAccount } from "@community/lib/use-account";
import { useCommunityId, communityId } from "@/community/lib/community";

/**
 * "הפניות שלי": the member's own area on the synagogue's site. Everything they
 * sent the gabbai - messages and chavruta requests - newest first, each with
 * what became of it, and the member's tools (a new message, themes, the
 * Torah app's bookmarks and notes).
 *
 * Only their own rows come back: the database stamps the sender on every new
 * message and request and lets a member read theirs alone
 * (20260927100000_my_submissions.sql).
 */

type Item =
  | { kind: "message"; id: string; at: string; title: string; body: string; read: boolean }
  | { kind: "chavruta"; id: string; at: string; title: string; body: string; status: "pending" | "approved" | "rejected" };

const STATUS = {
  pending: { label: "ממתינה לגבאי", icon: Clock, cls: "bg-amber-500/15 text-amber-700" },
  approved: { label: "אושרה", icon: CheckCheck, cls: "bg-emerald-500/15 text-emerald-700" },
  rejected: { label: "לא אושרה", icon: XCircle, cls: "bg-muted text-muted-foreground" },
} as const;

const when = (iso: string) =>
  new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" }).format(
    new Date(iso),
  );

function useMySubmissions(userId: string | undefined) {
  const community = useCommunityId();
  return useQuery({
    queryKey: ["my-submissions", community, userId],
    enabled: Boolean(userId && community),
    queryFn: async (): Promise<Item[]> => {
      const [messages, requests] = await Promise.all([
        supabase
          .from("admin_messages")
          .select("id,created_at,subject,body,is_read")
          .eq("community_id", communityId())
          .eq("sender_id", userId!)
          .order("created_at", { ascending: false }),
        supabase
          .from("chavruta_requests")
          .select("id,created_at,topic,notes,status,study_format,availability")
          .eq("community_id", communityId())
          .eq("sender_id", userId!)
          .order("created_at", { ascending: false }),
      ]);
      if (messages.error) throw messages.error;
      if (requests.error) throw requests.error;
      const items: Item[] = [
        ...(messages.data ?? []).map((m) => ({
          kind: "message" as const,
          id: m.id,
          at: m.created_at,
          title: m.subject || "הודעה לגבאי",
          body: m.body,
          read: m.is_read,
        })),
        ...(requests.data ?? []).map((r) => ({
          kind: "chavruta" as const,
          id: r.id,
          at: r.created_at,
          title: `בקשת חברותא: ${r.topic}`,
          body: [r.study_format, r.availability, r.notes].filter(Boolean).join(" · "),
          status: (r.status as "pending" | "approved" | "rejected") ?? "pending",
        })),
      ];
      return items.sort((a, b) => b.at.localeCompare(a.at));
    },
  });
}

/**
 * The member's name, changed in place: it is what the site calls them, in the
 * header and here, and what the gabbai sees on what they send. Kept in their
 * profile (profiles.display_name), which the database lets them change alone.
 */
function NameEditor({ current, userId }: { current: string; userId?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(current);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const save = async () => {
    const next = name.trim().slice(0, 60);
    if (!next || !userId) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({ id: userId, display_name: next }, { onConflict: "id" });
    setBusy(false);
    if (error) return toast.error("לא הצלחנו לשמור את השם");
    await queryClient.invalidateQueries({ queryKey: ["profile-name", userId] });
    toast.success("השם עודכן");
    setOpen(false);
  };
  if (!open)
    return (
      <Button type="button" variant="ghost" size="sm" className="gap-1 text-sm font-normal" onClick={() => { setName(current); setOpen(true); }}>
        <Pencil className="h-3.5 w-3.5" /> שינוי שם
      </Button>
    );
  return (
    <span className="flex items-center gap-2 text-base font-normal">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void save()}
        aria-label="השם שלי"
        maxLength={60}
        className="h-9 w-48"
        autoFocus
      />
      <Button type="button" size="sm" onClick={() => void save()} disabled={busy || !name.trim()}>
        שמירה
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        ביטול
      </Button>
    </span>
  );
}

export function MySubmissionsPage() {
  const { user, loading } = useAuth();
  const account = useAccount();
  const signedIn = Boolean(user && !user.is_anonymous);
  const { data: items = [], isLoading, error } = useMySubmissions(signedIn ? user!.id : undefined);

  if (!loading && !signedIn) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen" dir="rtl">
      <CommunityHeader />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="flex flex-wrap items-center gap-2 text-3xl font-bold">
          <span>
            שלום, <span data-testid="my-name">{account.name}</span>
          </span>
          <NameEditor current={account.name} userId={user?.id} />
        </h1>
        <p className="mt-2 truncate text-muted-foreground">
          <span data-testid="my-role" className="font-medium text-foreground">{account.roleLabel}</span>
          {account.email && <> · {account.email}</>}
        </p>
        {account.role === "gabbai" && (
          <Button asChild className="mt-3 gap-2">
            <Link to="/community/admin">
              <ShieldCheck className="h-4 w-4" />
              ניהול בית הכנסת - כל ההודעות, הבקשות והעריכה
            </Link>
          </Button>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link to="/community/contact" data-testid="my-new-message">
              <MessageSquareText className="h-4 w-4" />
              הודעה חדשה לגבאי
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/community/chavrutot">
              <Users className="h-4 w-4" />
              חברותות
            </Link>
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              document.documentElement.dataset.openAppThemes = "true";
              window.dispatchEvent(new CustomEvent("open-app-themes"));
            }}
          >
            <Palette className="h-4 w-4" />
            ערכות נושא
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/profile">
              <BookMarked className="h-4 w-4" />
              סימניות והערות
            </Link>
          </Button>
        </div>

        <h2 className="mt-8 text-xl font-bold">הפניות שלי</h2>
        <section className="mt-3 space-y-3" data-testid="my-submissions">
          {isLoading && <p className="text-muted-foreground">טוען…</p>}
          {error && <p className="text-destructive">לא הצלחנו לטעון את הפניות. נסו שוב מאוחר יותר.</p>}
          {!isLoading && !error && items.length === 0 && (
            <div className="card-elev p-6 text-center text-muted-foreground">
              עוד לא שלחתם פניות. הודעה לגבאי או בקשת חברותא שתשלחו יופיעו כאן, עם מה שנעשה בהן.
            </div>
          )}
          {items.map((item) => {
            const badge =
              item.kind === "message"
                ? item.read
                  ? { label: "הגבאי קרא", icon: CheckCheck, cls: "bg-emerald-500/15 text-emerald-700" }
                  : { label: "טרם נקראה", icon: Clock, cls: "bg-amber-500/15 text-amber-700" }
                : STATUS[item.status] ?? STATUS.pending;
            const Icon = badge.icon;
            return (
              <article key={`${item.kind}:${item.id}`} className="card-elev p-4" data-testid={`my-item-${item.kind}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="text-xs text-muted-foreground">{when(item.at)}</p>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {badge.label}
                  </span>
                </div>
                {item.body && <p className="mt-2 whitespace-pre-line text-sm text-foreground/80">{item.body}</p>}
              </article>
            );
          })}
        </section>
      </main>
      <CommunityFooter />
    </div>
  );
}
