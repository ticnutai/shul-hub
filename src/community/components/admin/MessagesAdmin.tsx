import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@community/integrations/supabase/client";
import { useAdminMessages } from "@community/lib/data";

export function MessagesAdmin() {
  const { data = [] } = useAdminMessages();
  const qc = useQueryClient();

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("admin_messages")
        .update({ is_read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_messages"] }),
    onError: () => toast.error("הפעולה נכשלה"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("admin_messages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_messages"] }),
    onError: () => toast.error("המחיקה נכשלה"),
  });

  return (
    <div className="card-elev divide-y divide-border">
      {data.length === 0 && <p className="p-6 text-center text-muted-foreground">אין הודעות.</p>}
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
              {m.phone ? ` · ${m.phone}` : ""} ·{" "}
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
              aria-label="סימון כנקרא"
              onClick={() => markRead.mutate(m.id)}
            >
              <Check className="size-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            aria-label="מחיקה"
            onClick={() => remove.mutate(m.id)}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  );
}
