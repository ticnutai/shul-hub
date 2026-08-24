import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Palette, Settings, Check, WandSparkles, Copy, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextSettingsDialog } from "@/components/TextSettingsDialog";
import { NotificationCenter } from "@/components/NotificationCenter";
import { AccountButton } from "@/components/AccountButton";
import { MigrationCredentialsDialog } from "@/components/MigrationCredentialsDialog";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSettings } from "@/lib/data";
import { type ThemeColors, type ThemeOption, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisualColorPicker } from "@/components/VisualColorPicker";

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
  const [hydrated, setHydrated] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => setHydrated(true), []);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      data-app-hydrated={hydrated ? "true" : "false"}
      className="sticky top-0 z-40 border-b border-sidebar-border/40 bg-sidebar text-sidebar-foreground shadow-lg"
    >
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-center gap-2 px-4 py-2.5 sm:flex-nowrap sm:justify-start sm:gap-3">
        <Link
          to="/"
          data-testid="site-header-brand"
          className="relative flex min-w-0 basis-full items-center justify-center gap-2 sm:basis-auto sm:flex-1 sm:justify-start"
        >
          <span
            className="absolute right-0 top-0.5 shrink-0 text-sidebar-primary sm:static sm:self-start sm:pt-0.5"
            aria-label="ב״ה"
          >
            <span className="text-[11px] font-semibold leading-none">ב״ה</span>
          </span>
          <span className="min-w-0 text-center sm:text-right" data-testid="site-header-title">
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
              className="rounded-lg px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-primary"
              activeProps={{
                className:
                  "bg-sidebar-accent text-sidebar-primary font-semibold ring-1 ring-sidebar-primary/35",
              }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <fieldset disabled={!hydrated} className="contents">
          <ThemeMenu />

          <TextSettingsDialog />

          <NotificationCenter />

          <AccountButton />

          <MigrationCredentialsDialog />

          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="הגדרות ניהול"
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-primary"
          >
            <Link to="/admin">
              <Settings className="size-5" />
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-primary md:hidden"
            aria-label="תפריט"
            disabled={!hydrated}
            onClick={() => setOpen((v) => !v)}
          >
            <Menu className="size-5" />
          </Button>
        </fieldset>
      </div>

      <nav
        aria-label="ניווט מהיר"
        className="grid grid-cols-3 gap-1.5 border-t border-sidebar-border/25 bg-sidebar px-3 py-2 md:hidden"
      >
        {MOBILE_PRIMARY_NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="rounded-lg border border-sidebar-border/20 bg-sidebar-accent/45 px-2 py-1.5 text-center text-xs font-medium text-sidebar-foreground/85 transition-colors hover:border-sidebar-border/45 hover:text-sidebar-primary"
            activeProps={{
              className:
                "border-sidebar-border/55 bg-sidebar-accent text-sidebar-primary shadow-soft",
            }}
            activeOptions={{ exact: item.to === "/" }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {open && (
        <nav
          aria-label="תפריט ניווט נוסף"
          className="grid gap-1 border-t border-sidebar-border/25 bg-sidebar px-4 pb-3 pt-2 md:hidden"
        >
          {MOBILE_MENU_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-primary"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-primary font-medium" }}
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
  const { theme, themes, setTheme } = useTheme();
  const [editorOpen, setEditorOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="ערכת נושא"
            disabled={!hydrated}
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-primary"
          >
            <Palette className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-[70dvh] w-56 overflow-y-auto">
          <DropdownMenuLabel>ערכת נושא</DropdownMenuLabel>
          {themes.map((t) => (
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
          <DropdownMenuItem onSelect={() => setEditorOpen(true)} className="font-medium">
            <Palette className="size-4" /> עריכת הערכה הנוכחית
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="?designMode=1" className="flex items-center gap-2 font-medium">
              <WandSparkles className="size-4" />
              עריכת עיצוב בתצוגה חיה
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ThemeEditorDialog open={editorOpen} onOpenChange={setEditorOpen} />
    </>
  );
}

function colorsFor(theme: ThemeOption): ThemeColors {
  return (
    theme.colors ?? {
      primary: theme.swatch[0]!,
      gold: theme.swatch[1]!,
      background: theme.swatch[2]!,
      foreground: theme.swatch[0]!,
      card: theme.swatch[2]!,
      sidebar: theme.swatch[0]!,
    }
  );
}

function ThemeEditorDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { theme, themes, updateTheme, duplicateTheme } = useTheme();
  const current = themes.find((item) => item.id === theme) ?? themes[0]!;
  const [name, setName] = useState(current.name);
  const [colors, setColors] = useState<ThemeColors>(() => colorsFor(current));

  useEffect(() => {
    if (!open) return;
    setName(current.name);
    setColors(colorsFor(current));
  }, [current, open]);

  const setColor = (key: keyof ThemeColors, value: string) =>
    setColors((previous) => ({ ...previous, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-h-[85dvh] w-[calc(100vw-1rem)] max-w-xl overflow-y-auto rounded-2xl p-4 sm:p-6"
      >
        <DialogHeader className="text-right sm:text-right">
          <DialogTitle>עריכת ערכת נושא</DialogTitle>
          <DialogDescription>
            אפשר לעדכן את הערכה הנוכחית או לשמור עותק חדש בלי לפגוע במקור.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="theme-name">שם הערכה</Label>
            <Input id="theme-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(
              [
                ["primary", "צבע ראשי"],
                ["gold", "צבע הדגשה"],
                ["background", "רקע העמוד"],
                ["foreground", "צבע טקסט"],
                ["card", "רקע כרטיסים"],
                ["sidebar", "רקע הכותרת"],
              ] as const
            ).map(([key, label]) => (
              <VisualColorPicker
                key={key}
                label={label}
                value={colors[key]}
                onChange={(value) => setColor(key, value)}
              />
            ))}
          </div>
          <div
            aria-label="תצוגה מקדימה לערכת הנושא"
            className="rounded-xl border p-4"
            style={{ background: colors.background, color: colors.foreground }}
          >
            <div
              className="mb-3 rounded-lg px-3 py-2 font-semibold"
              style={{ background: colors.sidebar, color: colors.background }}
            >
              בית הכנסת — תצוגה מקדימה
            </div>
            <div className="rounded-lg p-3" style={{ background: colors.card }}>
              טקסט לדוגמה
              <span
                className="ms-2 inline-block rounded-md px-2 py-1 text-xs"
                style={{ background: colors.primary, color: colors.background }}
              >
                כפתור
              </span>
              <span className="ms-2 font-bold" style={{ color: colors.gold }}>
                הדגשה
              </span>
            </div>
          </div>
        </div>
        <DialogFooter className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:space-x-0">
          <Button
            variant="outline"
            onClick={() => {
              duplicateTheme(theme, name === current.name ? `${name} — עותק` : name, colors);
              onOpenChange(false);
            }}
          >
            <Copy className="size-4" /> שכפל ושמור
          </Button>
          <Button
            onClick={() => {
              updateTheme(theme, name, colors);
              onOpenChange(false);
            }}
          >
            <Save className="size-4" /> עדכן ושמור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
