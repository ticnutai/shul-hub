import { createFileRoute } from "@tanstack/react-router";
import { Clock, Phone, Users } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useChavrutot } from "@/lib/data";

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
  const active = data.filter((c) => c.active);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold">חברותות</h1>
        <p className="mt-2 text-muted-foreground">
          לימוד בחברותא — קיימות ומחפשות שותף.
        </p>
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
      </main>
      <SiteFooter />
    </div>
  );
}
