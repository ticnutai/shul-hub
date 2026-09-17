import { LayoutList, PanelsTopLeft, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type PrayerLayoutMode = "tabs" | "list" | "table";

export const PRAYER_LAYOUTS: Array<{
  value: PrayerLayoutMode;
  label: string;
  description: string;
  icon: typeof PanelsTopLeft;
}> = [
  { value: "tabs", label: "טאבים", description: "תפילה אחת בכל פעם", icon: PanelsTopLeft },
  { value: "list", label: "רשימה מלאה", description: "כל התפילות אחת אחרי השנייה", icon: LayoutList },
  { value: "table", label: "טבלה מרוכזת", description: "כל המניינים במבט אחד", icon: Table2 },
];

export function normalizePrayerLayout(value?: string | null): PrayerLayoutMode {
  return value === "list" || value === "table" ? value : "tabs";
}

export function PrayerLayoutPicker({
  value,
  onChange,
  disabled = false,
  label = "שינוי פריסת זמני התפילות",
}: {
  value: PrayerLayoutMode;
  onChange: (value: PrayerLayoutMode) => void;
  disabled?: boolean;
  label?: string;
}) {
  const current = PRAYER_LAYOUTS.find((layout) => layout.value === value) ?? PRAYER_LAYOUTS[0];
  const CurrentIcon = current.icon;

  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          aria-label={label}
          title={label}
        >
          <CurrentIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(nextValue) => onChange(normalizePrayerLayout(nextValue))}
        >
          {PRAYER_LAYOUTS.map((layout) => {
            const Icon = layout.icon;
            return (
              <DropdownMenuRadioItem key={layout.value} value={layout.value} className="gap-3 py-2.5">
                <Icon className="size-4 shrink-0 text-primary" />
                <span>
                  <span className="block font-medium">{layout.label}</span>
                  <span className="block text-xs text-muted-foreground">{layout.description}</span>
                </span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}