/**
 * The strip at the top of the home page, in the layout and look the gabbai
 * chose (lib/homeHero.ts). The same component draws the page itself and the
 * preview in the admin, so what is chosen is what is shown.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { CalendarDays, Clock, Sunrise, Sunset } from "lucide-react";

import { InlineEdit } from "@community/components/InlineEdit";
import { heroShowsName, inWords, type HeroLook, type HomeHero as Hero, type NextPrayer } from "@community/lib/homeHero";

interface Look { className?: string; style?: CSSProperties; accent: string; card: string; dark: boolean }

/** Each look: its ground, its letters, its gold, and its small cards. */
const LOOK: Record<HeroLook, Look> = {
  royal: { className: "hero-surface", accent: "hsl(var(--accent))", card: "border-white/15 bg-white/10", dark: true },
  night: { style: { background: "linear-gradient(160deg, #0b1628, #1b2a4a)", color: "#f5ecd7" }, accent: "#e3c27a", card: "border-[#e3c27a]/30 bg-white/5", dark: true },
  parchment: { style: { background: "linear-gradient(160deg, #fbf5e6, #efe1bf)", color: "#3b2a12" }, accent: "#9a7425", card: "border-[#9a7425]/30 bg-white/60", dark: false },
  emerald: { style: { background: "linear-gradient(160deg, #0d3b2e, #17604a)", color: "#f3ead2" }, accent: "#e6c66f", card: "border-[#e6c66f]/30 bg-white/5", dark: true },
  burgundy: { style: { background: "linear-gradient(160deg, #3d0f1a, #6e1d2f)", color: "#fbeee0" }, accent: "#e9c27c", card: "border-[#e9c27c]/30 bg-white/5", dark: true },
  // Warm stone in the light of the afternoon: a soft grain of light across it, the ink of old brown.
  stone: {
    style: { background: "radial-gradient(ellipse at 20% 0%, rgba(255,255,255,.55), transparent 55%), linear-gradient(160deg, #f1e8d6, #d8c7a4)", color: "#3e2e14" },
    accent: "#8a6a2a", card: "border-[#8a6a2a]/30 bg-white/50", dark: false,
  },
  // Black stone with a thread of gold along its top and bottom.
  onyx: {
    style: { background: "linear-gradient(160deg, #0d0d0f, #26231f)", color: "#f4ead2", boxShadow: "inset 0 2px 0 #c9a45d, inset 0 -2px 0 #c9a45d" },
    accent: "#d9b56a", card: "border-[#d9b56a]/35 bg-white/5", dark: true,
  },
  // On the page's light ground the site's gold is too pale to read: a darker gold.
  plain: { className: "border-b border-border bg-background text-foreground", accent: "#9a7425", card: "border-border bg-card", dark: false },
};

/**
 * A picture of the synagogue behind the strip: under a shade, so the letters
 * read on any picture - light letters on a dark shade, or dark on a light one.
 */
function pictureLook(image: string, shade: Hero["shade"]): Look {
  const dark = shade === "dark";
  const veil = dark ? "linear-gradient(rgba(8, 14, 28, 0.62), rgba(8, 14, 28, 0.72))" : "linear-gradient(rgba(255, 250, 240, 0.72), rgba(255, 250, 240, 0.8))";
  return {
    style: { backgroundImage: `${veil}, url("${image}")`, backgroundSize: "cover", backgroundPosition: "center", color: dark ? "#fff8ea" : "#2b2010" },
    accent: dark ? "#f0cf86" : "#8a6a2a",
    card: dark ? "border-white/25 bg-black/25 backdrop-blur-sm" : "border-black/10 bg-white/60 backdrop-blur-sm",
    dark,
  };
}

/** A phone's width (and the app's): where "another layout on a phone" applies. */
function useIsPhone(): boolean {
  const query = "(max-width: 639px)";
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(query);
    const on = () => setPhone(list.matches);
    on();
    list.addEventListener?.("change", on);
    return () => list.removeEventListener?.("change", on);
  }, []);
  return phone;
}

export interface HomeHeroProps {
  hero: Hero;
  /** The header right above shows the name (not a logo): the strip need not repeat it. */
  headerShowsName: boolean;
  settings: { id?: string; name?: string | null; subtitle?: string | null } | null | undefined;
  hebrewDate: string;
  dateLabel: string;
  sunrise: string;
  sunset: string;
  /** The next prayer of today, if any is left (shown when hero.next). */
  next?: NextPrayer | null;
  /** In the admin's preview: plain text, no editing in place. */
  preview?: boolean;
  /** The admin's preview, as a phone or as a computer, whatever the admin's own screen is. */
  device?: "phone" | "computer";
}

export function HomeHero({ hero, headerShowsName, settings, hebrewDate, dateLabel, sunrise, sunset, next = null, preview = false, device }: HomeHeroProps) {
  const isPhone = useIsPhone();
  const phone = device ? device === "phone" : isPhone;
  const layout = phone && hero.phoneLayout ? hero.phoneLayout : hero.layout;
  if (layout === "none") {
    // Still one heading for the page, for screen readers - just not on the screen.
    return <h1 className="sr-only">{settings?.name ?? "בית הכנסת"}</h1>;
  }
  const look = hero.image && layout !== "cards" ? pictureLook(hero.image, hero.shade) : LOOK[hero.look];
  const showName = heroShowsName(hero, headerShowsName);
  const editable = !preview && Boolean(settings?.id);
  const subtitleText = settings?.subtitle || "קהילה, תורה ותפילה";
  const nameText = settings?.name || "בית הכנסת";

  const subtitle = hero.subtitle ? (
    editable ? (
      <InlineEdit table="settings" id={settings!.id!} field="subtitle" value={settings!.subtitle ?? ""} queryKey="settings" display={subtitleText} />
    ) : (
      subtitleText
    )
  ) : null;
  const name = editable ? (
    <InlineEdit table="settings" id={settings!.id!} field="name" value={settings!.name ?? ""} queryKey="settings" display={nameText} />
  ) : (
    nameText
  );
  // The page's one heading: the name, or - where the strip leaves it to the header - kept for screen readers.
  const heading = (className: string) =>
    showName ? <h1 className={className}>{name}</h1> : <h1 className="sr-only">{nameText}</h1>;

  const icon = (Icon: typeof Clock, size = "size-4") => <Icon className={`${size} shrink-0`} style={{ color: look.accent }} aria-hidden />;
  const date = hero.date ? (
    <div className="flex items-start justify-center gap-2 text-sm">
      <span className="mt-0.5">{icon(CalendarDays)}</span>
      <div className="text-center">
        <p data-testid="hebrew-date">{hebrewDate}</p>
        <p className="mt-0.5 text-xs opacity-80" data-testid="gregorian-date">{dateLabel}</p>
      </div>
    </div>
  ) : null;
  const shownNext = hero.next ? next : null;
  const nextLine = shownNext ? (
    <span className="flex flex-wrap items-center justify-center gap-x-1.5" data-testid="hero-next-prayer">
      {icon(Clock)}
      <span>התפילה הבאה:</span>
      <b>{shownNext.label} {shownNext.time}</b>
      <span className="opacity-80">· {inWords(shownNext.inMinutes)}</span>
    </span>
  ) : null;
  const times = hero.zmanim ? (
    <>
      <span className="flex items-center gap-2">{icon(Sunrise)} נץ {sunrise}</span>
      <span className="flex items-center gap-2">{icon(Sunset)} שקיעה {sunset}</span>
    </>
  ) : null;

  /**
   * The small cards of "שני טורים" and "כרטיסים": on a phone two to a row, the
   * date and the next prayer each a row of its own; wider, all on one row,
   * the long ones given the room to stand on their lines.
   */
  const items: { key: string; body: ReactNode; wide: boolean }[] = [
    ...(date ? [{ key: "date", body: date, wide: true }] : []),
    ...(hero.zmanim
      ? [
          { key: "sunrise", body: <>{icon(Sunrise, "size-5")}<span>נץ {sunrise}</span></>, wide: false },
          { key: "sunset", body: <>{icon(Sunset, "size-5")}<span>שקיעה {sunset}</span></>, wide: false },
        ]
      : []),
    ...(shownNext
      ? [{ key: "next", body: <>{icon(Clock, "size-5")}<span className="text-xs opacity-80">התפילה הבאה</span><b>{shownNext.label} {shownNext.time}</b><span className="text-xs opacity-80">{inWords(shownNext.inMinutes)}</span></>, wide: true }]
      : []),
  ];
  // Four cards in half the strip ("שני טורים") stand two by two: in one row they were too narrow to read.
  const grid = (cardClass: (key: string) => string, cardStyle?: CSSProperties, square = false) => (
    <div
      className={square ? "grid grid-cols-2 gap-2" : "grid grid-cols-2 gap-2 min-[420px]:[grid-template-columns:var(--hero-cols)]"}
      style={{ "--hero-cols": items.map((i) => (i.wide ? "1.5fr" : "1fr")).join(" ") } as CSSProperties}
    >
      {(square ? [...items].sort((a, b) => Number(b.wide) - Number(a.wide)) : items).map((i) => (
        <div key={i.key} data-hero-card={i.key}
          className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl border px-3 py-2 text-center text-sm ${i.wide && !square ? "col-span-2 min-[420px]:col-span-1" : ""} ${cardClass(i.key)}`}
          style={cardStyle}>
          {i.body}
        </div>
      ))}
    </div>
  );
  const surface = (children: ReactNode, pad: string) => (
    <section data-testid="home-hero" data-hero-layout={layout} data-hero-look={hero.image ? "picture" : hero.look} className={look.className} style={look.style}>
      <div className={`mx-auto max-w-5xl px-4 ${pad}`}>{children}</div>
    </section>
  );

  if (layout === "compact") {
    return surface(
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-center">
        {showName ? heading("text-xl font-bold") : heading("")}
        {subtitle && <p className="text-sm" style={{ color: look.accent }}>{subtitle}</p>}
        {date}
        {times && <div className="flex items-center gap-5 text-sm">{times}</div>}
        {nextLine && <div className="text-sm">{nextLine}</div>}
      </div>,
      "py-3 sm:py-4",
    );
  }

  if (layout === "split") {
    return surface(
      <div className="grid items-center gap-6 sm:grid-cols-2">
        <div className="text-center sm:text-right">
          {subtitle && <p className={showName ? "text-sm sm:text-base" : "text-2xl font-bold sm:text-3xl"} style={{ color: look.accent }}>{subtitle}</p>}
          {heading("mt-2 text-3xl font-bold sm:text-4xl")}
          <div className="mx-auto mt-3 h-px w-32 sm:mx-0" style={{ background: `linear-gradient(90deg, transparent, ${look.accent}, transparent)` }} />
        </div>
        {grid(() => look.card, undefined, items.length === 4)}
      </div>,
      "py-8 sm:py-10",
    );
  }

  if (layout === "cards") {
    // No band: the cards themselves wear the look, on the page's own ground.
    return (
      <section data-testid="home-hero" data-hero-layout="cards" data-hero-look={hero.look} className="mx-auto max-w-5xl px-4 pt-6">
        {(showName || subtitle) && (
          <div className="mb-3 text-center">
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            {heading("text-2xl font-bold text-foreground")}
          </div>
        )}
        {!showName && !subtitle && heading("")}
        {grid(() => `shadow-sm ${look.className ?? ""}`, look.style)}
      </section>
    );
  }

  // The full strip, as it always was - its name only where the header does not show one.
  return surface(
    <div className="text-center">
      {subtitle && <p className={showName ? "text-sm sm:text-base" : "text-2xl font-bold sm:text-3xl"} style={{ color: look.accent }}>{subtitle}</p>}
      {heading("mt-3 text-4xl font-bold sm:text-5xl")}
      <div className="mx-auto mt-4 h-px w-40" style={{ background: `linear-gradient(90deg, transparent, ${look.accent}, transparent)` }} />
      {date && <div className="mt-4">{date}</div>}
      {times && <div className="mt-6 flex items-center justify-center gap-6 text-sm">{times}</div>}
      {nextLine && <div className="mt-3 text-sm">{nextLine}</div>}
    </div>,
    showName ? "py-14 sm:py-16" : "py-8 sm:py-10",
  );
}
