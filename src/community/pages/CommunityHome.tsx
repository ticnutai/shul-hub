import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  Clock,
  MessageSquareText,
  Sunrise,
  Sunset,
  Users,
} from "lucide-react";
import { CommunityHeader } from "@community/components/CommunityChrome";
import { CommunityFooter } from "@community/components/CommunityChrome";
import { Button } from "@/components/ui/button";
import { AnnouncementCard } from "@community/components/AnnouncementCard";
import { YamimNoraimAnnouncement } from "@/components/YamimNoraimAnnouncement";
import {
  useAnnouncements,
  useChavrutot,
  useHomeWidgets,
  useMinyanCategories,
  useMinyanim,
  useSettings,
  useShiurim,
  DAYS_HE,
  minyanSubcategories,
} from "@community/lib/data";
import { dayTypeFor, resolveMinyan, zmanimFor } from "@community/lib/minyan-time";
import { formatTime, ZMAN_LABELS, type SolarEvent } from "@community/lib/zmanim";
import { InlineEdit } from "@community/components/InlineEdit";
import { QuickAddButton } from "@community/components/QuickAddButton";

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

function hebrewNumeral(value: number) {
  let remaining = value % 1000;
  const letters: string[] = [];
  const values: Array<[number, string]> = [
    [400, "ת"],
    [300, "ש"],
    [200, "ר"],
    [100, "ק"],
    [90, "צ"],
    [80, "פ"],
    [70, "ע"],
    [60, "ס"],
    [50, "נ"],
    [40, "מ"],
    [30, "ל"],
    [20, "כ"],
    [10, "י"],
    [9, "ט"],
    [8, "ח"],
    [7, "ז"],
    [6, "ו"],
    [5, "ה"],
    [4, "ד"],
    [3, "ג"],
    [2, "ב"],
    [1, "א"],
  ];

  for (const [amount, letter] of values.slice(0, 4)) {
    while (remaining >= amount) {
      letters.push(letter);
      remaining -= amount;
    }
  }
  if (remaining === 15 || remaining === 16) {
    letters.push("ט", remaining === 15 ? "ו" : "ז");
    remaining = 0;
  }
  for (const [amount, letter] of values.slice(4)) {
    while (remaining >= amount) {
      letters.push(letter);
      remaining -= amount;
    }
  }

  if (letters.length === 1) return `${letters[0]}׳`;
  return `${letters.slice(0, -1).join("")}״${letters.at(-1)}`;
}

function formatHebrewDate(date: Date) {
  const parts = new Intl.DateTimeFormat("he-IL-u-ca-hebrew", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jerusalem",
  }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  return `${hebrewNumeral(Number(day))} ${month} ${hebrewNumeral(Number(year))}`;
}

export function CommunityHome() {
  const { data: settings } = useSettings();
  const { data: minyanim = [], isLoading } = useMinyanim();
  const { data: minyanCategories = [], isLoading: categoriesLoading } = useMinyanCategories();
  const { data: announcements = [] } = useAnnouncements();
  const { data: shiurim = [] } = useShiurim();
  const { data: chavrutot = [] } = useChavrutot();
  const { data: widgets = [] } = useHomeWidgets();

  const sectionOrder = useMemo<string[]>(() => {
    const sections = widgets.filter((w) => w.kind === "section");
    if (sections.length === 0)
      return ["minyanim", "zmanim", "announcements", "shiurim", "chavrutot", "contact"];
    return sections.filter((w) => w.visible).map((w) => w.key);
  }, [widgets]);

  const shownZmanim = useMemo<SolarEvent[]>(() => {
    const items = widgets.filter((w) => w.kind === "zman");
    if (items.length === 0) return SHOWN_ZMANIM;
    return items
      .filter((w) => w.visible)
      .map((w) => w.key.replace(/^zman_/, "") as SolarEvent)
      .filter((z) => SHOWN_ZMANIM.includes(z));
  }, [widgets]);

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
  const categoryRows = useMemo(
    () =>
      minyanim
        .filter(
          (minyan) =>
            minyan.active &&
            (minyan.category_id === selectedCategory?.id ||
              (!minyan.category_id && minyan.day_type === selectedCategory?.system_key)),
        )
        .map((minyan) => resolveMinyan(minyan, zmanim))
        .filter((row): row is NonNullable<typeof row> => row !== null)
        .sort((a, b) => a.minutes - b.minutes),
    [minyanim, selectedCategory, zmanim],
  );
  const prayerTabs = useMemo(() => minyanSubcategories(selectedCategory), [selectedCategory]);
  const hasSubcategories = prayerTabs.length > 0;
  const rows = useMemo(
    () =>
      hasSubcategories
        ? categoryRows.filter(({ minyan }) => minyan.prayer === prayer)
        : categoryRows,
    [categoryRows, hasSubcategories, prayer],
  );
  const isListView = selectedCategory?.display_mode === "list";

  useEffect(() => {
    if (prayerTabs.length > 0 && !prayerTabs.some((item) => item.id === prayer)) {
      setPrayer(prayerTabs[0]!.id);
    }
  }, [prayer, prayerTabs]);

  const hebrewDateLabel = formatHebrewDate(today);
  const dateLabel = new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jerusalem",
  }).format(today);

  const homeAnnouncements = announcements.filter((announcement) => announcement.show_on_home);
  const topShiurim = shiurim.filter((shiur) => shiur.active).slice(0, 3);
  const topChavrutot = chavrutot.filter((chavruta) => chavruta.active).slice(0, 3);

  return (
    <div className="min-h-screen">
      <CommunityHeader />

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
          <div className="mt-4 flex items-start justify-center gap-2 text-sm opacity-90">
            <CalendarDays className="mt-0.5 size-4 shrink-0" />
            <div className="text-center">
              <p data-testid="hebrew-date">{hebrewDateLabel}</p>
              <p className="mt-0.5 text-xs opacity-80" data-testid="gregorian-date">
                {dateLabel}
              </p>
            </div>
          </div>
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
        {sectionOrder.map((key, index) => {
          const spacing = index === 0 ? "" : "mt-12";
          if (key === "minyanim") {
            return (
              <section id="minyanim" key={key} className={`${spacing} scroll-mt-48 sm:scroll-mt-40`} data-home-widget={key}>
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
                          const first = minyanSubcategories(category)[0];
                          if (first) setPrayer(first.id);
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

                {!isListView && hasSubcategories && (
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
                )}

                <div
                  className="card-elev mt-4 divide-y divide-border overflow-hidden"
                  data-minyan-display-mode={isListView ? "list" : "tabs"}
                >
                  {(isLoading || categoriesLoading) && (
                    <p className="p-6 text-center text-muted-foreground">טוען…</p>
                  )}
                  {!isLoading &&
                    !categoriesLoading &&
                    (isListView ? categoryRows.length === 0 : rows.length === 0) && (
                      <p className="p-6 text-center text-muted-foreground">
                        עדיין לא הוגדרו מניינים ליום זה.
                      </p>
                    )}
                  {(isListView && hasSubcategories
                    ? prayerTabs.map((prayerItem) => ({
                        prayerItem,
                        rows: categoryRows.filter(({ minyan }) => minyan.prayer === prayerItem.id),
                      }))
                    : [{ prayerItem: null, rows }]
                  ).map(({ prayerItem, rows: displayedRows }) => (
                    <div key={prayerItem?.id ?? prayer}>
                      {prayerItem && (
                        <h3 className="bg-secondary px-4 py-2 text-base font-semibold text-primary">
                          {prayerItem.label}
                        </h3>
                      )}
                      <div className="divide-y divide-border">
                        {displayedRows.length === 0 && prayerItem && (
                          <p className="px-4 py-3 text-sm text-muted-foreground">
                            לא הוגדרו זמני {prayerItem.label}.
                          </p>
                        )}
                        {displayedRows.map(({ minyan, time, source }) => (
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
                    </div>
                  ))}
                </div>
              </section>
            );
          }

          if (key === "zmanim") {
            if (shownZmanim.length === 0) return null;
            return (
              <section key={key} className={spacing} data-home-widget={key}>
                <h2 className="text-2xl font-semibold">זמני היום</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {shownZmanim.map((z) => (
                    <div key={z} className="card-elev px-4 py-3">
                      <p className="text-xs text-muted-foreground">{ZMAN_LABELS[z]}</p>
                      <p className="font-display text-xl font-semibold tabular-nums">
                        {formatTime(zmanim[z])}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            );
          }

          if (key === "announcements") {
            return (
              <section key={key} className={spacing} data-home-widget={key}>
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold">מודעות לציבור</h2>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/community/announcements">
                      כל המודעות <ChevronLeft className="size-4" />
                    </Link>
                  </Button>
                </div>
                <div className="mt-4">
                  <YamimNoraimAnnouncement />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {homeAnnouncements.map((a) => (
                    <AnnouncementCard key={a.id} announcement={a} />
                  ))}
                  {homeAnnouncements.length === 0 && (
                    <p className="card-elev p-5 text-sm text-muted-foreground">
                      אין כרגע מודעות חדשות.
                    </p>
                  )}
                </div>
              </section>
            );
          }

          if (key === "shiurim") {
            return (
              <section key={key} className={spacing} data-home-widget={key}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-semibold">שיעורי תורה</h2>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/community/shiurim">
                      כל השיעורים <ChevronLeft className="size-4" />
                    </Link>
                  </Button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {topShiurim.map((shiur) => (
                    <article key={shiur.id} className="card-elev p-4">
                      <BookOpen className="size-5 text-gold" />
                      <h3 className="mt-2 font-semibold">{shiur.title}</h3>
                      <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="size-4 shrink-0" />
                        {shiur.schedule_type === "daily"
                          ? "בכל יום"
                          : `יום ${DAYS_HE[shiur.day_of_week] ?? ""}`}
                        {shiur.time_text ? ` · ${shiur.time_text}` : ""}
                      </p>
                      {shiur.teacher && (
                        <p className="mt-1 text-sm text-muted-foreground">{shiur.teacher}</p>
                      )}
                    </article>
                  ))}
                  {topShiurim.length === 0 && (
                    <p className="card-elev p-5 text-sm text-muted-foreground">
                      אין כרגע שיעורים להצגה.
                    </p>
                  )}
                </div>
              </section>
            );
          }

          if (key === "chavrutot") {
            return (
              <section key={key} className={spacing} data-home-widget={key}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-semibold">חברותות</h2>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/community/chavrutot">
                      לכל החברותות <ChevronLeft className="size-4" />
                    </Link>
                  </Button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {topChavrutot.map((chavruta) => (
                    <article key={chavruta.id} className="card-elev p-4">
                      <div className="flex items-start justify-between gap-2">
                        <Users className="size-5 shrink-0 text-gold" />
                        {chavruta.looking_for_partner && (
                          <span className="rounded-full bg-gold px-2 py-0.5 text-[11px] font-medium text-gold-foreground">
                            מחפשים שותף
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 font-semibold">{chavruta.topic}</h3>
                      {chavruta.partners && (
                        <p className="mt-2 text-sm text-muted-foreground">{chavruta.partners}</p>
                      )}
                      {chavruta.time_text && (
                        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="size-4" /> {chavruta.time_text}
                        </p>
                      )}
                    </article>
                  ))}
                  {topChavrutot.length === 0 && (
                    <p className="card-elev p-5 text-sm text-muted-foreground">
                      אין כרגע חברותות להצגה.
                    </p>
                  )}
                </div>
              </section>
            );
          }

          if (key === "contact") {
            return (
              <section key={key} className={spacing} data-home-widget={key}>
                <div className="card-elev flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <MessageSquareText className="size-5 text-gold" />
                      <h2 className="text-2xl font-semibold">הודעה לגבאי</h2>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      שאלה, בקשה או עדכון? אפשר לשלוח הודעה ישירות להנהלת בית הכנסת.
                    </p>
                  </div>
                  <Button asChild className="w-full sm:w-auto">
                    <Link to="/community/contact">שליחת הודעה</Link>
                  </Button>
                </div>
              </section>
            );
          }

          return null;
        })}
      </main>

      <CommunityFooter />
      <QuickAddButton />
    </div>
  );
}
