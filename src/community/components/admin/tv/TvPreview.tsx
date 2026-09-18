import { useEffect, type ReactNode } from "react";
import type { TvConfig } from "@/tv/config";
import { TV_FONTS_HREF } from "@/tv/themes";
import { TvBoard } from "@/tv/TvBoard";
import type { BoardSlide } from "@/tv/useBoardData";
import { slideLabel, type useTvSlides } from "./tvPreviewData";

/**
 * The real board component inside a 16:9 frame. Not a mock-up: TvBoard and
 * buildSlides are the exact code the TV runs, and tv.css sizes everything
 * from the frame's height (container units), so the picture is the TV's at
 * any width.
 */

/** The TV bundles its fonts; in the site they come from Google once. */
function useTvFonts() {
  useEffect(() => {
    if (document.querySelector("link[data-tv-fonts]")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = TV_FONTS_HREF;
    link.dataset.tvFonts = "true";
    document.head.appendChild(link);
  }, []);
}

export function TvPreview({
  config,
  slides,
  data,
  now,
  zmanim,
  index,
  paused = false,
  progress = 0,
  cycle = 0,
  overlay,
  label,
}: ReturnType<typeof useTvSlides> & {
  config: TvConfig;
  index: number;
  paused?: boolean;
  progress?: number;
  cycle?: number;
  overlay?: ReactNode;
  label?: string;
}) {
  useTvFonts();
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl bg-black shadow-lg ring-1 ring-border"
      style={{ aspectRatio: "16 / 9" }}
      role="img"
      aria-label={label ?? "תצוגה מקדימה של לוח הטלוויזיה"}
      // Sits outside the site's own RTL/typography rules; the board sets its own.
      dir="rtl"
    >
      <TvBoard
        data={data}
        config={config}
        now={now}
        zmanim={zmanim}
        slides={slides}
        index={Math.min(Math.max(index, 0), Math.max(slides.length - 1, 0))}
        cycle={cycle}
        progress={progress}
        paused={paused}
        overlay={overlay}
      />
    </div>
  );
}

/** Small clickable slide list under a preview. */
export function SlideStrip({
  slides,
  index,
  onPick,
}: {
  slides: BoardSlide[];
  index: number;
  onPick: (i: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="שקופיות">
      {slides.map((s, i) => (
        <button
          key={s.id + i}
          type="button"
          role="tab"
          aria-selected={i === index}
          onClick={() => onPick(i)}
          className={`rounded-full border px-2.5 py-1 text-xs transition ${
            i === index ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary"
          }`}
        >
          {i + 1}. {slideLabel(s)}
        </button>
      ))}
    </div>
  );
}
