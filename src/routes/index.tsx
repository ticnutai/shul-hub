import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, Sunrise, Sunset } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { AnnouncementCard } from "@/components/AnnouncementCard";
import { useAnnouncements, useMinyanCategories, useMinyanim, useSettings } from "@/lib/data";
import { dayTypeFor, resolveMinyan, zmanimFor } from "@/lib/minyan-time";
import { formatTime, ZMAN_LABELS, type SolarEvent } from "@/lib/zmanim";
import { InlineEdit } from "@/components/InlineEdit";
import { QuickAddButton } from "@/components/QuickAddButton";

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
  const { data: minyanCategories = [], isLoading: categoriesLoading } = useMinyanCategories();
  const { data: announcements = [] } = useAnnouncements();

  const today = useMemo(() => new Date(), []);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [prayer, setPrayer] = useState("shacharit");

  const zmanim = useMemo(() => zmanimFor(today, settings), [today, settings]);
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(today);
  const visibleCategories = useMemo(
    () =>
      minyanCategories.filter(
        (category) =>
          category.active &&
          (!category.visible_from || category.visible_from <= todayKey) &&
          (!category.visible_until || category.visible_until >= todayKey),
      ),
    [minyanCategories, todayKey],
  );
  const preferredSystemKey = dayTypeFor(today);
  const selectedCategory =
    visibleCategories.find((category) => category.id === categoryId) ??
    visibleCategories.find((category) => category.system_key === preferredSystemKey) ??
    visibleCategories[0];
  const rows = useMemo(
    () =>
      minyanim
        .filter(
          (minyan) =>
            minyan.active &&
            minyan.prayer === prayer &&
            (minyan.category_id === selectedCategory?.id ||
              (!minyan.category_id && minyan.day_type === selectedCategory?.system_key)),
        )
        .map((minyan) => resolveMinyan(minyan, zmanim))
        .filter((row): row is NonNullable<typeof row> => row !== null)
        .sort((a, b) => a.minutes - b.minutes),
    [minyanim, prayer, selectedCategory, zmanim],
  );
  const prayerTabs =
    selectedCategory?.system_key === "friday" ? PRAYER_TABS.slice(0, 1) : PRAYER_TABS;

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
        <div className="mx-auto max-w-5xl px-4 py-14 text-center sm:py-16">
          <p className="text-sm text-gold sm:text-base">
            {settings?.id ? (
              <InlineEdit
                table="settings"
                id={settings.id}
                field="subtitle"
                value={settings.subtitle}
                queryKey="settings"
                display={settings.subtitle || "קהילה, תורה ותפילה"}
              />
            ) : (
              settings?.subtitle || "קהילה, תורה ותפילה"
            )}
          </p>
          <h1 className="mt-3 text-4xl font-bold text-primary-foreground sm:text-5xl">
            {settings?.id ? (
              <InlineEdit
                table="settings"
                id={settings.id}
                field="name"
                value={settings.name}
                queryKey="settings"
                display={settings.name || "בית הכנסת"}
              />
            ) : (
              (settings?.name ?? "בית הכנסת")
            )}
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

      <main className="mx-auto max-w-5xl px-4 py-10 text-right sm:py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">זמני התפילות</h2>
          <div
            role="group"
            className="flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1"
            aria-label="קטגוריות מניינים"
          >
            {visibleCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  setCategoryId(category.id);
                  if (category.system_key === "friday") setPrayer("shacharit");
                }}
                className={
                  "rounded-md px-3 py-1.5 text-sm transition-colors " +
                  (selectedCategory?.id === category.id
                    ? "bg-card font-medium text-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        <div
          role="group"
          className="mt-3 flex gap-1 rounded-lg bg-secondary p-1"
          aria-label="סוג תפילה"
        >
          {prayerTabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setPrayer(item.id)}
              className={
                "flex-1 rounded-md px-3 py-2 text-sm transition-colors " +
                (prayer === item.id
                  ? "bg-primary font-medium text-primary-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="card-elev mt-4 divide-y divide-border overflow-hidden">
          {(isLoading || categoriesLoading) && (
            <p className="p-6 text-center text-muted-foreground">טוען…</p>
          )}
          {!isLoading && !categoriesLoading && rows.length === 0 && (
            <p className="p-6 text-center text-muted-foreground">
              עדיין לא הוגדרו מניינים ליום זה.
            </p>
          )}
          {rows.map(({ minyan, time, source }) => (
            <div key={minyan.id} className="flex items-center gap-4 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  <InlineEdit
                    table="minyanim"
                    id={minyan.id}
                    field="label"
                    value={minyan.label}
                    queryKey="minyanim"
                  />
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {source}
                  {minyan.room ? ` · ${minyan.room}` : ""}
                  {minyan.note ? ` · ${minyan.note}` : ""}
                </p>
              </div>
              <span className="font-display text-2xl font-semibold tabular-nums text-primary">
                {minyan.time_mode === "fixed" ? (
                  <InlineEdit
                    table="minyanim"
                    id={minyan.id}
                    field="fixed_time"
                    value={minyan.fixed_time ? minyan.fixed_time.slice(0, 5) : ""}
                    as="time"
                    display={time}
                    queryKey="minyanim"
                    inputClassName="text-2xl"
                  />
                ) : (
                  time
                )}
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
      <QuickAddButton />
    </div>
  );
}

const PRAYER_TABS = [
  { id: "shacharit", label: "שחרית" },
  { id: "mincha", label: "מנחה" },
  { id: "arvit", label: "ערבית" },
] as const;
