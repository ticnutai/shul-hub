import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Clock, MapPin, User } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { DAYS_HE, useShiurim } from "@/lib/data";

export const Route = createFileRoute("/shiurim")({
  head: () => ({
    meta: [
      { title: "שיעורי תורה — בית הכנסת אושר של יהודי" },
      {
        name: "description",
        content:
          "לוח שיעורי התורה בבית הכנסת אושר של יהודי: דף יומי, הלכות שבת, פרשת השבוע ועוד — ימים, שעות ומיקום.",
      },
      { property: "og:title", content: "שיעורי תורה — בית הכנסת אושר של יהודי" },
      {
        property: "og:description",
        content: "כל שיעורי התורה השבועיים בבית הכנסת, לפי ימים ושעות.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShiurimPage,
});

function ShiurimPage() {
  const { data = [], isLoading } = useShiurim();
  const active = data.filter((s) => s.active);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold">שיעורי תורה</h1>
        <p className="mt-2 text-muted-foreground">שיעורים קבועים לכלל הציבור.</p>
        <div className="gold-rule mt-6 h-px w-full" />

        {isLoading && <p className="mt-8 text-muted-foreground">טוען…</p>}
        {!isLoading && active.length === 0 && (
          <p className="mt-8 text-muted-foreground">עדיין לא הוגדרו שיעורים.</p>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {active.map((s) => (
            <article key={s.id} className="card-elev p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <BookOpen className="size-4" />
                יום {DAYS_HE[s.day_of_week] ?? ""}
              </div>
              <h2 className="mt-2 text-lg font-semibold">{s.title}</h2>
              <dl className="mt-2 space-y-1 text-sm text-muted-foreground">
                {s.teacher && (
                  <div className="flex items-center gap-2">
                    <User className="size-4" />
                    {s.teacher}
                  </div>
                )}
                {s.time_text && (
                  <div className="flex items-center gap-2">
                    <Clock className="size-4" />
                    {s.time_text}
                  </div>
                )}
                {s.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4" />
                    {s.location}
                  </div>
                )}
              </dl>
              {s.description && <p className="mt-3 text-sm">{s.description}</p>}
            </article>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
