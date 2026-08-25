import { useEffect, useMemo, useState } from "react";
import { Check, Palette, Plus, Trash2 } from "lucide-react";
import { HexColorInput, HexColorPicker } from "react-colorful";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  compact?: boolean;
}

const SAVED_COLORS_KEY = "pash-saved-colors-v1";
const DEFAULT_COLOR = "#c8a04d";

const predefinedColors = [
  { name: "שחור", value: "#1a1a1a" }, { name: "לבן", value: "#ffffff" },
  { name: "אפור", value: "#666666" }, { name: "כחול כהה", value: "#15254a" },
  { name: "כחול", value: "#2563eb" }, { name: "תכלת", value: "#38bdf8" },
  { name: "ירוק", value: "#15803d" }, { name: "טורקיז", value: "#0f766e" },
  { name: "סגול", value: "#7e22ce" }, { name: "בורדו", value: "#881337" },
  { name: "אדום", value: "#dc2626" }, { name: "זהב", value: "#c8a04d" },
  { name: "כתום", value: "#ea580c" }, { name: "חום", value: "#78350f" },
  { name: "קלף", value: "#fff4cf" }, { name: "קרם", value: "#fffef8" },
];

const normalizeHex = (color: string) => /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : DEFAULT_COLOR;

const loadSavedColors = (): string[] => {
  try {
    const colors = JSON.parse(localStorage.getItem(SAVED_COLORS_KEY) || "[]");
    return Array.isArray(colors) ? colors.filter(color => /^#[0-9a-f]{6}$/i.test(color)).slice(0, 20) : [];
  } catch {
    return [];
  }
};

export const ColorPicker = ({ label, value, onChange, compact = false }: ColorPickerProps) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => normalizeHex(value));
  const [savedColors, setSavedColors] = useState<string[]>(loadSavedColors);

  useEffect(() => {
    if (!open) setDraft(normalizeHex(value));
  }, [value, open]);

  const normalizedValue = useMemo(() => normalizeHex(value), [value]);

  const persistSaved = (colors: string[]) => {
    setSavedColors(colors);
    localStorage.setItem(SAVED_COLORS_KEY, JSON.stringify(colors));
  };

  const saveCurrentColor = () => {
    const color = normalizeHex(draft);
    persistSaved([color, ...savedColors.filter(item => item !== color)].slice(0, 20));
  };

  const removeSavedColor = (color: string) => {
    persistSaved(savedColors.filter(item => item !== color));
  };

  const choose = (color: string) => {
    const next = normalizeHex(color);
    setDraft(next);
    onChange(next);
  };

  return (
    <div className={compact ? "min-w-0" : "space-y-2"} dir="rtl">
      {!compact && <Label>{label}</Label>}
      <Dialog open={open} onOpenChange={setOpen} modal={false}>
        <DialogTrigger asChild>
          <button
            type="button"
            className={compact
              ? "flex h-9 w-full items-center gap-2 rounded-lg border border-slate-600 bg-slate-900 px-2 text-xs text-slate-100"
              : "flex h-11 w-full items-center justify-between rounded-xl border bg-card px-3 text-sm shadow-sm"}
            aria-label={`בחירת ${label}`}
          >
            <span className="flex items-center gap-2 truncate">
              <span className="h-6 w-6 shrink-0 rounded-md border border-white/30 shadow-inner" style={{ background: normalizedValue }} />
              <span className="truncate">{label}</span>
            </span>
            <span className="font-mono text-[11px] opacity-70" dir="ltr">{normalizedValue}</span>
          </button>
        </DialogTrigger>
        <DialogContent
          hideOverlay
          className="bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] top-auto !flex h-[calc(56dvh-3.5rem)] max-h-[calc(56dvh-3.5rem)] w-[calc(100%-2rem)] max-w-sm translate-y-0 flex-col gap-0 overflow-hidden rounded-2xl border-slate-600 bg-slate-950/95 p-0 text-slate-50 shadow-2xl backdrop-blur-md [&>button]:right-2.5 [&>button]:top-2.5 [&>button]:z-20 [&>button]:rounded-full [&>button]:bg-slate-800 [&>button]:p-1 [&>button]:text-white sm:bottom-auto sm:top-1/2 sm:h-auto sm:max-h-[64dvh] sm:-translate-y-1/2"
          dir="rtl"
        >
          <DialogHeader className="shrink-0 border-b border-slate-800 px-11 py-2.5">
            <DialogTitle className="flex items-center justify-center gap-2 text-center text-sm text-white">
              <Palette className="h-4 w-4 shrink-0 text-amber-400" />
              <span className="truncate">בחירת {label}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-2.5 overscroll-contain">
            <HexColorPicker color={draft} onChange={choose} className="!h-24 !w-full !rounded-lg" />

            <div className="grid grid-cols-[38px_minmax(0,1fr)] gap-1.5 rounded-lg border border-slate-700 bg-slate-900 p-1.5">
              <span className="h-9 w-9 rounded-md border border-white/30 shadow-inner" style={{ background: draft }} />
              <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-600 bg-slate-950 px-3" dir="ltr">
                <span className="text-sm text-slate-400">#</span>
                <HexColorInput
                  color={draft}
                  onChange={choose}
                  prefixed={false}
                  className="h-9 min-w-0 flex-1 bg-transparent font-mono text-sm uppercase text-white outline-none"
                  aria-label="ערך צבע HEX"
                />
              </div>
              <Button type="button" variant="outline" onClick={saveCurrentColor} className="col-span-2 h-8 gap-1.5 border-slate-600 bg-slate-800 text-[11px] text-white hover:bg-slate-700" title="שמור צבע">
                <Plus className="h-4 w-4" /> שמור ברשימת הצבעים שלי
              </Button>
            </div>

            {savedColors.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">הצבעים שלי</span>
                  <span className="text-[11px] text-slate-400">לחיצה לבחירה · פח למחיקה</span>
                </div>
                <div className="grid grid-cols-6 gap-2 px-1">
                  {savedColors.map(color => (
                    <div key={color} className="relative">
                      <button type="button" onClick={() => choose(color)} className="aspect-square w-full rounded-lg border border-white/25 shadow-sm" style={{ background: color }} aria-label={`בחר ${color}`}>
                        {draft === color && <Check className="mx-auto h-4 w-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.9)]" />}
                      </button>
                      <button type="button" onClick={() => removeSavedColor(color)} className="absolute -left-1 -top-1 rounded-full bg-slate-950 p-1 text-slate-300 shadow" aria-label={`מחק ${color}`}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-2">
              <span className="text-xs font-semibold text-white">פלטה מומלצת</span>
              <div className="grid grid-cols-8 gap-1.5 px-1">
                {predefinedColors.map(color => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => choose(color.value)}
                    className={`aspect-square rounded-lg border shadow-sm ${draft === color.value ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-950" : "border-white/20"}`}
                    style={{ background: color.value }}
                    title={color.name}
                    aria-label={color.name}
                  />
                ))}
              </div>
            </section>

          </div>
          <div className="shrink-0 border-t border-slate-800 bg-slate-950/95 p-2.5">
            <Button type="button" onClick={() => setOpen(false)} className="h-9 w-full text-sm bg-amber-500 font-bold text-slate-950 hover:bg-amber-400">
              <Check className="ml-2 h-4 w-4" /> אישור והחלת הצבע
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
