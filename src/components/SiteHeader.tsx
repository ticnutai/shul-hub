import { Link } from "@tanstack/react-router";
import { Menu, Palette, Settings, Check, WandSparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextSettingsDialog } from "@/components/TextSettingsDialog";
import { NotificationCenter } from "@/components/NotificationCenter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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

const MOBILE_PRIMARY_NAV = NAV.slice(0, 3);
const MOBILE_MENU_NAV = NAV.slice(3);

export function SiteHeader() {
  const { data: settings } = useSettings();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-gold/40 bg-sidebar text-sidebar-foreground shadow-lg">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-center gap-2 px-4 py-2.5 sm:flex-nowrap sm:justify-start sm:gap-3">
        <Link
          to="/"
          className="flex min-w-0 basis-full items-center justify-start gap-2 sm:basis-auto sm:flex-1"
        >
          <span className="shrink-0 self-start pt-0.5 text-gold" aria-label="ב״ה">
            <span className="text-[11px] font-semibold leading-none">ב״ה</span>
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

        <LiveDesignButton />

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

      <nav
        aria-label="ניווט מהיר"
        className="grid grid-cols-3 gap-1.5 border-t border-gold/25 bg-sidebar px-3 py-2 md:hidden"
      >
        {MOBILE_PRIMARY_NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="rounded-lg border border-gold/20 bg-sidebar-accent/45 px-2 py-1.5 text-center text-xs font-medium text-sidebar-foreground/85 transition-colors hover:border-gold/45 hover:text-gold"
            activeProps={{
              className: "border-gold/55 bg-sidebar-accent text-gold shadow-soft",
            }}
            activeOptions={{ exact: item.to === "/" }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {open && (
        <nav className="grid gap-1 border-t border-gold/25 bg-sidebar px-4 pb-3 pt-2 md:hidden">
          {MOBILE_MENU_NAV.map((item) => (
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

function LiveDesignButton() {
  return (
    <Button asChild variant="ghost" size="icon">
      <a
        href="?designMode=1"
        aria-label="עריכת עיצוב חיה"
        className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-gold"
      >
        <WandSparkles className="size-5" />
      </a>
    </Button>
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
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="?designMode=1" className="flex items-center gap-2 font-medium">
            <WandSparkles className="size-4" />
            עריכת עיצוב בתצוגה חיה
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
