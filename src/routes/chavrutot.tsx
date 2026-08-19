import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Clock, Mail, Phone, Users } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ChavrutaRequestDialog } from "@/components/ChavrutaRequestDialog";
import { useApprovedChavrutaRequests, useChavrutot } from "@/lib/data";

export const Route = createFileRoute("/chavrutot")({
  head: () => ({
    meta: [
      { title: "חברותות — בית הכנסת אושר של יהודי" },
      {
        name: "description",
        content:
          "רשימת החברותות בבית הכנסת אושר של יהודי, כולל חברותות פנויות למי שמחפש שותף ללימוד.",
      },
      { property: "og:title", content: "חברותות — בית הכנסת אושר של יהודי" },
      {
        property: "og:description",
        content: "מצא חברותא ללימוד קבוע בבית הכנסת.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChavrutotPage,
});

function ChavrutotPage() {
  const { data = [], isLoading } = useChavrutot();
  const { data: requests = [], isLoading: requestsLoading } = useApprovedChavrutaRequests();
  const active = data.filter((c) => c.active);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold">חברותות</h1>
          <ChavrutaRequestDialog />
        </div>
        <p className="mt-2 text-muted-foreground">לימוד בחברותא — קיימות ומחפשות שותף.</p>
        <div className="gold-rule mt-6 h-px w-full" />

        {isLoading && <p className="mt-8 text-muted-foreground">טוען…</p>}
        {!isLoading && active.length === 0 && (
          <p className="mt-8 text-muted-foreground">עדיין לא נרשמו חברותות.</p>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {active.map((c) => (
            <article key={c.id} className="card-elev p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{c.topic}</h2>
                {c.looking_for_partner && (
                  <span className="rounded-full bg-gold px-2 py-0.5 text-[11px] font-medium text-gold-foreground">
                    מחפשים חברותא
                  </span>
                )}
              </div>
              <dl className="mt-2 space-y-1 text-sm text-muted-foreground">
                {c.partners && (
                  <div className="flex items-center gap-2">
                    <Users className="size-4" />
                    {c.partners}
                  </div>
                )}
                {c.time_text && (
                  <div className="flex items-center gap-2">
                    <Clock className="size-4" />
                    {c.time_text}
                  </div>
                )}
                {c.contact && (
                  <div className="flex items-center gap-2">
                    <Phone className="size-4" />
                    {c.contact}
                  </div>
                )}
              </dl>
            </article>
          ))}
        </div>

        <section className="mt-10" aria-labelledby="approved-requests-title">
          <h2 id="approved-requests-title" className="text-2xl font-bold">
            בקשות חברותא מאושרות
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            פניות של לומדים המחפשים חברותא או קבוצה.
          </p>
          {requestsLoading && <p className="mt-6 text-muted-foreground">טוען בקשות…</p>}
          {!requestsLoading && requests.length === 0 && (
            <p className="mt-6 text-muted-foreground">אין כרגע בקשות מאושרות.</p>
          )}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {requests.map((request) => (
              <ApprovedRequestCard key={request.id} request={request} />
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

const levelLabels: Record<string, string> = {
  beginner: "מתחיל",
  intermediate: "בינוני",
  advanced: "מתקדם",
};
const intentLabels: Record<string, string> = {
  learn: "רוצה ללמוד",
  teach: "רוצה ללמד",
  both: "רוצה ללמד וללמוד",
};
const formatLabels: Record<string, string> = { chavruta: "חברותא אישית", group: "קבוצה" };

function ApprovedRequestCard({
  request,
}: {
  request: ReturnType<typeof useApprovedChavrutaRequests>["data"] extends (infer T)[] | undefined
    ? T
    : never;
}) {
  return (
    <article className="card-elev p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{request.name}</h3>
          <p className="mt-1 font-medium">{request.topic}</p>
        </div>
        <BookOpen className="size-5 text-gold" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-muted px-2.5 py-1">
          {levelLabels[request.level] ?? request.level}
        </span>
        <span className="rounded-full bg-muted px-2.5 py-1">
          {intentLabels[request.intent] ?? request.intent}
        </span>
        <span className="rounded-full bg-muted px-2.5 py-1">
          {formatLabels[request.study_format] ?? request.study_format}
        </span>
      </div>
      <dl className="mt-3 space-y-2 text-sm text-muted-foreground">
        {request.availability && (
          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 size-4 shrink-0" />
            <span>{request.availability}</span>
          </div>
        )}
        {request.notes && <p className="whitespace-pre-line">{request.notes}</p>}
        {request.phone && (
          <div className="flex items-center gap-2">
            <Phone className="size-4" />
            <a dir="ltr" href={`tel:${request.phone}`}>
              {request.phone}
            </a>
          </div>
        )}
        {request.email && (
          <div className="flex items-center gap-2">
            <Mail className="size-4" />
            <a className="break-all" dir="ltr" href={`mailto:${request.email}`}>
              {request.email}
            </a>
          </div>
        )}
      </dl>
    </article>
  );
}
