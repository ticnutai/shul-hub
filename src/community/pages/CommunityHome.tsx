import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  Clock,
  MessageSquareText,
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
  prayerLabel,
  DAYS_HE,
  minyanSubcategories,
  useMinyanOverrides,
} from "@community/lib/data";
import { overridesFor, resolveCategoryDay, zmanimFor } from "@community/lib/minyan-time";
import { specialDayTitle, specialZmanim, holyEndMinutesFor, todaysCategories } from "@community/lib/specialDays";
import { formatTime, ZMAN_LABELS, type SolarEvent } from "@community/lib/zmanim";
import { HomeHero } from "@community/components/HomeHero";
import { formatHebrewDate } from "@community/lib/hebrewDate";
import { israelMinutes, nextPrayer, normalizeHomeHero } from "@community/lib/homeHero";
import { useNow } from "@community/lib/realtime";
import { QuickAddButton } from "@community/components/QuickAddButton";
import { normalizePrayerLayout } from "@community/components/PrayerLayoutPicker";
import { DaySchedule } from "@community/components/DaySchedule";
import { WeekSchedule } from "@community/components/WeekSchedule";
import { weekSchedule } from "@community/lib/week-schedule";
import { useAuth } from "@community/lib/use-auth";

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

export function CommunityHome() {
  const { isAdmin } = useAuth();
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
  /*
   * Which days and how, as the gabbai set it for the website and the app
   * (settings.minyan_days / minyan_layout, in the admin's "איך יראו זמני
   * התפילות"); the board has its own. With a week chosen the page opens on
   * "כל השבוע"; a day's tab is still a tap away.
   */
  const daysMode = settings?.minyan_days ?? "day";
  const weekOffered = daysMode === "week_today" || daysMode === "week_fixed";
  const [pickedView, setPickedView] = useState<"week" | "day" | null>(null);
  const weekView = weekOffered && pickedView !== "day";
  const layoutFor = (category: { display_mode?: string | null } | undefined) =>
    normalizePrayerLayout(settings?.minyan_layout ?? category?.display_mode);

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
  const special = useMemo(
    () => specialZmanim(today, zmanim, holyEndMinutesFor(settings)),
    [today, zmanim, settings],
  );
  // The phone must agree with the wall: the same rows, the same one-day
  // exceptions, worked out by the same function.
  const categoryRows = useMemo(
    () => (selectedCategory ? resolveCategoryDay(minyanim, selectedCategory, today, zmanim, todayOverrides) : []),
    [minyanim, selectedCategory, zmanim, todayOverrides, today],
  );
  const week = useMemo(
    () =>
      weekView
        ? weekSchedule({
            categories: minyanCategories,
            minyanim,
            settings,
            today,
            order: daysMode === "week_fixed" ? "fixed" : "today_first",
            todayOverrides,
          })
        : [],
    [weekView, daysMode, minyanCategories, minyanim, settings, today, todayOverrides],
  );

  /**
   * The next prayer of today, for the strip: from every category of today,
   * as the times above list them (the day's exceptions and cancellations too),
   * looked at again every half minute.
   */
  const now = useNow(30_000);
  const todaysPrayers = useMemo(
    () =>
      visibleCategories.flatMap((category) =>
        resolveCategoryDay(minyanim, category, today, zmanim, todayOverrides).map((r) => ({
          label: r.minyan.label || prayerLabel(minyanSubcategories(category), r.minyan.prayer),
          time: r.time,
          minutes: r.minutes,
          cancelled: r.cancelled,
        })),
      ),
    [visibleCategories, minyanim, today, zmanim, todayOverrides],
  );
  const upcoming = nextPrayer(todaysPrayers, israelMinutes(now));

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

      <HomeHero
        hero={normalizeHomeHero((settings as { home_hero?: unknown } | null | undefined)?.home_hero)}
        headerShowsName={settings?.home_header_variant !== "karovim_logo"}
        settings={settings}
        hebrewDate={hebrewDateLabel}
        dateLabel={dateLabel}
        sunrise={formatTime(zmanim.sunrise)}
        sunset={formatTime(zmanim.sunset)}
        next={upcoming}
      />

      <main className="mx-auto grid max-w-5xl grid-cols-1 gap-x-6 gap-y-12 px-4 py-10 text-right sm:grid-cols-2 sm:py-12">
        {sectionOrder.map((key) => {
          const sectionClass = sectionWidths.get(key) === "half" ? "sm:col-span-1" : "sm:col-span-2";
          if (key === "minyanim") {
            return (
              <section id="minyanim" key={key} className={`${sectionClass} scroll-mt-48 sm:scroll-mt-40`} data-home-widget={key} data-widget-width={sectionWidths.get(key) ?? "full"}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-semibold">זמני התפילות</h2>
                    {isAdmin && (
                      <Link
                        to="/community/admin?tab=minyanim#prayer-display"
                        className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        title="אילו ימים מוצגים ואיך - נקבע במקום אחד, בניהול המניינים"
                      >
                        עריכת התצוגה
                      </Link>
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
                          setPickedView("day");
                          setCategoryId(category.id);
                        }}
                        aria-pressed={!weekView && selectedCategory?.id === category.id}
                        className={
                          "rounded-md px-3 py-1.5 text-sm transition-colors " +
                          (!weekView && selectedCategory?.id === category.id
                            ? "bg-card font-medium text-foreground shadow-soft"
                            : "text-muted-foreground hover:text-foreground")
                        }
                      >
                        {category.name}
                      </button>
                    ))}
                    {weekOffered && (
                    <button
                      type="button"
                      data-testid="minyanim-week"
                      aria-pressed={weekView}
                      onClick={() => setPickedView("week")}
                      title="כל ימי השבוע במבט אחד: ימות החול, שישי ושבת"
                      className={
                        "rounded-md px-3 py-1.5 text-sm transition-colors " +
                        (weekView
                          ? "bg-card font-medium text-foreground shadow-soft"
                          : "text-muted-foreground hover:text-foreground")
                      }
                    >
                      כל השבוע
                    </button>
                    )}
                  </div>
                </div>

                {weekView ? (
                  <WeekSchedule days={week} layoutFor={layoutFor} />
                ) : isLoading || categoriesLoading ? (
                  <p className="card-elev mt-4 p-6 text-center text-muted-foreground">טוען…</p>
                ) : (
                  <DaySchedule
                    key={selectedCategory?.id ?? "none"}
                    rows={categoryRows}
                    prayerTabs={minyanSubcategories(selectedCategory)}
                    layout={layoutFor(selectedCategory)}
                  />
                )}
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
