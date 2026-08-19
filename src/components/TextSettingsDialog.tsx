import { useEffect, useState } from "react";
import { AlignCenter, AlignJustify, AlignRight, RotateCcw, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_TEXT_SETTINGS,
  TEXT_FONTS,
  useTextSettings,
  type TextAlign,
  type TextFontId,
  type TextSettings,
} from "@/lib/text-settings";
import { cn } from "@/lib/utils";

const ALIGNMENTS: { id: TextAlign; label: string; icon: typeof AlignRight }[] = [
  { id: "right", label: "ימין", icon: AlignRight },
  { id: "justify", label: "מיושר", icon: AlignJustify },
  { id: "center", label: "מרכז", icon: AlignCenter },
];

export function TextSettingsDialog() {
  const { settings, preview, save, cancelPreview } = useTextSettings();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TextSettings>(settings);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  const update = (patch: Partial<TextSettings>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    preview(next);
  };

  const closeWithoutSaving = () => {
    cancelPreview();
    setDraft(settings);
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setOpen(true);
        else closeWithoutSaving();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="הגדרות טקסט וכתב"
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Type className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent
        dir="rtl"
        className="max-h-[92vh] overflow-y-auto text-right sm:max-w-xl"
        onEscapeKeyDown={closeWithoutSaving}
      >
        <DialogHeader className="text-right sm:text-right">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Type className="size-5 text-gold" /> הגדרות טקסט וכתב
          </DialogTitle>
          <DialogDescription>
            השינויים מוצגים מיד. רק לחיצה על „שמירה” תשמור אותם.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-gold/35 bg-muted/35 p-4">
          <p className="text-xs text-muted-foreground">תצוגה מקדימה</p>
          <h3 className="mt-2 text-2xl">קהילה, תורה ותפילה</h3>
          <p className="mt-2">בית הכנסת הוא מקום של תפילה, לימוד וחיבור בין אנשי הקהילה.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Setting label="גופן טקסט">
            <Select
              value={draft.bodyFont}
              onValueChange={(value) => update({ bodyFont: value as TextFontId })}
              dir="rtl"
            >
              <SelectTrigger aria-label="גופן טקסט">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEXT_FONTS.map((font) => (
                  <SelectItem key={font.id} value={font.id}>
                    {font.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Setting>
          <Setting label="גופן כותרות">
            <Select
              value={draft.headingFont}
              onValueChange={(value) => update({ headingFont: value as TextFontId })}
              dir="rtl"
            >
              <SelectTrigger aria-label="גופן כותרות">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEXT_FONTS.map((font) => (
                  <SelectItem key={font.id} value={font.id}>
                    {font.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Setting>
          <Setting label={`גודל טקסט — ${draft.bodySize}px`}>
            <Slider
              aria-label="גודל טקסט"
              min={14}
              max={24}
              step={1}
              value={[draft.bodySize]}
              onValueChange={([value]) => update({ bodySize: value! })}
            />
          </Setting>
          <Setting label={`גודל כותרות — ${Math.round(draft.headingScale * 100)}%`}>
            <Slider
              aria-label="גודל כותרות"
              min={0.85}
              max={1.4}
              step={0.05}
              value={[draft.headingScale]}
              onValueChange={([value]) => update({ headingScale: value! })}
            />
          </Setting>
          <Setting label={`ריווח שורות — ${draft.lineHeight.toFixed(2)}`}>
            <Slider
              aria-label="ריווח שורות"
              min={1.25}
              max={2.2}
              step={0.05}
              value={[draft.lineHeight]}
              onValueChange={([value]) => update({ lineHeight: value! })}
            />
          </Setting>
          <Setting label={`ריווח אותיות — ${draft.letterSpacing.toFixed(2)}`}>
            <Slider
              aria-label="ריווח אותיות"
              min={-0.03}
              max={0.08}
              step={0.01}
              value={[draft.letterSpacing]}
              onValueChange={([value]) => update({ letterSpacing: value! })}
            />
          </Setting>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <span className="font-medium">טקסט מודגש</span>
          <Switch
            aria-label="טקסט מודגש"
            checked={draft.bold}
            onCheckedChange={(bold) => update({ bold })}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">יישור טקסט</p>
          <div className="grid grid-cols-3 gap-2">
            {ALIGNMENTS.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                type="button"
                variant="outline"
                className={cn("gap-2", draft.align === id && "border-gold bg-gold/10 text-primary")}
                onClick={() => update({ align: id })}
              >
                <Icon className="size-4" /> {label}
              </Button>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-start sm:space-x-0">
          <Button
            type="button"
            onClick={() => {
              save(draft);
              setOpen(false);
            }}
          >
            שמירה
          </Button>
          <Button type="button" variant="outline" onClick={closeWithoutSaving}>
            ביטול
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="gap-2"
            onClick={() => update(DEFAULT_TEXT_SETTINGS)}
          >
            <RotateCcw className="size-4" /> ברירת מחדל
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Setting({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}
