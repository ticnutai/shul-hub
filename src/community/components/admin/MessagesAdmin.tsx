import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@community/integrations/supabase/client";
import { useAdminMessages } from "@community/lib/data";
import { communityId } from "@/community/lib/community";
import { confirmDelete, useDeleteRow } from "@community/lib/admin";
import { hebrewError } from "@community/lib/hebrewError";
import { AdminError } from "./adminUi";

export function MessagesAdmin() {
  const { data = [], isLoading, isError, refetch } = useAdminMessages();
  const qc = useQueryClient();

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("admin_messages")
        .update({ is_read: true })
        .eq("community_id", communityId())
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_messages"] }),
    onError: (e: Error) => toast.error(hebrewError(e, "הפעולה נכשלה")),
  });

  const remove = useDeleteRow("admin_messages", "admin_messages");

  return (
    <div className="card-elev divide-y divide-border">
      {isError && <AdminError what="ההודעות" onRetry={() => void refetch()} />}
      {isLoading && <p className="p-6 text-center text-muted-foreground">טוען…</p>}
      {!isLoading && !isError && data.length === 0 && <p className="p-6 text-center text-muted-foreground">אין הודעות.</p>}
      {data.map((m) => (
        <div key={m.id} className="flex items-start gap-3 px-4 py-4">
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {m.subject || "ללא נושא"}
              {!m.is_read && (
                <span className="mr-2 rounded-full bg-gold px-2 py-0.5 text-[11px] text-gold-foreground">
                  חדש
                </span>
              )}
            </p>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{m.body}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {m.sender_name || "אנונימי"}
              {m.phone && (
                <>
                  {" · "}
                  <bdi dir="ltr">{m.phone}</bdi>
                </>
              )}{" "}
              ·{" "}
              {new Intl.DateTimeFormat("he-IL", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: "Asia/Jerusalem",
              }).format(new Date(m.created_at))}
            </p>
          </div>
          {!m.is_read && (
            <Button
              size="icon"
              variant="ghost"
              aria-label={`סימון כנקרא: ${m.subject || "ללא נושא"}`}
              onClick={() => markRead.mutate(m.id)}
            >
              <Check className="size-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            aria-label={`מחיקת ${m.subject || "ההודעה"}`}
            onClick={async () => {
              if (await confirmDelete("ההודעה", m.subject || "ללא נושא")) remove.mutate(m.id);
            }}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  );
}
