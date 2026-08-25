import { Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useFontAndColorSettings, type FontAndColorSettings } from "@/contexts/FontAndColorSettingsContext";

const fonts = [
  { value: "David Libre", label: "דוד" },
  { value: "Noto Serif Hebrew", label: "נוטו סריף" },
  { value: "Frank Ruehl Libre", label: "פרנק רוהל" },
  { value: "Miriam Libre", label: "מרים" },
  { value: "Rubik", label: "רוביק" },
  { value: "Heebo", label: "היבו" },
  { value: "Alef", label: "אלף" },
  { value: "Varela Round", label: "וארלה" },
  { value: "Arial", label: "אריאל" },
  { value: "Times New Roman", label: "טיימס" },
];

const lineHeightOptions = [
  { value: "tight", label: "צמוד", numeric: "1.3" },
  { value: "normal", label: "רגיל", numeric: "1.5" },
  { value: "relaxed", label: "רגוע", numeric: "1.7" },
  { value: "loose", label: "רפוי", numeric: "2.0" },
];

const spacingOptions = [
  { value: "compact", label: "צפוף" },
  { value: "normal", label: "רגיל" },
  { value: "comfortable", label: "נוח" },
  { value: "spacious", label: "מרווח" },
];

export const MobileTypographySheet = () => {
  const { settings, updateSettings } = useFontAndColorSettings();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1 flex-shrink-0 h-9 w-9 p-0"
          title="הגדרות טיפוגרפיה"
        >
          <Type className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto" dir="rtl">
        <SheetHeader>
          <SheetTitle className="text-right flex items-center gap-2 justify-end">
            <span>הגדרות טקסט</span>
            <Type className="h-5 w-5" />
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 py-4">
          {/* Font Type - Pasuk */}
          <div className="space-y-2 text-right">
            <Label className="text-sm font-semibold">גופן פסוקים</Label>
            <Select
              value={settings.pasukFont}
              onValueChange={(value) => updateSettings({ pasukFont: value })}
            >
              <SelectTrigger className="text-right">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fonts.map((font) => (
                  <SelectItem key={font.value} value={font.value}>
                    <span style={{ fontFamily: font.value }}>{font.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Font Size - Pasuk */}
          <div className="space-y-3 text-right">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                {settings.pasukSize}px
              </span>
              <Label className="text-sm font-semibold">גודל גופן פסוקים</Label>
            </div>
            <Slider
              value={[settings.pasukSize]}
              onValueChange={([value]) => updateSettings({ pasukSize: value })}
              min={12}
              max={32}
              step={1}
              className="w-full"
            />
          </div>

          <Separator />

          {/* Commentary Font */}
          <div className="space-y-2 text-right">
            <Label className="text-sm font-semibold">גופן מפרשים</Label>
            <Select
              value={settings.commentaryFont}
              onValueChange={(value) => updateSettings({ commentaryFont: value })}
            >
              <SelectTrigger className="text-right">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fonts.map((font) => (
                  <SelectItem key={font.value} value={font.value}>
                    <span style={{ fontFamily: font.value }}>{font.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Commentary Font Size */}
          <div className="space-y-3 text-right">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                {settings.commentarySize}px
              </span>
              <Label className="text-sm font-semibold">גודל גופן מפרשים</Label>
            </div>
            <Slider
              value={[settings.commentarySize]}
              onValueChange={([value]) => updateSettings({ commentarySize: value })}
              min={10}
              max={28}
              step={1}
              className="w-full"
            />
          </div>

          <Separator />

          {/* Line Height */}
          <div className="space-y-2 text-right">
            <Label className="text-sm font-semibold">גובה שורה</Label>
            <Select
              value={settings.pasukLineHeight}
              onValueChange={(value) => updateSettings({ pasukLineHeight: value as FontAndColorSettings["pasukLineHeight"] })}
            >
              <SelectTrigger className="text-right">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {lineHeightOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label} ({opt.numeric})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Content Spacing */}
          <div className="space-y-2 text-right">
            <Label className="text-sm font-semibold">מרווח תוכן</Label>
            <Select
              value={settings.contentSpacing}
              onValueChange={(value) => updateSettings({ contentSpacing: value as FontAndColorSettings["contentSpacing"] })}
            >
              <SelectTrigger className="text-right">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {spacingOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Preview */}
          <div className="space-y-2 p-3 bg-muted/30 rounded-lg text-right">
            <Label className="text-xs text-muted-foreground">תצוגה מקדימה</Label>
            <p
              style={{
                fontFamily: settings.pasukFont,
                fontSize: `${Math.min(settings.pasukSize, 24)}px`,
                color: settings.pasukColor,
                fontWeight: settings.pasukBold ? "bold" : "normal",
                lineHeight: settings.pasukLineHeight === "tight" ? "1.3" : settings.pasukLineHeight === "normal" ? "1.5" : settings.pasukLineHeight === "relaxed" ? "1.7" : "2.0",
              }}
              className="text-right"
            >
              בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
