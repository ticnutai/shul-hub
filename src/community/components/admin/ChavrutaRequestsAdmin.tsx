import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@community/integrations/supabase/client";
import { useAdminChavrutaRequests } from "@community/lib/data";
import { communityId } from "@/community/lib/community";
import { confirmDelete, useDeleteRow } from "@community/lib/admin";
import { hebrewError } from "@community/lib/hebrewError";
import { AdminError } from "./adminUi";

const labels = {
  level: { beginner: "מתחיל", intermediate: "בינוני", advanced: "מתקדם" },
  intent: { learn: "ללמוד", teach: "ללמד", both: "ללמד וללמוד" },
  format: { chavruta: "חברותא אישית", group: "קבוצה" },
  status: { pending: "ממתינה", approved: "מאושרת", rejected: "נדחתה" },
} as const;

export function ChavrutaRequestsAdmin() {
  const { data = [], isLoading, isError, refetch } = useAdminChavrutaRequests();
  const qc = useQueryClient();

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("chavruta_requests")
        .update({ status })
        .eq("community_id", communityId())
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      toast.success(status === "approved" ? "הבקשה אושרה" : "הבקשה נדחתה");
      invalidate(qc);
    },
    onError: (e: Error) => toast.error(hebrewError(e, "עדכון הבקשה נכשל")),
  });

  // Shown to the gabbai here and, once approved, on the site: both lists refreshed.
  const remove = useDeleteRow("chavruta_requests", ["admin_chavruta_requests", "approved_chavruta_requests"]);

  if (isError) return <div className="card-elev"><AdminError what="בקשות החברותא" onRetry={() => void refetch()} /></div>;
  if (isLoading) return <p className="text-muted-foreground">טוען בקשות…</p>;

  return (
    <div className="space-y-4">
      {/* No heading of its own: the section's name is on its tab or tile, as for every section. */}
      <p className="text-sm text-muted-foreground">
        {data.filter((item) => item.status === "pending").length} בקשות ממתינות לטיפול
      </p>
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
                onClick={async () => {
                  if (await confirmDelete("בקשת החברותא של", request.name)) remove.mutate(request.id);
                }}
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
            <Detail title="טלפון" value={request.phone} ltr />
            <Detail title="אימייל" value={request.email} ltr />
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
/** A phone or an email is written left to right, also inside a Hebrew line. */
function Detail({ title, value, ltr }: { title: string; value: string; ltr?: boolean }) {
  return (
    <div>
      <dt className="text-muted-foreground">{title}</dt>
      <dd className="break-words">{value ? ltr ? <bdi dir="ltr">{value}</bdi> : value : "-"}</dd>
    </div>
  );
}
