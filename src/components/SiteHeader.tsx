import { Link } from "@tanstack/react-router";
import { Menu, Palette, Settings, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextSettingsDialog } from "@/components/TextSettingsDialog";
import { NotificationCenter } from "@/components/NotificationCenter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSettings } from "@/lib/data";
import { THEMES, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "זמני תפילות" },
  { to: "/announcements", label: "מודעות" },
  { to: "/shiurim", label: "שיעורים" },
  { to: "/chavrutot", label: "חברותות" },
  { to: "/contact", label: "הודעה למנהל" },
] as const;

export function SiteHeader() {
  const { data: settings } = useSettings();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-gold/40 bg-sidebar text-sidebar-foreground shadow-lg">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-center gap-2 px-4 py-2.5 sm:flex-nowrap sm:justify-start sm:gap-3">
        <Link
          to="/"
          className="flex min-w-0 basis-full items-center justify-center gap-2 sm:basis-auto sm:justify-start sm:flex-1"
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-md border border-gold/50 bg-sidebar-accent/70 text-gold">
            <span className="text-[10px] font-semibold leading-none">ב״ה</span>
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-semibold text-sidebar-foreground">
              {settings?.name ?? "בית הכנסת"}
            </span>
            <span className="block truncate text-xs text-sidebar-foreground/65">
              {settings?.address ?? ""}
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-lg px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-gold"
              activeProps={{
                className: "bg-sidebar-accent text-gold font-semibold ring-1 ring-gold/35",
              }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <ThemeMenu />

        <TextSettingsDialog />

        <NotificationCenter />

        <Button
          asChild
          variant="ghost"
          size="icon"
          aria-label="הגדרות ניהול"
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-gold"
        >
          <Link to="/admin">
            <Settings className="size-5" />
          </Link>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-gold md:hidden"
          aria-label="תפריט"
          onClick={() => setOpen((v) => !v)}
        >
          <Menu className="size-5" />
        </Button>
      </div>

      {open && (
        <nav className="grid gap-1 border-t border-gold/25 bg-sidebar px-4 pb-3 pt-2 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-gold"
              activeProps={{ className: "bg-sidebar-accent text-gold font-medium" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="ערכת נושא"
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-gold"
        >
          <Palette className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>ערכת נושא</DropdownMenuLabel>
        {THEMES.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onSelect={() => setTheme(t.id)}
            className="flex items-center gap-2"
          >
            <span className="flex gap-1">
              {t.swatch.map((c) => (
                <span
                  key={c}
                  className="size-3.5 rounded-full border border-border"
                  style={{ backgroundColor: c }}
                />
              ))}
            </span>
            <span className="flex-1">{t.name}</span>
            <Check className={cn("size-4", theme === t.id ? "opacity-100" : "opacity-0")} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
