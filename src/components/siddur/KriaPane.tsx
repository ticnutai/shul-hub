/**
 * The Torah reading: the blessings, the weekday's reading and the order of the week.
 * Split out of the prayer book's page (src/pages/Siddur.tsx).
 */
import { Loader2, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

import type { SiddurSection } from "@/hooks/useSiddurData";
import { cn } from "@/lib/utils";
import { getWeekdayLeyning, getCalendarPreference, type WeekdayLeyning } from "@/utils/parshaUtils";

import { Divider, OrnamentTitle } from "./SiddurChrome";
import { SectionCard } from "./SiddurReaders";
import { heNum } from "./siddurText";
import { useSiddurTheme } from "./siddurTheme";

/* ─── KriaPane ───────────────────────────────────────────── */
export const ALIYAH_NUM_HE: Record<number, string> = { 1: 'כהן', 2: 'לוי', 3: 'ישראל', 4: 'רביעי', 5: 'חמישי', 6: 'שישי', 7: 'שביעי' };

/** "פרק ה פסוק יב": a place in the Torah is written in letters, as in every sefer. */
export function pasukRef(ref: string): string {
  const [p, v] = ref.split(':').map(Number);
  return `פרק\u00a0${heNum(p)} פסוק\u00a0${heNum(v)}`;
}

export const WeekdayReadingCard = ({ onOpenReading }: { onOpenReading: (seferId: number, parshaNum: number) => void }) => {
  const [leyning, setLeyning] = useState<WeekdayLeyning | null>(null);
  const [loadingL, setLoadingL] = useState(true);
  const { theme } = useSiddurTheme();

  useEffect(() => {
    try { setLeyning(getWeekdayLeyning(getCalendarPreference())); }
    catch { /* ignore */ }
    setLoadingL(false);
  }, []);

  if (loadingL)
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: theme.accentColor }} />
      </div>
    );

  if (!leyning)
    return (
      <div
        className="my-4 rounded-xl border px-4 py-3 text-sm text-right text-muted-foreground"
        dir="rtl"
        style={{ borderColor: `${theme.accentColor}30`, background: `${theme.accentColor}0a` }}
      >
        קריאת שני וחמישי אינה זמינה כעת
      </div>
    );

  const todayLabel = (() => {
    const d = new Date().getDay();
    return d === 1 ? 'שני' : d === 4 ? 'חמישי' : 'שני / חמישי';
  })();

  return (
    <div
      className="my-4 rounded-xl border overflow-hidden"
      dir="rtl"
      style={{ borderColor: `${theme.accentColor}44`, boxShadow: `0 2px 12px ${theme.accentColor}18` }}
    >
      {/* Card header */}
      <div
        className="px-4 py-3 flex items-center justify-between gap-3"
        style={{ background: `${theme.accentColor}14`, borderBottom: `1px solid ${theme.accentColor}30` }}
      >
        <Button
          size="sm"
          onClick={() => onOpenReading(leyning.seferId, leyning.parshaNum)}
          className="flex items-center gap-1.5 text-xs font-medium shrink-0"
          style={{ background: theme.accentColor, color: '#1a1a1a' }}
        >
          <ExternalLink className="h-3 w-3" />
          פתח בחומש
        </Button>
        <div className="text-right">
          <p className="font-bold" style={{ color: theme.accentColor, fontFamily: "'Noto Serif Hebrew', serif", fontSize: '1rem' }}>
            {leyning.parshaHe}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            קריאת {todayLabel} שבוע זה — ג׳ עולים
          </p>
        </div>
      </div>

      {/* Aliyot rows */}
      <div className="divide-y divide-border/30">
        {leyning.aliyot.map((a, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-2.5 gap-3" dir="rtl">
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{ background: `${theme.accentColor}22`, color: theme.accentColor, fontFamily: "'Noto Serif Hebrew', serif" }}
            >
              {ALIYAH_NUM_HE[i + 1] ?? `עלייה ${heNum(i + 1)}`}
            </span>
            <div className="flex-1 text-right">
              <span className="text-sm font-medium" style={{ fontFamily: "'Noto Serif Hebrew', serif" }}>
                {a.bookHe} {pasukRef(a.begin)}
              </span>
              <span className="text-xs text-muted-foreground"> עד </span>
              <span className="text-sm font-medium" style={{ fontFamily: "'Noto Serif Hebrew', serif" }}>
                {pasukRef(a.end)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{heNum(a.verses)}&nbsp;פסוקים</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const KRIA_BLESSINGS: SiddurSection[] = [
  {
    title: "ברכה לפני הקריאה",
    lines: [
      "בָּרְכוּ אֶת יְיָ הַמְבֹרָךְ׃",
      "בָּרוּךְ יְיָ הַמְבֹרָךְ לְעוֹלָם וָעֶד׃",
      "בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם אֲשֶׁר בָּחַר בָּנוּ מִכָּל הָעַמִּים וְנָתַן לָנוּ אֶת תּוֹרָתוֹ׃ בָּרוּךְ אַתָּה יְיָ נוֹתֵן הַתּוֹרָה׃",
    ],
  },
  {
    title: "ברכה לאחר הקריאה",
    lines: [
      "בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם אֲשֶׁר נָתַן לָנוּ תּוֹרַת אֱמֶת וְחַיֵּי עוֹלָם נָטַע בְּתוֹכֵנוּ׃ בָּרוּךְ אַתָּה יְיָ נוֹתֵן הַתּוֹרָה׃",
    ],
  },
  {
    title: "ברכות ההפטרה (לפני)",
    lines: [
      "בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם אֲשֶׁר בָּחַר בִּנְבִיאִים טוֹבִים וְרָצָה בְדִבְרֵיהֶם הַנֶּאֱמָרִים בֶּאֱמֶת׃ בָּרוּךְ אַתָּה יְיָ הַבּוֹחֵר בַּתּוֹרָה וּבְמֹשֶׁה עַבְדּוֹ וּבְיִשְׂרָאֵל עַמּוֹ וּבִנְבִיאֵי הָאֱמֶת וָצֶדֶק׃",
    ],
  },
  {
    title: "ברכות ההפטרה (לאחר)",
    lines: [
      "בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם צוּר כָּל הָעוֹלָמִים צַדִּיק בְּכָל הַדּוֹרוֹת הָאֵל הַנֶּאֱמָן הָאוֹמֵר וְעוֹשֶׂה הַמְדַבֵּר וּמְקַיֵּם שֶׁכָּל דְּבָרָיו אֱמֶת וָצֶדֶק׃",
      "נֶאֱמָן אַתָּה הוּא יְיָ אֱלֹהֵינוּ וְנֶאֱמָנִים דְּבָרֶיךָ וְדָבָר אֶחָד מִדְּבָרֶיךָ אָחוֹר לֹא יָשׁוּב רֵיקָם כִּי אֵל מֶלֶךְ נֶאֱמָן וְרַחֲמָן אָתָּה׃ בָּרוּךְ אַתָּה יְיָ הָאֵל הַנֶּאֱמָן בְּכָל דְּבָרָיו׃",
    ],
  },
  {
    title: "מי שברך לעולה לתורה",
    lines: [
      "מִי שֶׁבֵּרַךְ אֲבוֹתֵינוּ אַבְרָהָם יִצְחָק וְיַעֲקֹב הוּא יְבָרֵךְ אֶת [שם] בַּעֲבוּר שֶׁעָלָה לִכְבוֹד הַמָּקוֹם וְלִכְבוֹד הַתּוֹרָה׃",
      "בִּשְׂכַר זֶה הַקָּדוֹשׁ בָּרוּךְ הוּא יִשְׁמְרֵהוּ וְיַצִּילֵהוּ מִכָּל צָרָה וְצוּקָה וּמִכָּל נֶגַע וּמַחֲלָה וְיִשְׁלַח בְּרָכָה וְהַצְלָחָה בְּכָל מַעֲשֵׂה יָדָיו וְיִזְכֶּה לַעֲלוֹת לְרֶגֶל עִם כָּל יִשְׂרָאֵל אֶחָיו׃ וְנֹאמַר אָמֵן׃",
    ],
  },
];

export const KRIA_SCHEDULE = [
  { days: "שני וחמישי",   aliyot: "ג׳ עולים",            note: "ראשית הפרשה" },
  { days: "שבת שחרית",   aliyot: "ז׳ + מפטיר",          note: "קריאה שלמה" },
  { days: "שבת מנחה",    aliyot: "ג׳ עולים",            note: "פרשה הבאה" },
  { days: "ראש חודש",    aliyot: "ד׳ עולים",            note: "במדבר כח" },
  { days: "שלש רגלים",   aliyot: "ה׳ עולים",            note: "ענין היום" },
  { days: "ראש השנה",    aliyot: "ב׳ ספרי תורה",        note: "עקידה + מוסף" },
  { days: "יום כיפור",   aliyot: "ו׳ שחרית + ג׳ מנחה", note: "" },
];

export const KriaPane = ({ onNavigate }: { onNavigate: (seferId?: number, perek?: number) => void }) => {
  const { theme } = useSiddurTheme();
  const navigate = useNavigate();
  return (
  <div className="pb-8" dir="rtl">
    <OrnamentTitle text="קריאה בתורה" />
    <Divider />

    {/* Live Mon/Thu reading for this week */}
    <WeekdayReadingCard
      onOpenReading={(sid, parshaNum) =>
        navigate(`/chumash?sefer=${sid}&parsha=${parshaNum}&aliyot=weekday&aliyah=reading`)
      }
    />

    {/* Reading schedule table */}
    <div
      className="mb-4 rounded-xl border border-border/50 overflow-hidden"
      style={{ background: "hsl(var(--card))" }}
    >
      <div className="px-4 py-2 border-b border-border/40">
        <span className="text-xs font-bold text-muted-foreground tracking-wider">לוח קריאות</span>
      </div>
      {KRIA_SCHEDULE.map((row, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center justify-between px-4 py-2.5 gap-2",
            i < KRIA_SCHEDULE.length - 1 && "border-b border-border/30"
          )}
          dir="rtl"
        >
          <div>
            <span
              className="font-semibold text-sm text-foreground"
              style={{ fontFamily: "'Noto Serif Hebrew', serif" }}
            >
              {row.days}
            </span>
            {row.note && (
              <span className="text-xs text-muted-foreground mr-1.5">— {row.note}</span>
            )}
          </div>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
            style={{ background: `${theme.accentColor}22`, color: theme.accentColor }}
          >
            {row.aliyot}
          </span>
        </div>
      ))}
    </div>

    {/* Blessings */}
    <div className="mt-2 space-y-1">
      {KRIA_BLESSINGS.map((sec, i) => (
        <SectionCard key={i} section={sec} initialOpen={i < 2} />
      ))}
    </div>
  </div>
  );
};
