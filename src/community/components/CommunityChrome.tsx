import { Link, NavLink } from "react-router-dom";
import { BookOpen, House, Megaphone, MessageSquareText, Settings, Users } from "lucide-react";
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
    "community-nav-item flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-center text-[11px] font-semibold leading-tight transition sm:gap-1.5 sm:px-3 sm:text-sm",
    isActive
      ? "text-[#f0c84b] ring-1 ring-[#d4af37]/80"
      : "text-[#d4af37] hover:bg-white/5 hover:text-[#f0c84b]",
  );

export function CommunityHeader() {
  const { data: settings } = useSettings();
  return (
    <header
      dir="rtl"
      className="community-header sticky top-0 z-50 border-b border-sidebar-primary/40 bg-sidebar text-sidebar-foreground shadow-lg"
      style={{ paddingTop: "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))" }}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-3 sm:px-5">
        <span className="shrink-0 text-sm font-bold text-amber-400">ב״ה</span>
        <Link to="/community" className="min-w-0 flex-1 text-center sm:text-right">
          <strong className="block truncate text-base sm:text-xl">{settings?.name ?? "בית הכנסת אושר של יהודי"}</strong>
          <span className="block truncate text-xs text-white/65 sm:text-sm">{settings?.address ?? "מצדה 9, בסר 3, קומה 34, בני ברק"}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-0.5">
          <Link to="/community/contact" aria-label="הודעה למנהל" title="הודעה למנהל" className="rounded-full p-2 text-white/75 transition hover:bg-white/10 hover:text-white">
            <MessageSquareText className="size-5" />
          </Link>
          <NavLink to="/community/admin" aria-label="ניהול" title="ניהול" className={({ isActive }) => cn("rounded-full p-2 transition", isActive ? "bg-white/12 text-amber-400" : "text-white/75 hover:bg-white/10 hover:text-white")}>
            <Settings className="size-5" />
          </NavLink>
          <NotificationCenter />
        </div>
      </div>
      <PrimaryDestinationNav className="mx-auto mt-2 max-w-md px-2 sm:mt-2.5" />
      <nav className="community-nav-shell mx-auto grid max-w-3xl grid-cols-3 gap-1 px-2 pb-2 sm:px-5" aria-label="ניווט קהילתי">
        {communityLinks.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => navItemClass(isActive)}>
            <Icon className="size-4 shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

export function CommunityFooter() {
  const { data: settings } = useSettings();
  return (
    <footer dir="rtl" className="mt-16 border-t border-amber-400/20 bg-[#172c57] text-white/70">
      <div
        className="mx-auto max-w-5xl px-4 pt-8 text-center text-sm"
        style={{ paddingBottom: "calc(2rem + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))" }}
      >
        <p className="font-semibold text-white">{settings?.name ?? "בית הכנסת"}</p>
        {settings?.address && <p className="mt-1">{settings.address}</p>}
        {settings?.phone && <p className="mt-1" dir="ltr">{settings.phone}</p>}
        <Link to="/community" className="mt-4 inline-flex items-center gap-1 text-amber-400"><House className="size-4" />חזרה לדף הקהילה</Link>
      </div>
    </footer>
  );
}
