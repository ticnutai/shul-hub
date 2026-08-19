import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAdminChavrutaRequests } from "@/lib/data";

const labels = {
  level: { beginner: "מתחיל", intermediate: "בינוני", advanced: "מתקדם" },
  intent: { learn: "ללמוד", teach: "ללמד", both: "ללמד וללמוד" },
  format: { chavruta: "חברותא אישית", group: "קבוצה" },
  status: { pending: "ממתינה", approved: "מאושרת", rejected: "נדחתה" },
} as const;

export function ChavrutaRequestsAdmin() {
  const { data = [], isLoading } = useAdminChavrutaRequests();
  const qc = useQueryClient();

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("chavruta_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      toast.success(status === "approved" ? "הבקשה אושרה" : "הבקשה נדחתה");
      invalidate(qc);
    },
    onError: () => toast.error("עדכון הבקשה נכשל"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chavruta_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("הבקשה נמחקה");
      invalidate(qc);
    },
    onError: () => toast.error("מחיקת הבקשה נכשלה"),
  });

  if (isLoading) return <p className="text-muted-foreground">טוען בקשות…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">בקשות חברותא</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.filter((item) => item.status === "pending").length} בקשות ממתינות לטיפול
        </p>
      </div>
      {data.length === 0 && (
        <div className="card-elev p-6 text-center text-muted-foreground">אין בקשות חברותא.</div>
      )}
      {data.map((request) => (
        <article key={request.id} className="card-elev p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold">{request.name}</h3>
                <Badge
                  variant={
                    request.status === "approved"
                      ? "default"
                      : request.status === "rejected"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {lookup(labels.status, request.status)}
                </Badge>
              </div>
              <p className="mt-1 font-medium">{request.topic}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {request.status !== "approved" && (
                <Button
                  size="sm"
                  onClick={() => updateStatus.mutate({ id: request.id, status: "approved" })}
                >
                  <Check className="size-4" /> אישור
                </Button>
              )}
              {request.status !== "rejected" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatus.mutate({ id: request.id, status: "rejected" })}
                >
                  <X className="size-4" /> דחייה
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                aria-label={`מחיקת הבקשה של ${request.name}`}
                onClick={() =>
                  window.confirm("למחוק את בקשת החברותא?") && remove.mutate(request.id)
                }
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </div>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <Detail title="רמה" value={lookup(labels.level, request.level)} />
            <Detail title="מטרה" value={lookup(labels.intent, request.intent)} />
            <Detail title="מסגרת" value={lookup(labels.format, request.study_format)} />
            <Detail title="זמנים" value={request.availability} />
            <Detail title="טלפון" value={request.phone} />
            <Detail title="אימייל" value={request.email} />
            {request.notes && (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">הערות</dt>
                <dd className="whitespace-pre-line">{request.notes}</dd>
              </div>
            )}
            <Detail title="פרסום פרטי קשר" value={request.share_contact ? "מאושר" : "לא מאושר"} />
            <Detail
              title="נשלחה"
              value={new Intl.DateTimeFormat("he-IL", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: "Asia/Jerusalem",
              }).format(new Date(request.created_at))}
            />
          </dl>
        </article>
      ))}
    </div>
  );
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["admin_chavruta_requests"] });
  qc.invalidateQueries({ queryKey: ["approved_chavruta_requests"] });
}
function lookup(values: Record<string, string>, value: string) {
  return values[value] ?? value;
}
function Detail({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{title}</dt>
      <dd className="break-words">{value || "—"}</dd>
    </div>
  );
}
