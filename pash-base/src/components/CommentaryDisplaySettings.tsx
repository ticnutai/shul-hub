import { AlignJustify, Columns } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { useFontAndColorSettings } from "@/contexts/FontAndColorSettingsContext";

export const CommentaryDisplaySettings = () => {
  const { settings, updateSettings } = useFontAndColorSettings();

  const lineHeights = [
    { value: "normal", label: "רגיל", description: "1.6" },
    { value: "relaxed", label: "רגוע", description: "1.9" },
    { value: "loose", label: "רפוי", description: "2.2" },
  ];

  const widths = [
    { value: "narrow", label: "צר", description: "600px - קריאה ממוקדת" },
    { value: "medium", label: "בינוני", description: "800px - מומלץ" },
    { value: "wide", label: "רחב", description: "1000px" },
    { value: "full", label: "מלא", description: "רוחב מלא" },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          title="הגדרות תצוגת פרשנים"
        >
          <AlignJustify className="h-4 w-4" />
          הגדרות תצוגה
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-right">תצוגת פרשנים</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Line Height */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-right">
            <AlignJustify className="ml-2 h-4 w-4" />
            מרווח בין שורות
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {lineHeights.map((lineHeight) => (
              <DropdownMenuItem
                key={lineHeight.value}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick={() => updateSettings({ commentaryLineHeight: lineHeight.value as any })}
                className={`text-right ${
                  settings.commentaryLineHeight === lineHeight.value ? "bg-accent" : ""
                }`}
              >
                <div className="flex-1 text-right">
                  <div className="font-semibold">{lineHeight.label}</div>
                  <div className="text-xs text-muted-foreground">{lineHeight.description}</div>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Max Width */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-right">
            <Columns className="ml-2 h-4 w-4" />
            רוחב טקסט
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56">
            {widths.map((width) => (
              <DropdownMenuItem
                key={width.value}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick={() => updateSettings({ commentaryMaxWidth: width.value as any })}
                className={`text-right ${
                  settings.commentaryMaxWidth === width.value ? "bg-accent" : ""
                }`}
              >
                <div className="flex-1 text-right">
                  <div className="font-semibold">{width.label}</div>
                  <div className="text-xs text-muted-foreground">{width.description}</div>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
