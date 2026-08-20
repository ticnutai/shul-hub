import { useState } from "react";
import { BookmarkPlus, Check, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const SAVED_COLORS_KEY = "shul-saved-colors-v1";
const PRESET_COLORS = [
  "#0f172a",
  "#1e3a5f",
  "#1d4ed8",
  "#0284c7",
  "#0891b2",
  "#0f766e",
  "#166534",
  "#65a30d",
  "#ca8a04",
  "#eab308",
  "#d97706",
  "#dc2626",
  "#be123c",
  "#9d174d",
  "#7e22ce",
  "#4c1d95",
  "#6b5230",
  "#ffffff",
];

function readSavedColors() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_COLORS_KEY) ?? "[]") as string[];
    return Array.isArray(parsed) ? parsed.filter((value) => /^#[0-9a-f]{6}$/i.test(value)) : [];
  } catch {
    return [];
  }
}

function toHex(value: string) {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  const rgb = value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (!rgb) return "#000000";
  return `#${rgb
    .slice(1, 4)
    .map((part) =>
      Math.max(0, Math.min(255, Number(part)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

export function VisualColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = toHex(value);
  const [savedColors, setSavedColors] = useState(readSavedColors);

  const saveColor = () => {
    if (savedColors.includes(selected)) return;
    const next = [selected, ...savedColors].slice(0, 18);
    setSavedColors(next);
    localStorage.setItem(SAVED_COLORS_KEY, JSON.stringify(next));
  };

  const swatches = (colors: string[]) => (
    <div className="grid grid-cols-6 gap-2">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`בחירת הצבע ${color}`}
          className="grid size-9 place-items-center rounded-full border-2 border-white shadow ring-1 ring-border transition-transform hover:scale-110"
          style={{ backgroundColor: color }}
          onClick={() => onChange(color)}
        >
          {selected === color.toLowerCase() && (
            <Check className="size-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.8)]" />
          )}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <Popover modal>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-2"
            aria-label={`בחירת ${label}`}
          >
            <span
              className="size-6 rounded-full border shadow-inner"
              style={{ backgroundColor: selected }}
            />
            <Palette className="size-4" />
            <span className="truncate">בחירת צבע</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          data-design-mode-ui
          data-testid="visual-color-picker"
          dir="rtl"
          align="start"
          sideOffset={8}
          collisionPadding={8}
          className="z-[220] max-h-[min(70dvh,34rem)] w-[min(22rem,calc(100vw-1rem))] space-y-4 overflow-y-auto overscroll-contain rounded-2xl shadow-2xl max-sm:max-h-[52dvh] max-sm:p-3"
        >
          <div className="flex items-center gap-3">
            <label className="grid cursor-pointer place-items-center gap-1 text-xs font-medium">
              <input
                type="color"
                aria-label={`לוח צבעים מלא עבור ${label}`}
                className="h-14 w-20 cursor-pointer rounded-lg border bg-transparent p-1"
                value={selected}
                onChange={(event) => onChange(event.target.value)}
              />
              לוח צבעים מלא
            </label>
            <Button type="button" variant="outline" className="flex-1" onClick={saveColor}>
              <BookmarkPlus className="size-4" /> שמירת הצבע
            </Button>
          </div>
          <div className="space-y-2">
            <strong className="text-sm">צבעים מוכנים</strong>
            {swatches(PRESET_COLORS)}
          </div>
          <div className="space-y-2">
            <strong className="text-sm">הצבעים השמורים שלי</strong>
            {savedColors.length ? (
              swatches(savedColors)
            ) : (
              <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                בחר צבע ולחץ „שמירת הצבע”
              </p>
            )}
          </div>
          <PopoverClose asChild>
            <Button type="button" className="w-full">
              <Check className="size-4" /> אישור
            </Button>
          </PopoverClose>
        </PopoverContent>
      </Popover>
    </div>
  );
}
