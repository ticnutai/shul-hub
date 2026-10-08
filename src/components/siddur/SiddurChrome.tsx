/**
 * The pieces around the text: icons and dividers, the ornamented title, the bars that stay under the page's top, the dialogs of choices, the strip of sections and jumping to one.
 * Split out of the prayer book's page (src/pages/Siddur.tsx).
 */
import {
  ChevronDown,
  BookMarked,
  BookOpen,
  ScrollText,
  Sunrise,
  Sun,
  Moon,
  Sparkles,
  Flame,
  Star,
  Leaf,
  Heart,
  Book,
  type LucideProps,
} from "lucide-react";
import { useState, useEffect, useRef, createContext, useContext, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import type { SiddurSection } from "@/hooks/useSiddurData";

import { SERIF } from "./siddurText";
import { useSiddurTheme } from "./siddurTheme";

/* ─── Gold decoration helpers ───────────────────────────── */
export const GOLD = "#c8a04d";
export const CAT_ICON: Record<string, React.ComponentType<LucideProps>> = {
  shacharit:         Sunrise,
  mincha:            Sun,
  arvit:             Moon,
  shabbat_kabbalat:  Sparkles,
  shabbat_arvit:     Flame,
  shabbat_shacharit: Star,
  shabbat_musaf:     BookOpen,
  shabbat_mincha:    Leaf,
  brachot:           Heart,
  other:             ScrollText,
  tehillim:          BookMarked,
  kria:              Book,
};
export const CatIcon = ({ id }: { id: string }) => {
  const { theme } = useSiddurTheme();
  const Icon = CAT_ICON[id];
  return Icon ? <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: theme.accentColor }} /> : null;
};
export const Divider = () => {
  const { theme } = useSiddurTheme();
  return (
    <div className="my-1 mx-auto" style={{
      width: "60%", height: "1px",
      background: `linear-gradient(90deg, transparent, ${theme.accentColor}, transparent)`
    }} />
  );
};
/**
 * The page's controls, for the title line to pick up.
 *
 * The title of the first prayer on the page is a short word in the middle of
 * an otherwise empty line. On a phone that empty space either side is the only
 * room left that costs nothing - every other arrangement pushed the prayer
 * further down the screen. The page puts its controls here; the title takes
 * them, two on each side. Null on a wide screen, where they stay in the
 * header and the title is just a title.
 */
export const SiddurToolsContext = createContext<{ before: React.ReactNode; after: React.ReactNode } | null>(null);

export const OrnamentTitle = ({ text, fontSize, withTools = false }: { text: string; fontSize?: number; withTools?: boolean }) => {
  const { theme } = useSiddurTheme();
  const tools = useContext(SiddurToolsContext);
  const flank = withTools ? tools : null;
  const title = (
    <>
      <span style={{ color: theme.accentColor, fontSize: "0.9em" }}>❧</span>
      <span className="font-bold tracking-wide" style={{ color: theme.accentColor, fontFamily: "'Noto Serif Hebrew', 'David Libre', serif", fontSize: fontSize ? `${fontSize}px` : "0.9em" }}>
        {text}
      </span>
      <span style={{ color: theme.accentColor, fontSize: "0.9em", transform: "scaleX(-1)", display: "inline-block" }}>❧</span>
    </>
  );

  if (!flank) {
    return <div className="flex items-center justify-center gap-2 my-2">{title}</div>;
  }

  // Pushed out to the edges rather than huddled around the word: the title
  // stays centred on the line it always had, and the controls sit where a
  // thumb reaches them without covering the text.
  return (
    <div className="flex items-center justify-between gap-2 my-2">
      <span className="flex flex-shrink-0 items-center gap-1" dir="ltr">{flank.before}</span>
      <span className="flex min-w-0 flex-1 items-center justify-center gap-2">{title}</span>
      <span className="flex flex-shrink-0 items-center gap-1" dir="ltr">{flank.after}</span>
    </div>
  );
};

/* ─── Choosing, on a phone ───────────────────────────────── */

/**
 * Jumping to a section from outside the list.
 *
 * The strip of section names sits above the text and the cards are below it,
 * so the two have to agree on "go to this one" without one owning the other.
 * A counter rather than a plain index, so tapping the same section twice
 * scrolls back to it - which is what somebody who has scrolled away expects.
 */
/** Where a section sits in the page, whatever mode is drawing it. */
export const sectionAnchor = (i: number) => `siddur-sec-${i}`;
export const EMPTY_MARKS = new Map<string, boolean>();

/**
 * How much of the top of the screen something else is already covering.
 *
 * Only what is pinned there counts: the page's own header scrolls away with
 * everything else and must not be subtracted, or the section lands that far
 * too low.
 */
export function stickyChromeHeight(): number {
  let bottom = 0;
  for (const el of document.querySelectorAll<HTMLElement>("header, [data-sticky-chrome]")) {
    const pos = getComputedStyle(el).position;
    if (pos !== "sticky" && pos !== "fixed") continue;
    bottom = Math.max(bottom, el.getBoundingClientRect().bottom);
  }
  return Math.max(0, Math.round(bottom));
}

/**
 * Keeps its content on screen while the text scrolls, just under whatever is
 * already pinned at the top (the app's header). The row of sections is how
 * somebody moves through a long prayer - ברכות השחר, קרבנות, פסוקי דזמרה -
 * and it used to scroll away with the first line of text, so moving on meant
 * scrolling all the way back up first. Marked as pinned chrome itself, so a
 * jump to a section lands below it instead of under it.
 */
export function PinnedBelowChrome({ background, children }: { background: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  useEffect(() => {
    const measure = () => {
      let bottom = 0;
      for (const el of document.querySelectorAll<HTMLElement>("header, [data-sticky-chrome]")) {
        if (el === ref.current || ref.current?.contains(el)) continue;
        const pos = getComputedStyle(el).position;
        if (pos !== "sticky" && pos !== "fixed") continue;
        const rect = el.getBoundingClientRect();
        // Only what sits at the top of the screen; a pinned bar at the bottom does not count.
        if (rect.top <= 1) bottom = Math.max(bottom, rect.bottom);
      }
      setTop(Math.max(0, Math.round(bottom)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const el of document.querySelectorAll<HTMLElement>("header")) observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return (
    <div ref={ref} data-sticky-chrome className="sticky z-30" style={{ top, background }}>
      {children}
    </div>
  );
}

export const SiddurJumpContext = createContext<{ index: number | null; nonce: number; jump: (i: number) => void }>({
  index: null,
  nonce: 0,
  jump: () => {},
});

/**
 * One choice, as a grid that uses the width it has.
 *
 * A phone screen is 375 points wide and a row of tabs uses maybe a third of
 * that before it starts scrolling sideways - which hides the options rather
 * than showing them. The same list as a grid of tiles shows every option at
 * once, and a choice you can see all of is made once instead of hunted for.
 */
export function ChoiceDialog({
  open,
  onOpenChange,
  title,
  items,
  value,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  items: { id: string; name: string }[];
  value: string;
  onPick: (id: string) => void;
}) {
  const { theme } = useSiddurTheme();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md text-right">
        <DialogHeader className="text-right">
          <DialogTitle style={{ fontFamily: SERIF }}>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((it) => {
            const active = it.id === value;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => {
                  onPick(it.id);
                  onOpenChange(false);
                }}
                className="min-h-12 rounded-lg border px-2 py-2.5 text-sm font-medium transition"
                style={
                  active
                    ? { background: theme.accentColor, color: "#101827", borderColor: theme.accentColor }
                    : { borderColor: "hsl(var(--border))" }
                }
              >
                {it.name}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The trigger: what is chosen now, and that it can be changed. */
export function ChoiceButton({
  label,
  value,
  onClick,
  color,
}: {
  label: string;
  value: string;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 flex-1 items-center justify-between gap-1.5 rounded-lg border px-2.5 py-1.5"
      style={{ borderColor: `${color}55`, color }}
    >
      <span className="min-w-0 text-start">
        <span className="block text-[10px] leading-tight opacity-70">{label}</span>
        <span className="block truncate text-sm font-semibold leading-tight">{value}</span>
      </span>
      <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
    </button>
  );
}

/**
 * The sections of the prayer being said, across the top.
 *
 * This is the row somebody actually uses. Which nusach they daven and which
 * prayer they are at are answered once and then stay answered; where in
 * שחרית they are changes every minute, and until now the only way to move
 * was to scroll past everything in between.
 */
export function SectionStrip({
  sections,
  color,
  accent,
}: {
  sections: SiddurSection[];
  /** The header's own text colour - the strip sits on the header, not on the page. */
  color: string;
  accent: string;
}) {
  const { index, jump } = useContext(SiddurJumpContext);

  return (
    <div
      className="flex gap-1.5 overflow-x-auto px-2 py-1.5 [&::-webkit-scrollbar]:hidden"
      style={{ scrollbarWidth: "none", borderBottom: `1px solid ${accent}30` }}
    >
      {sections.map((sec, i) => (
        <button
          key={`${sec.title}-${i}`}
          type="button"
          onClick={() => jump(i)}
          className="flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition"
          style={
            i === index
              ? { background: accent, color: "hsl(var(--sidebar-background))" }
              : { color, opacity: 0.8 }
          }
        >
          {sec.title}
        </button>
      ))}
    </div>
  );
}

/**
 * Brings an element into view just below what is pinned at the top of the
 * screen - at the top of what is left ("start"), or in its middle ("center").
 * Returns a cancel. The one way the siddur and Tehillim scroll to a place:
 * scrollIntoView put it at the very top of the window, under the header, and
 * a chapter opened with its first verses hidden behind it.
 *
 * `find` is asked again until the element exists (a prayer still loading, a
 * chapter still rendering).
 */
/**
 * Where an element stands in the page's own layout, from the top of the
 * document. Not getBoundingClientRect: a chapter opens with a fade that also
 * slides it up a little (animate-fade-in), and measured mid-slide it stood
 * ten-odd pixels from where it would come to rest - so the scroll arrived,
 * and then had to be corrected with a visible twitch.
 */
export function layoutTop(el: HTMLElement): number {
  let top = 0;
  for (let node: HTMLElement | null = el; node; node = node.offsetParent as HTMLElement | null) top += node.offsetTop;
  return top;
}

export function scrollUnderChrome(find: () => HTMLElement | null, where: "start" | "center" = "start"): () => void {
  const timers: number[] = [];
  const attempt = (tries: number) => {
    const el = find();
    if (!el) {
      if (tries < 20) timers.push(window.setTimeout(() => attempt(tries + 1), 100));
      return;
    }
    // Measured, not guessed. What stays over the text is the app header (and
    // any pinned row), and how tall that is depends on the synagogue - a board
    // showing the קרובים logo has a header twice the height of one showing a
    // name. A fixed number landed somewhere in the middle of the section.
    const target = () => {
      const chrome = stickyChromeHeight();
      const room = window.innerHeight - chrome;
      const below = where === "center" ? Math.max(8, (room - el.offsetHeight) / 2) : 8;
      return Math.max(0, layoutTop(el) - chrome - below);
    };
    window.scrollTo({ top: target(), behavior: "smooth" });
    // Smooth scrolling is ignored outright in some places - reduced motion,
    // a background tab, a television WebView - and the text above can still
    // be settling. So once the scroll has come to rest (not at a fixed time:
    // a long way is still on its way at half a second, and a correction then
    // jumped it), it is checked, and finished smoothly if it fell short.
    let last = window.scrollY;
    let still = 0;
    let corrected = false;
    const startedAt = Date.now();
    const watch = window.setInterval(() => {
      const y = window.scrollY;
      still = Math.abs(y - last) < 1 ? still + 1 : 0;
      last = y;
      if (still < 2 && Date.now() - startedAt < 2000) return;
      const wanted = target();
      if (!corrected && Math.abs(y - wanted) > 2) {
        corrected = true;
        still = 0;
        window.scrollTo({ top: wanted, behavior: "smooth" });
        return;
      }
      window.clearInterval(watch);
    }, 100);
    timers.push(watch);
  };
  timers.push(window.setTimeout(() => attempt(0), 60));
  return () =>
    timers.forEach((t) => {
      window.clearTimeout(t);
      window.clearInterval(t);
    });
}

/**
 * Brings a jumped-to section into view. Lives on the page, not in the strip,
 * because the strip exists only on a phone and search jumps on every screen.
 */
export function SectionJumpScroller() {
  const { index, nonce } = useContext(SiddurJumpContext);

  // After the tap: the card (if there is one) has opened in the same commit,
  // so by the next frame there is something with a height to scroll to.
  // Coming from search in another prayer, that prayer may still be loading:
  // scrollUnderChrome waits for the section to exist.
  useEffect(() => {
    if (index === null) return;
    return scrollUnderChrome(() => document.getElementById(sectionAnchor(index)));
  }, [index, nonce]);

  return null;
}
