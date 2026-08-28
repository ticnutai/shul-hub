import { CommunityHeader } from "@community/components/CommunityChrome";
import { CommunityFooter } from "@community/components/CommunityChrome";
import { AnnouncementCard } from "@community/components/AnnouncementCard";
import { useAnnouncements } from "@community/lib/data";
import { YamimNoraimAnnouncement } from "@/components/YamimNoraimAnnouncement";

export function AnnouncementsPage() {
  const { data = [], isLoading } = useAnnouncements();

  return (
    <div className="min-h-screen">
      <CommunityHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold">מודעות לציבור</h1>
        <p className="mt-2 text-muted-foreground">מזל טוב, הודעות ועדכונים לכלל המתפללים.</p>
        <div className="gold-rule mt-6 h-px w-full" />

        <div className="mt-6">
          <YamimNoraimAnnouncement />
        </div>

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
      <CommunityFooter />
    </div>
  );
}
