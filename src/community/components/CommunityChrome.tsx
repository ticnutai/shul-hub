import { Link, NavLink } from "react-router-dom";
import { BookOpen, House, Megaphone, MessageSquareText, Palette, Settings, Users } from "lucide-react";
import { useSettings } from "@community/lib/data";
import { cn } from "@/lib/utils";
import { NotificationCenter } from "@community/components/NotificationCenter";
import { PrimaryDestinationNav } from "@/components/PrimaryDestinationNav";

const communityLinks = [
  { to: "/community/shiurim", label: "שיעורים", icon: BookOpen },
  { to: "/community/chavrutot", label: "חברותות", icon: Users },
  { to: "/community/announcements", label: "מודעות", icon: Megaphone },
];

const navItemClass = (isActive: boolean) =>
  cn(
    "community-nav-item flex min-w-0 items-center justify-center gap-1 rounded-lg text-center font-semibold leading-tight transition sm:gap-1.5 sm:px-3",
    isActive
      ? "text-[#f0c84b] ring-1 ring-[#d4af37]/80"
      : "text-[#d4af37] hover:bg-white/5 hover:text-[#f0c84b]",
  );

export function GlobalAppHeader() {
  const { data: settings } = useSettings();
  return (
    <header
      data-testid="global-app-header"
      dir="rtl"
      className="community-header sticky top-0 z-50 border-b border-sidebar-primary/40 bg-sidebar text-sidebar-foreground shadow-lg"
      style={{ paddingTop: "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))" }}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-3 sm:px-5">
        <span className="shrink-0 text-sm font-bold text-amber-400">ב״ה</span>
        <Link to="/community" className="min-w-0 flex-1 text-center sm:text-right">
          <strong data-testid="community-site-title" className="block whitespace-normal text-base font-bold leading-tight sm:text-xl">{settings?.name ?? "בית הכנסת אושר של יהודי"}</strong>
          <span className="block truncate text-xs text-white/65 sm:text-sm">{settings?.address ?? "מצדה 9, בסר 3, קומה 34, בני ברק"}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-0.5">
          <Link to="/community/contact" aria-label="הודעה למנהל" title="הודעה למנהל" className="rounded-full p-2 text-white/75 transition hover:bg-white/10 hover:text-white">
            <MessageSquareText className="size-5" />
          </Link>
          <NotificationCenter />
        </div>
      </div>
      <PrimaryDestinationNav className="mx-auto mb-2 mt-2 max-w-md px-2 sm:mb-2.5 sm:mt-2.5" />
    </header>
  );
}

/** Contextual navigation shown only inside the synagogue section. */
export function CommunityHeader() {
  return (
    <div dir="rtl" className="community-secondary-shell bg-sidebar text-sidebar-foreground">
      <nav className="community-nav-shell community-secondary-nav mx-auto grid grid-cols-3 gap-1" aria-label="ניווט קהילתי">
        {communityLinks.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => navItemClass(isActive)}>
            <Icon className="size-4 shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function CommunityFooter() {
  const { data: settings } = useSettings();
  const contactPhone = settings?.phone ?? "054-647-3461";
  return (
    <footer dir="rtl" className="mt-16 border-t border-amber-400/20 bg-[#172c57] text-white/70">
      <div
        className="relative mx-auto max-w-5xl px-4 pt-8 text-center text-sm"
        style={{ paddingBottom: "calc(3.75rem + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))" }}
      >
        <p className="font-semibold text-white">{settings?.name ?? "בית הכנסת"}</p>
        {settings?.address && <p className="mt-1">{settings.address}</p>}
        <div
          data-testid="community-rabbi-contact"
          className="mx-auto mt-4 w-fit min-w-56 rounded-xl border border-amber-400/25 bg-white/5 px-6 py-3 shadow-sm"
        >
          <p data-testid="community-contact-topic" className="text-sm font-medium text-amber-400">לכל נושא של יהדות</p>
          <p data-testid="community-rabbi-name" className="mt-1 text-base font-semibold text-white">הרב חיים אושרי</p>
          <a
            data-testid="community-phone"
            className="mt-1.5 inline-block text-sm tracking-wide text-white/80 transition hover:text-amber-300"
            dir="ltr"
            href={`tel:${contactPhone.replace(/[^\d+]/g, "")}`}
          >
            {contactPhone}
          </a>
        </div>
        <Link to="/community" className="mt-4 inline-flex items-center gap-1 text-amber-400"><House className="size-4" />חזרה לדף הקהילה</Link>
        <div
          data-testid="footer-utility-actions"
          className="absolute flex items-center gap-2"
          style={{
            right: "0.75rem",
            bottom: "calc(0.75rem + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))",
          }}
        >
          <NavLink
            to="/community/admin?tab=settings"
            aria-label="ניהול האתר"
            title="ניהול האתר"
            className={({ isActive }) => cn(
              "inline-flex size-8 items-center justify-center rounded-full border border-white/15 transition",
              isActive ? "bg-white/12 text-amber-400" : "text-white/60 hover:bg-white/10 hover:text-amber-400",
            )}
          >
            <Settings className="size-4" />
          </NavLink>
          <button
            type="button"
            aria-label="ערכות נושא"
            title="ערכות נושא"
            className="inline-flex size-8 items-center justify-center rounded-full border border-white/15 text-white/60 transition hover:bg-white/10 hover:text-amber-400"
            onClick={() => {
              document.documentElement.dataset.openAppThemes = "true";
              window.dispatchEvent(new CustomEvent("open-app-themes"));
            }}
          >
            <Palette className="size-4" />
          </button>
        </div>
      </div>
    </footer>
  );
}
