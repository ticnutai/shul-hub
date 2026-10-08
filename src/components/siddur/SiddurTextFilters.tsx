/**
 * Showing and hiding vowels, cantillation and instructions, as pills, a bar or a menu.
 * Split out of the prayer book's page (src/pages/Siddur.tsx).
 */
import { SlidersHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useFontAndColorSettings } from "@/contexts/FontAndColorSettingsContext";

import { useSiddurDisplayStyle, useSiddurTheme } from "./siddurTheme";

/* ─── TextFiltersBar (nikud / taamim toggles) ───────────── */
export const TextFilterPills = ({ scope }: { scope: "siddur" | "tehillim" }) => {
  const { settings, updateSettings } = useFontAndColorSettings();
  const { displayStyle, setDisplayStyle } = useSiddurDisplayStyle();
  const { theme } = useSiddurTheme();
  const showNikud  = settings.showNikud  ?? true;
  const showTaamim = settings.showTaamim ?? true;
  const widthOrder: Array<"narrow" | "normal" | "wide" | "full"> = ["narrow", "normal", "wide", "full"];
  const widthLabels: Record<"narrow" | "normal" | "wide" | "full", string> = {
    narrow: "צר",
    normal: "רגיל",
    wide: "רחב",
    full: "מלא",
  };
  const scopedWidth = scope === "tehillim" ? settings.tehillimContentWidth : settings.siddurContentWidth;
  const scopedNextWidth = widthOrder[(widthOrder.indexOf(scopedWidth) + 1) % widthOrder.length];

  const pill = (active: boolean, onClick: () => void, label: string, example: string) => (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all select-none"
      style={{
        background: active ? theme.accentColor : "hsl(var(--muted))",
        color:      active ? "hsl(var(--sidebar-background))" : "hsl(var(--muted-foreground))",
        boxShadow:  active ? `0 2px 8px ${theme.accentColor}44` : "none",
        fontFamily: "'Noto Serif Hebrew', serif",
        opacity:    active ? 1 : 0.6,
      }}
    >
      <span style={{ fontSize: "0.85em", opacity: active ? 1 : 0.5 }}>{example}</span>
      {label}
    </button>
  );

  return (
    <>
      {pill(showNikud,  () => updateSettings({ showNikud:  !showNikud  }), "ניקוד",  "בָּ")}
      {pill(showTaamim, () => updateSettings({ showTaamim: !showTaamim }), "טעמים", "֑")}
      {pill(true, () => updateSettings(scope === "tehillim" ? { tehillimContentWidth: scopedNextWidth } : { siddurContentWidth: scopedNextWidth }), `שוליים: ${widthLabels[scopedWidth]}`, "↔")}
      {pill(displayStyle === "ornate", () => setDisplayStyle(displayStyle === "ornate" ? "classic" : "ornate"), "תצוגה מפוארת", "✦")}
    </>
  );
};

/** The pills as their own row - the wide-screen arrangement. */
export const TextFiltersBar = ({ scope }: { scope: "siddur" | "tehillim" }) => (
  <div className="flex flex-wrap justify-center gap-2 mb-3">
    <TextFilterPills scope={scope} />
  </div>
);

/**
 * The three text toggles and the margin width, behind one button.
 *
 * They are not a choice between each other - ניקוד and טעמים are usually both
 * on, תצוגה מפוארת is independent of both - so they are checkboxes, and the
 * menu stays open while they are being set. A menu that shuts after one tap
 * turns "turn off taamim and switch to plain" into two trips.
 *
 * They cannot simply be dropped from a phone, either: these three exist
 * nowhere else in the app, and a setting you can no longer reach is not a
 * tidier screen, it is a missing feature.
 */
export const TextFilterMenu = ({ scope, color }: { scope: "siddur" | "tehillim"; color: string }) => {
  const { settings, updateSettings } = useFontAndColorSettings();
  const { displayStyle, setDisplayStyle } = useSiddurDisplayStyle();
  const showNikud  = settings.showNikud  ?? true;
  const showTaamim = settings.showTaamim ?? true;

  const widthOrder: Array<"narrow" | "normal" | "wide" | "full"> = ["narrow", "normal", "wide", "full"];
  const widthLabels: Record<"narrow" | "normal" | "wide" | "full", string> = {
    narrow: "צר", normal: "רגיל", wide: "רחב", full: "מלא",
  };
  const scopedWidth = scope === "tehillim" ? settings.tehillimContentWidth : settings.siddurContentWidth;
  const nextWidth = widthOrder[(widthOrder.indexOf(scopedWidth) + 1) % widthOrder.length];

  /** Checking a box must not close the menu - that is what "several" means. */
  const keepOpen = (e: Event) => e.preventDefault();

  const on = showNikud || showTaamim || displayStyle === "ornate";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-opacity hover:opacity-80"
          title="ניקוד, טעמים ותצוגה"
          aria-label="ניקוד, טעמים ותצוגה"
          style={{ color, background: "transparent", opacity: on ? 1 : 0.65 }}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" style={{ direction: "rtl" }}>
        <DropdownMenuLabel className="text-right text-xs text-muted-foreground">תצוגת הטקסט</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={showNikud}
          onSelect={keepOpen}
          onCheckedChange={v => updateSettings({ showNikud: v })}
          className="text-right"
        >
          ניקוד <span className="mr-1 opacity-60">בָּ</span>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={showTaamim}
          onSelect={keepOpen}
          onCheckedChange={v => updateSettings({ showTaamim: v })}
          className="text-right"
        >
          טעמים <span className="mr-1 opacity-60">֑</span>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={displayStyle === "ornate"}
          onSelect={keepOpen}
          onCheckedChange={v => setDisplayStyle(v ? "ornate" : "classic")}
          className="text-right"
        >
          תצוגה מפוארת <span className="mr-1 opacity-60">✦</span>
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {/* Not a toggle: four widths, tapped through. Kept open for the same
            reason - finding the right margin means trying more than one. */}
        <DropdownMenuItem
          onSelect={e => {
            keepOpen(e);
            updateSettings(scope === "tehillim" ? { tehillimContentWidth: nextWidth } : { siddurContentWidth: nextWidth });
          }}
          className="flex cursor-pointer justify-between text-right"
        >
          <span>שוליים</span>
          <span className="text-xs font-semibold" style={{ color }}>{widthLabels[scopedWidth]} ↔</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
