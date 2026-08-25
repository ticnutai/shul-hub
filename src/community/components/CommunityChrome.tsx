import { Link, NavLink } from "react-router-dom";
import { BookOpen, CalendarClock, House, Megaphone, MessageSquareText, ScrollText, Settings, Users } from "lucide-react";
import { useSettings } from "@community/lib/data";
import { cn } from "@/lib/utils";
import { NotificationCenter } from "@community/components/NotificationCenter";

const links = [
  { to: "/community", label: "זמני תפילות", icon: CalendarClock },
  { to: "/community/announcements", label: "מודעות", icon: Megaphone },
  { to: "/community/shiurim", label: "שיעורים", icon: BookOpen },
  { to: "/community/chavrutot", label: "חברותות", icon: Users },
  { to: "/community/contact", label: "הודעה למנהל", icon: MessageSquareText },
];

export function CommunityHeader() {
  const { data: settings } = useSettings();
  return (
    <header dir="rtl" className="sticky top-0 z-50 border-b border-amber-400/40 bg-[#172c57] text-white shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-3 sm:px-5">
        <span className="shrink-0 text-sm font-bold text-amber-400">ב״ה</span>
        <Link to="/community" className="min-w-0 flex-1 text-center sm:text-right">
          <strong className="block truncate text-base sm:text-xl">{settings?.name ?? "בית הכנסת אושר של יהודי"}</strong>
          <span className="block truncate text-xs text-white/65 sm:text-sm">{settings?.address ?? "מצדה 9, בסר 3, קומה 34, בני ברק"}</span>
        </Link>
        <Link to="/" className="grid size-9 shrink-0 place-items-center rounded-lg text-amber-400 hover:bg-white/10" aria-label="חומש ומפרשים">
          <ScrollText className="size-5" />
        </Link>
        <Link to="/siddur" className="grid size-9 shrink-0 place-items-center rounded-lg text-amber-400 hover:bg-white/10" aria-label="סידור">
          <BookOpen className="size-5" />
        </Link>
        <NotificationCenter />
      </div>
      <nav className="mx-auto flex max-w-7xl items-stretch overflow-x-auto px-2 pb-2 sm:px-5" aria-label="ניווט קהילתי">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === "/community"} className={({ isActive }) => cn("flex min-w-max items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/75 transition", isActive ? "bg-white/12 text-amber-400 ring-1 ring-amber-400/50" : "hover:bg-white/10 hover:text-white")}>
            <Icon className="size-4" />{label}
          </NavLink>
        ))}
        <NavLink to="/community/admin" className={({ isActive }) => cn("mr-auto flex min-w-max items-center gap-1.5 rounded-lg px-3 py-2 text-sm", isActive ? "bg-white/12 text-amber-400" : "text-white/75 hover:bg-white/10")}>
          <Settings className="size-4" />ניהול
        </NavLink>
      </nav>
    </header>
  );
}

export function CommunityFooter() {
  const { data: settings } = useSettings();
  return (
    <footer dir="rtl" className="mt-16 border-t border-amber-400/20 bg-[#172c57] text-white/70">
      <div className="mx-auto max-w-5xl px-4 py-8 text-center text-sm">
        <p className="font-semibold text-white">{settings?.name ?? "בית הכנסת"}</p>
        {settings?.address && <p className="mt-1">{settings.address}</p>}
        {settings?.phone && <p className="mt-1" dir="ltr">{settings.phone}</p>}
        <Link to="/community" className="mt-4 inline-flex items-center gap-1 text-amber-400"><House className="size-4" />חזרה לדף הקהילה</Link>
      </div>
    </footer>
  );
}
