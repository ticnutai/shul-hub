import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AnnouncementCard } from "@/components/AnnouncementCard";
import { useAnnouncements } from "@/lib/data";

export const Route = createFileRoute("/announcements")({
  head: () => ({
    meta: [
      { title: "מודעות ומזל טוב — בית הכנסת אושר של יהודי" },
      {
        name: "description",
        content:
          "מודעות מזל טוב, הודעות לציבור המתפללים ועדכונים שוטפים מבית הכנסת אושר של יהודי בבני ברק.",
      },
      { property: "og:title", content: "מודעות ומזל טוב — בית הכנסת אושר של יהודי" },
      {
        property: "og:description",
        content: "כל ההודעות והמודעות לציבור המתפללים במקום אחד.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  const { data = [], isLoading } = useAnnouncements();

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold">מודעות לציבור</h1>
        <p className="mt-2 text-muted-foreground">
          מזל טוב, הודעות ועדכונים לכלל המתפללים.
        </p>
        <div className="gold-rule mt-6 h-px w-full" />

        {isLoading && <p className="mt-8 text-muted-foreground">טוען…</p>}
        {!isLoading && data.length === 0 && (
          <p className="mt-8 text-muted-foreground">אין מודעות פעילות כרגע.</p>
        )}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {data.map((a) => (
            <AnnouncementCard key={a.id} announcement={a} />
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
