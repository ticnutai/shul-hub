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

function hexToHsv(hex: string) {
  const normalized = toHex(hex);
  const red = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const green = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(normalized.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  return {
    hue: hue < 0 ? hue + 360 : hue,
    saturation: max === 0 ? 0 : delta / max,
    brightness: max,
  };
}

function hsvToHex(hue: number, saturation: number, brightness: number) {
  const chroma = brightness * saturation;
  const part = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const offset = brightness - chroma;
  const [red, green, blue] =
    hue < 60
      ? [chroma, part, 0]
      : hue < 120
        ? [part, chroma, 0]
        : hue < 180
          ? [0, chroma, part]
          : hue < 240
            ? [0, part, chroma]
            : hue < 300
              ? [part, 0, chroma]
              : [chroma, 0, part];
  return `#${[red, green, blue]
    .map((channel) =>
      Math.round((channel + offset) * 255)
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
  const initialHsv = hexToHsv(selected);
  const [savedColors, setSavedColors] = useState(readSavedColors);
  const [hexDraft, setHexDraft] = useState(selected);
  const [pickerMessage, setPickerMessage] = useState("");
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [open, setOpen] = useState(false);
  const [sampling, setSampling] = useState(false);
  const [hue, setHue] = useState(initialHsv.hue);
  const [saturation, setSaturation] = useState(initialHsv.saturation);
  const [brightness, setBrightness] = useState(initialHsv.brightness);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const sampleHandler = useRef<((event: MouseEvent) => void) | null>(null);

  useEffect(() => {
    setHexDraft(selected);
    const hsv = hexToHsv(selected);
    setHue(hsv.hue);
    setSaturation(hsv.saturation);
    setBrightness(hsv.brightness);
  }, [selected]);

  useEffect(
    () => () => {
      delete document.documentElement.dataset.colorSampling;
      if (sampleHandler.current) document.removeEventListener("click", sampleHandler.current, true);
    },
    [],
  );

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

  const stopSampling = () => {
    setSampling(false);
    delete document.documentElement.dataset.colorSampling;
    if (sampleHandler.current) {
      document.removeEventListener("click", sampleHandler.current, true);
      sampleHandler.current = null;
    }
  };

  const sampleFromPage = () => {
    setOpen(false);
    setSampling(true);
    document.documentElement.dataset.colorSampling = "true";
    setPickerMessage("גלול בחופשיות וגע ברכיב שממנו תרצה לדגום צבע.");

    const sample = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || target.closest("[data-design-mode-ui]")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const style = getComputedStyle(target);
      const property = label.includes("רקע")
        ? style.backgroundColor
        : label.includes("מסגרת")
          ? style.borderColor
          : style.color;
      const sampled = toHex(property);
      setHexDraft(sampled);
      setPickerMessage(`הצבע שנדגם מהעמוד: ${sampled}`);
      onChange(sampled);
      stopSampling();
      sampleHandler.current = null;
    };
    sampleHandler.current = sample;
    document.addEventListener("click", sample, true);
  };

  const sampleColor = async () => {
    type EyeDropperApi = { open: () => Promise<{ sRGBHex: string }> };
    type EyeDropperConstructor = new () => EyeDropperApi;
    const EyeDropper = (window as typeof window & { EyeDropper?: EyeDropperConstructor })
      .EyeDropper;
    if (!EyeDropper) {
      sampleFromPage();
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

  const updateSpectrum = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.type === "pointermove" && event.buttons !== 1) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const nextSaturation = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const nextBrightness = Math.max(
      0,
      Math.min(1, 1 - (event.clientY - bounds.top) / bounds.height),
    );
    setSaturation(nextSaturation);
    setBrightness(nextBrightness);
    onChange(hsvToHex(hue, nextSaturation, nextBrightness));
    if (event.type === "pointerdown") event.currentTarget.setPointerCapture(event.pointerId);
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
      <div className="flex items-center gap-2">
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
          className="min-w-0 flex-1 font-mono uppercase"
          placeholder="#1e3a5f"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          onClick={() => void sampleColor()}
          aria-label={`דגימת צבע מהמסך עבור ${label}`}
        >
          <Pipette className="size-4" />
        </Button>
      </div>
      <Popover modal={false} open={open} onOpenChange={setOpen}>
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
          <div className="space-y-2">
            <strong className="text-sm">בורר צבע מדויק</strong>
            <div
              role="slider"
              tabIndex={0}
              aria-label={`בורר רוויה ובהירות עבור ${label}`}
              aria-valuetext={selected}
              onPointerDown={updateSpectrum}
              onPointerMove={updateSpectrum}
              className="relative h-32 w-full cursor-crosshair touch-none overflow-hidden rounded-xl border shadow-inner"
              style={{
                backgroundColor: `hsl(${hue} 100% 50%)`,
                backgroundImage:
                  "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
              }}
            >
              <span
                className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                style={{ left: `${saturation * 100}%`, top: `${(1 - brightness) * 100}%` }}
              />
            </div>
            <label className="block text-xs font-medium">
              גוון
              <input
                type="range"
                min="0"
                max="359"
                value={Math.round(hue)}
                aria-label={`גוון עבור ${label}`}
                onChange={(event) => {
                  const nextHue = Number(event.target.value);
                  setHue(nextHue);
                  onChange(hsvToHex(nextHue, saturation, brightness));
                }}
                className="mt-1 h-5 w-full cursor-pointer appearance-none rounded-full border"
                style={{
                  background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
                }}
              />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="size-14 shrink-0 rounded-xl border shadow-inner"
              style={{ backgroundColor: selected }}
              aria-label={`תצוגת הצבע ${selected}`}
            />
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
            <Button type="button" className="w-full" onClick={() => onConfirm?.()}>
              <Check className="size-4" /> אישור
            </Button>
          </PopoverClose>
        </PopoverContent>
      </Popover>
      {sampling && (
        <div
          data-design-mode-ui
          className="fixed inset-x-3 top-3 z-[260] flex items-center justify-between gap-3 rounded-xl bg-primary p-3 text-primary-foreground shadow-2xl"
          role="status"
        >
          <span className="text-sm">גלול וגע ברכיב כדי לדגום ממנו צבע.</span>
          <Button type="button" size="sm" variant="secondary" onClick={stopSampling}>
            ביטול
          </Button>
        </div>
      )}
      {!sampling && pickerMessage && (
        <p className="text-xs text-muted-foreground" role="status">
          {pickerMessage}
        </p>
      )}
    </div>
  );
}
