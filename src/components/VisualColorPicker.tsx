import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { BookmarkPlus, Check, GripHorizontal, Palette, Pipette, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return `#${value
      .slice(1)
      .split("")
      .map((part) => part.repeat(2))
      .join("")}`.toLowerCase();
  }
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
  onConfirm,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onConfirm?: (() => void) | undefined;
}) {
  const selected = toHex(value);
  const [savedColors, setSavedColors] = useState(readSavedColors);
  const [hexDraft, setHexDraft] = useState(selected);
  const [pickerMessage, setPickerMessage] = useState("");
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => setHexDraft(selected), [selected]);

  const applyHex = () => {
    if (!/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hexDraft)) {
      setHexDraft(selected);
      setPickerMessage("יש להזין צבע בפורמט HEX, לדוגמה #1e3a5f");
      return;
    }
    const normalized = toHex(hexDraft);
    setHexDraft(normalized);
    setPickerMessage("");
    onChange(normalized);
  };

  const sampleColor = async () => {
    type EyeDropperApi = { open: () => Promise<{ sRGBHex: string }> };
    type EyeDropperConstructor = new () => EyeDropperApi;
    const EyeDropper = (window as typeof window & { EyeDropper?: EyeDropperConstructor })
      .EyeDropper;
    if (!EyeDropper) {
      setPickerMessage("דוגם הצבעים אינו נתמך במכשיר זה; אפשר להזין את מזהה הצבע ידנית.");
      return;
    }
    try {
      const result = await new EyeDropper().open();
      const sampled = toHex(result.sRGBHex);
      setHexDraft(sampled);
      setPickerMessage(`הצבע שנדגם: ${sampled}`);
      onChange(sampled);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setPickerMessage("לא ניתן היה לדגום את הצבע. אפשר לנסות שוב או להזין מזהה ידנית.");
    }
  };

  const startDrag = (event: ReactPointerEvent) => {
    if ((event.target as Element).closest("button")) return;
    drag.current = { x: event.clientX - offset.x, y: event.clientY - offset.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent) => {
    if (!drag.current) return;
    setOffset({ x: event.clientX - drag.current.x, y: event.clientY - drag.current.y });
  };

  const endDrag = () => {
    drag.current = null;
  };

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
          style={{ translate: `${offset.x}px ${offset.y}px` }}
          className="z-[220] max-h-[min(70dvh,34rem)] w-[min(22rem,calc(100vw-1rem))] space-y-4 overflow-y-auto overscroll-contain rounded-2xl pt-3 shadow-2xl max-sm:max-h-[52dvh] max-sm:p-3"
        >
          <div
            data-testid="visual-color-picker-drag-handle"
            aria-label="גרירת חלון בחירת הצבע"
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={() => setOffset({ x: 0, y: 0 })}
            className="sticky -top-3 z-10 -mx-4 -mt-3 flex h-9 cursor-grab touch-none items-center justify-between border-b bg-popover px-3 active:cursor-grabbing max-sm:-mx-3"
          >
            <GripHorizontal className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium">בחירת {label} — ניתן לגרור</span>
            <PopoverClose asChild>
              <Button type="button" size="icon" variant="ghost" aria-label="סגירת בחירת הצבע">
                <X className="size-4" />
              </Button>
            </PopoverClose>
          </div>
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
          <div className="space-y-2 rounded-xl border bg-muted/25 p-3">
            <strong className="text-sm">מזהה ודגימת צבע</strong>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                dir="ltr"
                aria-label={`מזהה צבע עבור ${label}`}
                value={hexDraft}
                onChange={(event) => setHexDraft(event.target.value)}
                onBlur={applyHex}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyHex();
                  }
                }}
                className="font-mono uppercase"
                placeholder="#1e3a5f"
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={() => void sampleColor()}
                aria-label={`דגימת צבע מהמסך עבור ${label}`}
              >
                <Pipette className="size-4" /> דגימה מהמסך
              </Button>
            </div>
            {pickerMessage && (
              <p className="text-xs text-muted-foreground" role="status">
                {pickerMessage}
              </p>
            )}
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
            <Button type="button" className="w-full" onClick={() => onConfirm?.()}>
              <Check className="size-4" /> אישור
            </Button>
          </PopoverClose>
        </PopoverContent>
      </Popover>
    </div>
  );
}
