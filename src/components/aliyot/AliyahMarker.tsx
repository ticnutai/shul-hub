import { createContext, memo, useContext } from "react";
import type { AliyahSpan } from "@/utils/aliyot";
import { toHebrewNumber } from "@/utils/hebrewNumbers";

/**
 * Aliyah headings inside the running text. The views know nothing about
 * aliyot; each drops an <AliyahMarker> before a verse, and it renders only
 * where an aliyah begins. With no division chosen the map is empty.
 */
export const AliyahMarkersContext = createContext<Map<string, AliyahSpan[]> | null>(null);

const range = (s: AliyahSpan) =>
  `${toHebrewNumber(s.begin.perek)} ${toHebrewNumber(s.begin.pasuk)} – ${toHebrewNumber(s.end.perek)} ${toHebrewNumber(s.end.pasuk)}`;

export const AliyahMarker = memo(({ perek, pasuk }: { perek: number; pasuk: number }) => {
  const markers = useContext(AliyahMarkersContext);
  const spans = markers?.get(`${perek}:${pasuk}`);
  if (!spans?.length) return null;

  return (
    <div
      dir="rtl"
      data-aliyah-marker={spans.map((s) => s.key).join(",")}
      className="flex items-center gap-3 my-4 select-none"
      style={{ fontFamily: "inherit" }}
    >
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-primary/40 to-transparent" />
      <div className="flex flex-col items-center text-center leading-tight">
        <span className="text-base font-bold text-primary">
          {spans.map((s) => s.label).join(" · ")}
        </span>
        <span className="text-[0.7rem] text-muted-foreground font-sans">
          {spans.map(range).join(" · ")}
        </span>
        {spans.map((s) => s.note && (
          <span key={s.key} className="text-[0.7rem] text-muted-foreground/80 font-sans">{s.note}</span>
        ))}
      </div>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
    </div>
  );
});
AliyahMarker.displayName = "AliyahMarker";
