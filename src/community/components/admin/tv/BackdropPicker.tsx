/**
 * The ready-made board backgrounds, to look at before taking one.
 *
 * Same bargain as the gradient studio beside it: clicking one puts it on
 * the board immediately and saves nothing, so the choice is made on the
 * wall rather than on a thumbnail. "החלה" keeps it; leaving puts back what
 * was there.
 *
 * It also says when a backdrop and the chosen theme disagree - a pale
 * parchment under a night theme is dark text on a dark board, which looks
 * fine in a 160-pixel thumbnail and is unreadable across a hall.
 */
import { useEffect, useState } from "react";
import { Check, RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TV_BACKDROPS, backdropRef, findBackdrop } from "@/tv/backdrops";
import { getTheme } from "@/tv/themes";
import type { TvConfig } from "@/tv/config";

export function BackdropPicker({
  config,
  current,
  onPreview,
  onApply,
}: {
  config: TvConfig;
  /** What is actually saved, not what is being tried out. */
  current: string | null;
  onPreview: (value: string | null) => void;
  onApply: (value: string | null) => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const themeIsLight = getTheme(config.theme, config.customThemes).light;

  // Only what was deliberately clicked reaches the board, and only until
  // this control is left.
  useEffect(() => {
    if (chosen === null) return;
    onPreview(chosen);
  }, [chosen, onPreview]);
  useEffect(() => () => onPreview(null), [onPreview]);

  const showing = chosen ?? current;
  const backdrop = findBackdrop(showing);
  const clashes = backdrop ? backdrop.light !== themeIsLight : false;
  const previewing = chosen !== null && chosen !== current;

  return (
    <div className="space-y-2" data-testid="backdrop-picker">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {TV_BACKDROPS.map((b) => {
          const active = showing === backdropRef(b.id);
          return (
            <button
              key={b.id}
              type="button"
              title={b.note}
              aria-label={b.name}
              aria-pressed={active}
              onClick={() => setChosen(backdropRef(b.id))}
              className={`block overflow-hidden rounded-md border text-start transition hover:ring-2 hover:ring-primary ${
                active ? "ring-2 ring-primary ring-offset-1" : ""
              }`}
            >
              <img
                src={b.thumb}
                alt=""
                loading="lazy"
                decoding="async"
                className="block h-12 w-full object-cover"
              />
              <span className="block truncate bg-background/95 px-1.5 py-1 text-[11px] font-medium">
                {b.name}
              </span>
            </button>
          );
        })}
      </div>

      {clashes && (
        <p className="flex items-start gap-1.5 text-[11px] leading-tight text-amber-700 dark:text-amber-400">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>
            ״{backdrop?.name}״ {backdrop?.light ? "בהיר" : "כהה"} והערכה שנבחרה{" "}
            {themeIsLight ? "בהירה" : "כהה"} - הטקסט עלול להיות קשה לקריאה מרחוק. שווה לבחור ערכה
            מתאימה למעלה.
          </span>
        </p>
      )}

      {previewing && (
        <p className="text-[11px] leading-tight text-muted-foreground">
          כך זה נראה על הלוח עכשיו. עוד לא נשמר - ״החלת הרקע הנבחר״ מקבע, ויציאה מכאן מחזירה את
          הקודם.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={chosen === null}
          onClick={() => {
            if (chosen === null) return;
            setChosen(null);
            onApply(chosen);
          }}
        >
          <Check className="size-4" /> החלת הרקע הנבחר
        </Button>
        {current && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setChosen(null);
              onApply(null);
            }}
          >
            <RotateCcw className="size-4" /> הסרת הרקע
          </Button>
        )}
      </div>
    </div>
  );
}
