import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, Sunrise, Sunset } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { AnnouncementCard } from "@/components/AnnouncementCard";
import { useAnnouncements, useMinyanim, useSettings } from "@/lib/data";
import {
  DAY_TYPE_LABEL,
  dayTypeFor,
  resolveDay,
  zmanimFor,
  type DayType,
} from "@/lib/minyan-time";
import { formatTime, ZMAN_LABELS, type SolarEvent } from "@/lib/zmanim";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "זמני תפילות — בית הכנסת אושר של יהודי, בני ברק" },
      {
        name: "description",
        content:
          "זמני התפילות המעודכנים של בית הכנסת אושר של יהודי בבני ברק: שחרית, מנחה וערבית, זמני היום, מודעות מזל טוב, שיעורים וחברותות.",
      },
      { property: "og:title", content: "זמני תפילות — בית הכנסת אושר של יהודי" },
      {
        property: "og:description",
        content: "לוח זמני תפילות מתעדכן אוטומטית, מודעות לציבור, שיעורים וחברותות.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const SHOWN_ZMANIM: SolarEvent[] = [
  "alot",
  "sunrise",
  "sof_zman_shma",
  "sof_zman_tefila",
  "chatzot",
  "plag",
  "candle",
  "sunset",
  "tzeit",
];

function HomePage() {
  const { data: settings } = useSettings();
  const { data: minyanim = [], isLoading } = useMinyanim();
  const { data: announcements = [] } = useAnnouncements();

  const today = useMemo(() => new Date(), []);
  const [dayType, setDayType] = useState<DayType>(() => dayTypeFor(new Date()));

  const zmanim = useMemo(() => zmanimFor(today, settings), [today, settings]);
  const rows = useMemo(
    () => resolveDay(minyanim, dayType, zmanim),
    [minyanim, dayType, zmanim],
  );

  const dateLabel = new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jerusalem",
  }).format(today);

  const topAnnouncements = announcements.slice(0, 3);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="hero-surface">
        <div className="mx-auto max-w-5xl px-4 py-12 text-center">
          <p className="text-sm opacity-80">{settings?.subtitle || "קהילה, תורה ותפילה"}</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            {settings?.name ?? "בית הכנסת"}
          </h1>
          <div className="gold-rule mx-auto mt-4 h-px w-40" />
          <p className="mt-4 flex items-center justify-center gap-2 text-sm opacity-90">
            <CalendarDays className="size-4" />
            {dateLabel}
          </p>
          <div className="mt-6 flex items-center justify-center gap-6 text-sm">
            <span className="flex items-center gap-2">
              <Sunrise className="size-4" /> נץ {formatTime(zmanim.sunrise)}
            </span>
            <span className="flex items-center gap-2">
              <Sunset className="size-4" /> שקיעה {formatTime(zmanim.sunset)}
            </span>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">זמני התפילות</h2>
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(["weekday", "friday", "shabbat"] as DayType[]).map((d) => (
              <button
                key={d}
                onClick={() => setDayType(d)}
                className={
                  "rounded-md px-3 py-1.5 text-sm transition-colors " +
                  (dayType === d
                    ? "bg-card font-medium text-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {DAY_TYPE_LABEL[d]}
              </button>
            ))}
          </div>
        </div>

        <div className="card-elev mt-4 divide-y divide-border overflow-hidden">
          {isLoading && <p className="p-6 text-center text-muted-foreground">טוען…</p>}
          {!isLoading && rows.length === 0 && (
            <p className="p-6 text-center text-muted-foreground">
              עדיין לא הוגדרו מניינים ליום זה.
            </p>
          )}
          {rows.map(({ minyan, time, source }) => (
            <div key={minyan.id} className="flex items-center gap-4 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{minyan.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {source}
                  {minyan.room ? ` · ${minyan.room}` : ""}
                  {minyan.note ? ` · ${minyan.note}` : ""}
                </p>
              </div>
              <span className="font-display text-2xl font-semibold tabular-nums text-primary">
                {time}
              </span>
            </div>
          ))}
        </div>

        <h2 className="mt-12 text-2xl font-semibold">זמני היום</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SHOWN_ZMANIM.map((z) => (
            <div key={z} className="card-elev px-4 py-3">
              <p className="text-xs text-muted-foreground">{ZMAN_LABELS[z]}</p>
              <p className="font-display text-xl font-semibold tabular-nums">
                {formatTime(zmanim[z])}
              </p>
            </div>
          ))}
        </div>

        {topAnnouncements.length > 0 && (
          <>
            <div className="mt-12 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">מודעות לציבור</h2>
              <Button asChild variant="ghost" size="sm">
                <Link to="/announcements">
                  כל המודעות <ChevronLeft className="size-4" />
                </Link>
              </Button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {topAnnouncements.map((a) => (
                <AnnouncementCard key={a.id} announcement={a} />
              ))}
            </div>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
