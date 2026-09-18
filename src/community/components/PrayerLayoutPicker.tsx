import { Clock4, LayoutGrid, LayoutList, PanelsTopLeft, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type PrayerLayoutMode = "tabs" | "list" | "table" | "timeline" | "cards";

export const PRAYER_LAYOUTS: Array<{
  value: PrayerLayoutMode;
  label: string;
  description: string;
  icon: typeof PanelsTopLeft;
}> = [
  { value: "tabs", label: "טאבים", description: "תפילה אחת בכל פעם", icon: PanelsTopLeft },
  { value: "list", label: "רשימה מלאה", description: "כל התפילות אחת אחרי השנייה", icon: LayoutList },
  { value: "table", label: "טבלה מרוכזת", description: "כל המניינים במבט אחד", icon: Table2 },
  { value: "timeline", label: "ציר זמן", description: "לפי סדר השעות, המניין הבא מודגש", icon: Clock4 },
  { value: "cards", label: "כרטיסיות", description: "ריבועים גדולים עם שעה בולטת", icon: LayoutGrid },
];

const VALID_LAYOUTS = new Set<string>(PRAYER_LAYOUTS.map((layout) => layout.value));

/**
 * Falls back to "tabs" for anything unrecognised. A category saved by a newer
 * build, or a value the database has but this bundle does not know about, must
 * still render a schedule rather than an empty panel.
 */
export function normalizePrayerLayout(value?: string | null): PrayerLayoutMode {
  return value && VALID_LAYOUTS.has(value) ? (value as PrayerLayoutMode) : "tabs";
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