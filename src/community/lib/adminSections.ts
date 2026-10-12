/**
 * Every section of the gabbai's area, in one place: the tabs' list on the
 * phone and the tiles (AdminTiles.tsx) read it, so a section is added once.
 */
import {
  BookOpen, Bot, Building2, CalendarClock, Download, FileUp, Handshake, KeyRound, LayoutDashboard,
  Megaphone, MessageSquareText, QrCode, Tv, UserPlus, Users, type LucideIcon,
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
  { value: "ai", label: "עוזר חכם", icon: Bot, hint: "הוספת תוכן בעזרת העוזר" },
  { value: "api", label: "מפתח API", icon: KeyRound, hint: "חיבור מערכות חיצוניות" },
  { value: "qr", label: "קודי QR", icon: QrCode, hint: "קודים להדפסה ולתלייה" },
  { value: "data", label: "ייצוא/ייבוא", icon: FileUp, hint: "גיבוי והעברת נתונים" },
  { value: "apps", label: "הורדת אפליקציות", icon: Download, hint: "האפליקציה לטלפון ולמסכים" },
];

