/**
 * Every section of the gabbai's area, in one place: the tabs' list on the
 * phone and the tiles (AdminTiles.tsx) read it, so a section is added once.
 */
import {
  BookOpen, Bot, Building2, CalendarClock, FileUp, Handshake, LayoutDashboard,
  Megaphone, MessageSquareText, Share2, Tv, UserPlus, Users, type LucideIcon,
} from "lucide-react";

export interface AdminSection {
  value: string;
  label: string;
  icon: LucideIcon;
  /** One line under the tile's name: what is in there. */
  hint: string;
}

/** Every section of the gabbai's area, in one place: the tabs, the phone's list and the tiles read it. */
export const ADMIN_SECTIONS: AdminSection[] = [
  { value: "minyanim", label: "מניינים", icon: CalendarClock, hint: "זמני התפילות, לפי ימים ותפילות" },
  { value: "announcements", label: "מודעות", icon: Megaphone, hint: "הודעות לציבור, מזל טוב ועדכונים" },
  { value: "shiurim", label: "שיעורים", icon: BookOpen, hint: "שיעורי תורה ומגידי שיעור" },
  { value: "chavrutot", label: "חברותות", icon: Handshake, hint: "לימוד בחברותא" },
  { value: "chavruta-requests", label: "בקשות חברותא", icon: UserPlus, hint: "מי מחפש חברותא" },
  { value: "messages", label: "הודעות", icon: MessageSquareText, hint: "פניות שהגיעו מהאתר" },
  { value: "tv", label: "תצוגות", icon: Tv, hint: "לוחות הטלוויזיה: עיצוב, תוכן ומסכים" },
  { value: "widgets", label: "תצוגת דף הבית", icon: LayoutDashboard, hint: "הכותרת, ערכות הנושא ודף הבית" },
  { value: "users", label: "משתמשים", icon: Users, hint: "גבאים והרשאות" },
  { value: "communities", label: "בתי כנסת ופרטים", icon: Building2, hint: "כתובת, מיקום ולוגו" },
  // The assistant and its key are one section: the key is only ever for the assistant.
  { value: "ai", label: "עוזר חכם", icon: Bot, hint: "הוספת תוכן בעזרת העוזר, והמפתח שלו" },
  // The printed codes and the installers are one section: both are how people get to the site and the app.
  { value: "share", label: "שיתוף והורדות", icon: Share2, hint: "קודים להדפסה, והתקנת האפליקציה לטלפון ולמסכים" },
  { value: "data", label: "ייצוא וייבוא", icon: FileUp, hint: "גיבוי והעברת נתונים" },
];

/**
 * Sections that were merged into another, and old links to them: each opens
 * the section it is part of now, and `focus` the panel it became there.
 * ("הגדרות" moved to the synagogue's details, under "בתי כנסת ופרטים".)
 */
export const SECTION_ALIASES: Record<string, { tab: string; focus?: string }> = {
  settings: { tab: "communities" },
  api: { tab: "ai", focus: "key" },
  qr: { tab: "share" },
  apps: { tab: "share", focus: "apps" },
};

/**
 * The sections in four groups, for the layouts that show them grouped (the
 * side menu, the menus, the search): each section in exactly one group, in
 * the order of ADMIN_SECTIONS within it.
 */
export const ADMIN_GROUPS: { id: string; label: string; sections: string[] }[] = [
  { id: "prayer", label: "תפילות ולימוד", sections: ["minyanim", "shiurim", "chavrutot", "chavruta-requests"] },
  { id: "community", label: "קהילה ופניות", sections: ["announcements", "messages", "users"] },
  { id: "site", label: "האתר והמסכים", sections: ["tv", "widgets", "share"] },
  { id: "system", label: "הגדרות ונתונים", sections: ["communities", "ai", "data"] },
];

/** The groups with the sections this gabbai has (the store app has no boards), empty groups left out. */
export function groupSections(sections: AdminSection[]): { id: string; label: string; sections: AdminSection[] }[] {
  return ADMIN_GROUPS.map((g) => ({ ...g, sections: g.sections.flatMap((v) => sections.filter((s) => s.value === v)) })).filter((g) => g.sections.length);
}
