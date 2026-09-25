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
  prayerLabel,
  useMinyanOverrides,
} from "@community/lib/data";
import { overridesFor, resolveMinyan, zmanimFor } from "@community/lib/minyan-time";
import { specialDayTitle, specialZmanim, todaysCategories } from "@community/lib/specialDays";
import { formatTime, ZMAN_LABELS, type SolarEvent } from "@community/lib/zmanim";
import { InlineEdit } from "@community/components/InlineEdit";
import { QuickAddButton } from "@community/components/QuickAddButton";
import {
  normalizePrayerLayout,
  PrayerLayoutPicker,
} from "@community/components/PrayerLayoutPicker";
import { CardsLayout, TimelineLayout } from "@community/components/PrayerScheduleLayouts";
import { useAuth } from "@community/lib/use-auth";
import { useSaveRow } from "@community/lib/admin";

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
  const { isAdmin } = useAuth();
  const { data: settings } = useSettings();
  const { data: minyanim = [], isLoading } = useMinyanim();
  const { data: minyanCategories = [], isLoading: categoriesLoading } = useMinyanCategories();
  const { data: announcements = [] } = useAnnouncements();
  const { data: shiurim = [] } = useShiurim();
  const { data: chavrutot = [] } = useChavrutot();
  const { data: widgets = [] } = useHomeWidgets();
  const saveCategoryLayout = useSaveRow("minyan_categories", "minyan_categories");

  const sectionOrder = useMemo<string[]>(() => {
    const sections = widgets.filter((w) => w.kind === "section");
    if (sections.length === 0)
      return ["minyanim", "zmanim", "announcements", "shiurim", "chavrutot", "contact"];
    return sections.filter((w) => w.visible).map((w) => w.key);
  }, [widgets]);

  const sectionWidths = useMemo(
    () =>
      new Map(
        widgets
          .filter((widget) => widget.kind === "section")
          .map((widget) => [widget.key, widget.layout_width === "half" ? "half" : "full"]),
      ),
    [widgets],
  );

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
  // One-day exceptions to the timetable. Empty on almost every day, and on
  // those days nothing below behaves any differently.
  const { data: overrideRows } = useMinyanOverrides();
  const todayOverrides = useMemo(() => overridesFor(overrideRows, today), [overrideRows, today]);
  // On a special day with its own timetable (יום כיפור, צום גדליה) that tab
  // replaces the ordinary ones; any other day the ordinary tabs, never an
  // event's (specialDays.ts - the wall uses the same rule).
  const todays = useMemo(() => todaysCategories(minyanCategories, today), [minyanCategories, today]);
  const visibleCategories = todays.categories;
  const selectedCategory =
    visibleCategories.find((category) => category.id === categoryId) ??
    todays.preferred ??
    visibleCategories[0];
  const specialTitle = useMemo(() => specialDayTitle(today), [today]);
  const special = useMemo(() => specialZmanim(today, zmanim), [today, zmanim]);
  const categoryRows = useMemo(
    () =>
      minyanim
        .filter(
          (minyan) =>
            minyan.active &&
            (minyan.category_id === selectedCategory?.id ||
              (!minyan.category_id && minyan.day_type === selectedCategory?.system_key)),
        )
        // The phone must agree with the wall: the same one-day exceptions,
        // resolved by the same function.
        .map((minyan) => resolveMinyan(minyan, zmanim, todayOverrides.get(minyan.id)))
        .filter((row): row is NonNullable<typeof row> => row !== null)
        .sort((a, b) => a.minutes - b.minutes),
    [minyanim, selectedCategory, zmanim, todayOverrides],
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
  const prayerLayout = normalizePrayerLayout(selectedCategory?.display_mode);
  const isListView = prayerLayout === "list";
  const isTableView = prayerLayout === "table";
  const isTimelineView = prayerLayout === "timeline";
  const isCardsView = prayerLayout === "cards";

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

      <main className="mx-auto grid max-w-5xl grid-cols-1 gap-x-6 gap-y-12 px-4 py-10 text-right sm:grid-cols-2 sm:py-12">
        {sectionOrder.map((key) => {
          const sectionClass = sectionWidths.get(key) === "half" ? "sm:col-span-1" : "sm:col-span-2";
          if (key === "minyanim") {
            return (
              <section id="minyanim" key={key} className={`${sectionClass} scroll-mt-48 sm:scroll-mt-40`} data-home-widget={key} data-widget-width={sectionWidths.get(key) ?? "full"}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-semibold">זמני התפילות</h2>
                    {isAdmin && selectedCategory && (
                      <PrayerLayoutPicker
                        value={prayerLayout}
                        disabled={saveCategoryLayout.isPending}
                        onChange={(displayMode) =>
                          saveCategoryLayout.mutate({ id: selectedCategory.id, display_mode: displayMode })
                        }
                      />
                    )}
                  </div>
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

                {prayerLayout === "tabs" && hasSubcategories && (
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
                  data-minyan-display-mode={prayerLayout}
                >
                  {(isLoading || categoriesLoading) && (
                    <p className="p-6 text-center text-muted-foreground">טוען…</p>
                  )}
                  {!isLoading &&
                    !categoriesLoading &&
                    (prayerLayout !== "tabs" ? categoryRows.length === 0 : rows.length === 0) && (
                      <p className="p-6 text-center text-muted-foreground">
                        עדיין לא הוגדרו מניינים ליום זה.
                      </p>
                    )}
                  {isTimelineView && categoryRows.length > 0 ? (
                    <TimelineLayout rows={categoryRows} prayerTabs={prayerTabs} />
                  ) : isCardsView && categoryRows.length > 0 ? (
                    <CardsLayout rows={categoryRows} prayerTabs={prayerTabs} />
                  ) : isTableView && categoryRows.length > 0 ? (
                    <>
                      <div className="divide-y divide-border sm:hidden" data-testid="prayer-table-mobile">
                        {categoryRows.map(({ minyan, time, source }) => {
                          const label = prayerLabel(prayerTabs, minyan.prayer);
                          return (
                            <div key={minyan.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-primary">{label}</p>
                                <p className="truncate font-medium">
                                  <InlineEdit table="minyanim" id={minyan.id} field="label" value={minyan.label} queryKey="minyanim" />
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {[minyan.room, minyan.note, source].filter(Boolean).join(" · ")}
                                </p>
                              </div>
                              <span className="font-display text-2xl font-semibold tabular-nums text-primary">{time}</span>
                            </div>
                          );
                        })}
                      </div>
                      <table className="hidden w-full table-fixed border-collapse text-right sm:table" data-testid="prayer-table-desktop">
                        <thead className="bg-secondary text-sm text-muted-foreground">
                          <tr>
                            <th className="w-1/5 px-4 py-2 font-medium">תפילה</th>
                            <th className="w-2/5 px-4 py-2 font-medium">מניין</th>
                            <th className="w-1/4 px-4 py-2 font-medium">מיקום והערה</th>
                            <th className="w-[15%] px-4 py-2 font-medium">שעה</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {categoryRows.map(({ minyan, time, source }) => (
                            <tr key={minyan.id}>
                              <td className="px-4 py-3 font-semibold text-primary">
                                {prayerLabel(prayerTabs, minyan.prayer)}
                              </td>
                              <td className="truncate px-4 py-3 font-medium">
                                <InlineEdit table="minyanim" id={minyan.id} field="label" value={minyan.label} queryKey="minyanim" />
                              </td>
                              <td className="truncate px-4 py-3 text-sm text-muted-foreground">
                                {[minyan.room, minyan.note, source].filter(Boolean).join(" · ")}
                              </td>
                              <td className="px-4 py-3 font-display text-xl font-semibold tabular-nums text-primary">{time}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : (isListView && hasSubcategories
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
              <section key={key} className={sectionClass} data-home-widget={key} data-widget-width={sectionWidths.get(key) ?? "full"}>
                <h2 className="text-2xl font-semibold">זמני היום</h2>
                {special.length > 0 && (
                  <div className="mt-4">
                    {specialTitle && <p className="mb-2 text-sm font-semibold text-gold">{specialTitle}</p>}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {special.map((r) => (
                        <div key={r.key} className="card-elev border-2 border-gold/50 px-4 py-3">
                          <p className="text-xs font-semibold text-muted-foreground">{r.label}</p>
                          <p className="font-display text-xl font-bold tabular-nums">{formatTime(r.time)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
              <section key={key} className={sectionClass} data-home-widget={key} data-widget-width={sectionWidths.get(key) ?? "full"}>
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold">מודעות לציבור</h2>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/community/announcements">
                      כל המודעות <ChevronLeft className="size-4" />
                    </Link>
                  </Button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {homeAnnouncements.map((a) => (
                    <div
                      key={a.id}
                      className={a.home_width === "full" ? "sm:col-span-2" : "sm:col-span-1"}
                      data-announcement-home-width={a.home_width === "full" ? "full" : "half"}
                    >
                      <AnnouncementCard announcement={a} />
                    </div>
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
              <section key={key} className={sectionClass} data-home-widget={key} data-widget-width={sectionWidths.get(key) ?? "full"}>
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
              <section key={key} className={sectionClass} data-home-widget={key} data-widget-width={sectionWidths.get(key) ?? "full"}>
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
              <section key={key} className={sectionClass} data-home-widget={key} data-widget-width={sectionWidths.get(key) ?? "full"}>
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
