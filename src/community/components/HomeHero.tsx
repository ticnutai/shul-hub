/**
 * The strip at the top of the home page, in the layout and look the gabbai
 * chose (lib/homeHero.ts). The same component draws the page itself and the
 * preview in the admin, so what is chosen is what is shown.
 */
import type { CSSProperties, ReactNode } from "react";
import { CalendarDays, Sunrise, Sunset } from "lucide-react";

import { InlineEdit } from "@community/components/InlineEdit";
import { heroShowsName, type HeroLook, type HomeHero as Hero } from "@community/lib/homeHero";

/** Each look: its ground, its letters, its gold, and its small cards. */
const LOOK: Record<HeroLook, { className?: string; style?: CSSProperties; accent: string; card: string; dark: boolean }> = {
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

export interface HomeHeroProps {
  hero: Hero;
  /** The header right above shows the name (not a logo): the strip need not repeat it. */
  headerShowsName: boolean;
  settings: { id?: string; name?: string | null; subtitle?: string | null } | null | undefined;
  hebrewDate: string;
  dateLabel: string;
  sunrise: string;
  sunset: string;
  /** In the admin's preview: plain text, no editing in place. */
  preview?: boolean;
}

export function HomeHero({ hero, headerShowsName, settings, hebrewDate, dateLabel, sunrise, sunset, preview = false }: HomeHeroProps) {
  if (hero.layout === "none") {
    // Still one heading for the page, for screen readers - just not on the screen.
    return <h1 className="sr-only">{settings?.name ?? "בית הכנסת"}</h1>;
  }
  const look = LOOK[hero.look];
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

  const date = hero.date ? (
    <div className="flex items-start justify-center gap-2 text-sm">
      <CalendarDays className="mt-0.5 size-4 shrink-0" style={{ color: look.accent }} aria-hidden />
      <div className="text-center">
        <p data-testid="hebrew-date">{hebrewDate}</p>
        <p className="mt-0.5 text-xs opacity-80" data-testid="gregorian-date">{dateLabel}</p>
      </div>
    </div>
  ) : null;
  const times = hero.zmanim ? (
    <>
      <span className="flex items-center gap-2"><Sunrise className="size-4" style={{ color: look.accent }} aria-hidden /> נץ {sunrise}</span>
      <span className="flex items-center gap-2"><Sunset className="size-4" style={{ color: look.accent }} aria-hidden /> שקיעה {sunset}</span>
    </>
  ) : null;
  // On a phone: the date on its own row, sunrise and sunset side by side under it.
  const GRID = "grid grid-cols-2 gap-2 min-[420px]:grid-cols-[1.6fr_1fr_1fr]";
  const span = (key: string) => (key === "date" ? "col-span-2 min-[420px]:col-span-1" : "");
  const card = (children: ReactNode, key: string) => (
    <div key={key} className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl border px-3 py-2 text-sm ${span(key)} ${look.card}`}>{children}</div>
  );
  const surface = (children: ReactNode, pad: string) => (
    <section data-testid="home-hero" data-hero-layout={hero.layout} data-hero-look={hero.look} className={look.className} style={look.style}>
      <div className={`mx-auto max-w-5xl px-4 ${pad}`}>{children}</div>
    </section>
  );

  if (hero.layout === "compact") {
    return surface(
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-center">
        {showName ? heading("text-xl font-bold") : heading("")}
        {subtitle && <p className="text-sm" style={{ color: look.accent }}>{subtitle}</p>}
        {date}
        {times && <div className="flex items-center gap-5 text-sm">{times}</div>}
      </div>,
      "py-3 sm:py-4",
    );
  }

  if (hero.layout === "split") {
    return surface(
      <div className="grid items-center gap-6 sm:grid-cols-2">
        <div className="text-center sm:text-right">
          {subtitle && <p className={showName ? "text-sm sm:text-base" : "text-2xl font-bold sm:text-3xl"} style={{ color: look.accent }}>{subtitle}</p>}
          {heading("mt-2 text-3xl font-bold sm:text-4xl")}
          <div className="mx-auto mt-3 h-px w-32 sm:mx-0" style={{ background: `linear-gradient(90deg, transparent, ${look.accent}, transparent)` }} />
        </div>
        {/* The date is the longest of the three: it gets the room to stand on its lines. */}
        <div className={GRID}>
          {date && card(date, "date")}
          {hero.zmanim && card(<><Sunrise className="size-5" style={{ color: look.accent }} aria-hidden /><span>נץ {sunrise}</span></>, "sunrise")}
          {hero.zmanim && card(<><Sunset className="size-5" style={{ color: look.accent }} aria-hidden /><span>שקיעה {sunset}</span></>, "sunset")}
        </div>
      </div>,
      "py-8 sm:py-10",
    );
  }

  if (hero.layout === "cards") {
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
        <div className={GRID}>
          {[date && ["date", date], hero.zmanim && ["sunrise", <><Sunrise className="size-5" style={{ color: look.accent }} aria-hidden /><span>נץ {sunrise}</span></>], hero.zmanim && ["sunset", <><Sunset className="size-5" style={{ color: look.accent }} aria-hidden /><span>שקיעה {sunset}</span></>]]
            .filter((x): x is [string, JSX.Element] => Boolean(x))
            .map(([key, body]) => (
              <div key={key} className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl border px-3 py-2 text-sm shadow-sm ${span(key)} ${look.className ?? ""}`} style={look.style}>
                {body}
              </div>
            ))}
        </div>
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
    </div>,
    showName ? "py-14 sm:py-16" : "py-8 sm:py-10",
  );
}
