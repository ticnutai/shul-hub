import type { CSSProperties, ReactNode } from "react";
import type { FrameShape, TvConfig } from "@/tv/config";

/**
 * The picture tables the editor chooses from: the board's style, and the
 * shape of its corners.
 *
 * They live here, and not in the panel, because the inspector offers the same
 * two when the board's background is selected - and the panel already imports
 * the inspector.
 */

export const SKIN_CHOICES: Array<{
  id: TvConfig["skin"];
  name: string;
  hint: string;
  preview: ReactNode;
}> = [
  {
    id: "plain",
    name: "נקי",
    hint: "בלי מסגרות - הצבעים של הערכה בלבד",
    preview: (
      <span className="flex h-full w-full gap-1 p-1.5">
        <i className="flex-1 rounded-sm bg-white/10" />
        <i className="flex-1 rounded-sm bg-white/10" />
      </span>
    ),
  },
  {
    id: "gold",
    name: "מסגרת זהב",
    hint: "מסגרות זהב עם עיטורי פינות, כמו לוח מודפס",
    preview: (
      <span className="flex h-full w-full gap-1 p-1.5">
        <i className="flex-1 rounded-sm border-2 border-[#f0c35c] bg-white/5" />
        <i className="flex-1 rounded-sm border-2 border-[#f0c35c] bg-white/5" />
      </span>
    ),
  },
  {
    id: "tablets",
    name: "לוחות אבן",
    hint: "לוחות מקושתים על קלף, עם מסגרת זהב",
    preview: (
      <span className="flex h-full w-full items-end gap-1 p-1.5">
        <i className="h-[85%] flex-1 rounded-t-full border-2 border-[#b98f3a] bg-[#f3e7cd]" />
        <i className="h-[85%] flex-1 rounded-t-full border-2 border-[#b98f3a] bg-[#f3e7cd]" />
      </span>
    ),
  },
  {
    id: "parchment",
    name: "קלף",
    hint: "יריעות קלף עם מסגרת כפולה",
    preview: (
      <span className="flex h-full w-full gap-1 p-1.5">
        <i className="flex-1 rounded-sm border-2 border-[#8a6a3a] bg-[#fbf3df] shadow-[inset_0_0_0_2px_#c8a668]" />
        <i className="flex-1 rounded-sm border-2 border-[#8a6a3a] bg-[#fbf3df] shadow-[inset_0_0_0_2px_#c8a668]" />
      </span>
    ),
  },
  {
    id: "pillars",
    name: "עמודי שיש",
    hint: "רקע שיש, עמודי זהב בצדדים ולוחות מקושתים",
    preview: (
      <span className="flex h-full w-full items-stretch gap-1 bg-[#efe7d8] p-1">
        <i className="w-1 rounded-sm bg-gradient-to-b from-[#f6e3a8] to-[#b8912f]" />
        <i className="flex-1 rounded-t-full border border-[#c9a227] bg-[#12233f]" />
        <i className="flex-1 rounded-t-full border border-[#c9a227] bg-[#12233f]" />
        <i className="w-1 rounded-sm bg-gradient-to-b from-[#f6e3a8] to-[#b8912f]" />
      </span>
    ),
  },
  {
    id: "curtain",
    name: "פרוכת",
    hint: "וילון קטיפה בראש הלוח ושלטי זהב לכותרות",
    preview: (
      <span className="block h-full w-full">
        <i className="block h-1/4 w-full bg-[repeating-linear-gradient(90deg,#5c0d1c_0_3px,#8a1a30_3px_6px)]" />
        <span className="flex h-3/4 gap-1 p-1">
          <i className="flex-1 rounded-sm border border-[#c9a227] bg-[#2a0d12]" />
          <i className="flex-1 rounded-sm border border-[#c9a227] bg-[#2a0d12]" />
        </span>
      </span>
    ),
  },
  {
    id: "sky",
    name: "תכלת",
    hint: "רקע שמיים בהיר ולוחות קרם - מתאים לאולם מואר",
    preview: (
      <span className="flex h-full w-full gap-1 bg-gradient-to-b from-[#bfe0f5] to-[#f2f8fc] p-1.5">
        <i className="flex-1 rounded-sm border border-[#c9a227] bg-[#fffdf7]" />
        <i className="flex-1 rounded-sm border border-[#c9a227] bg-[#fffdf7]" />
      </span>
    ),
  },
  {
    id: "wood",
    name: "עץ אגוז",
    hint: "לוחות עץ כהה עם מסגרות ושלטי זהב",
    preview: (
      <span className="flex h-full w-full gap-1 bg-[#3e2312] p-1.5">
        <i className="flex-1 rounded-sm border border-[#c9a227] bg-[#5b3419]" />
        <i className="flex-1 rounded-sm border border-[#c9a227] bg-[#5b3419]" />
      </span>
    ),
  },
  {
    id: "velvet",
    name: "קטיפה מלכותית",
    hint: "לוחות עמוקים עם קו זהב עדין",
    preview: (
      <span className="flex h-full w-full gap-1 p-1.5">
        <i className="flex-1 rounded-md border border-[#f0c35c]/70 bg-black/45" />
        <i className="flex-1 rounded-md border border-[#f0c35c]/70 bg-black/45" />
      </span>
    ),
  },
  {
    id: "arch",
    name: "היכל שיש",
    hint: "שיש בהיר, עמודי זהב מגולפים ולוחות מקושתים עם כותרת בשלט",
    preview: (
      <span className="flex h-full w-full items-stretch gap-1 bg-[linear-gradient(120deg,#efe7d8,#f9f5ec,#e7dcc7)] p-1">
        <i className="w-[3px] rounded-sm bg-gradient-to-b from-[#f6e3a8] via-[#d9b45a] to-[#b8912f]" />
        <i className="flex-1 rounded-t-[999px_28px] border border-[#c9a227] bg-[#122a4a]" />
        <i className="flex-1 rounded-t-[999px_28px] border border-[#c9a227] bg-[#122a4a]" />
        <i className="w-[3px] rounded-sm bg-gradient-to-b from-[#f6e3a8] via-[#d9b45a] to-[#b8912f]" />
      </span>
    ),
  },
  {
    id: "hall",
    name: "אולם קטיפה",
    hint: "פרוכת קטיפה בראש הלוח, לוחות עץ וכותרות על סרט זהב",
    preview: (
      <span className="block h-full w-full bg-[#3a2010]">
        <i className="block h-[22%] w-full bg-[repeating-linear-gradient(90deg,#5c0d1c_0_3px,#8a1a30_3px_6px)]" />
        <span className="flex h-[78%] gap-1 p-1">
          <i className="flex-1 rounded-sm border border-[#c9a227] bg-[#5b3419]" />
          <i className="flex-1 rounded-sm border border-[#c9a227] bg-[#5b3419]" />
        </span>
      </span>
    ),
  },
  {
    id: "heichal",
    name: "היכל עמודים",
    hint: "עמודי זהב עומדים בין הלוחות, קורה למעלה ולמטה ושם על מדליון שחור",
    preview: (
      <span className="flex h-full w-full items-stretch gap-[2px] bg-[#2a1408] p-1">
        <i className="flex-1 rounded-[2px] border border-[#c9a227] bg-[#fdf8ea]" />
        <i className="w-[3px] shrink-0 rounded-[1px] bg-gradient-to-b from-[#f6e3a8] via-[#d9b45a] to-[#8a6a1a]" />
        <i className="flex-1 rounded-[2px] border border-[#c9a227] bg-[#fdf8ea]" />
        <i className="w-[3px] shrink-0 rounded-[1px] bg-gradient-to-b from-[#f6e3a8] via-[#d9b45a] to-[#8a6a1a]" />
        <i className="flex-1 rounded-[2px] border border-[#c9a227] bg-[#fdf8ea]" />
      </span>
    ),
  },
  {
    id: "dome",
    name: "כיפות זהב",
    hint: "כל לוח הוא כיפה מחודדת עם מסגרת זהב, על רקע כחול לילה",
    preview: (
      <span className="flex h-full w-full items-end gap-1 bg-[#0d2245] p-1.5">
        <i className="h-[88%] flex-1 rounded-t-[50%_38%] border border-[#e8d49a] bg-[#14325c]" />
        <i className="h-[88%] flex-1 rounded-t-[50%_38%] border border-[#e8d49a] bg-[#14325c]" />
      </span>
    ),
  },
  {
    id: "stone",
    name: "אבני ירושלים",
    hint: "קיר אבן גזית עם גומחות מקושתות חצובות בו",
    preview: (
      <span className="flex h-full w-full items-end gap-1 bg-[repeating-linear-gradient(0deg,#c3b79c_0_1px,#eae1ca_1px_9px)] p-1.5">
        <i className="h-[85%] flex-1 rounded-t-[50%_30%] border border-[#8d7e64] bg-[#f3ecda]" />
        <i className="h-[85%] flex-1 rounded-t-[50%_30%] border border-[#8d7e64] bg-[#f3ecda]" />
      </span>
    ),
  },
  {
    id: "printed",
    name: "דפוס",
    hint: "פינות ישרות, מסגרת ברונזה דקה, בלי צללים — כמו לוח שנתלה מודפס",
    preview: (
      <span className="flex h-full w-full gap-1 bg-[#071321] p-1.5">
        <i className="flex-1 border border-[#765a29] bg-[#0d1c2d]" />
        <i className="flex-1 border border-[#765a29] bg-[#0d1c2d]" />
      </span>
    ),
  },
  {
    id: "medallion",
    name: "מדליונים",
    hint: "לוחות בקצוות מסולסלים, כותרת על מגן ושעון עגול",
    preview: (
      <span className="flex h-full w-full gap-1 bg-[linear-gradient(160deg,#f4ece0,#e2d3bb)] p-1.5">
        <i className="flex-1 rounded-[40%_40%_40%_40%/22%_22%_22%_22%] border-2 border-[#c9a227] bg-[#fffdf6]" />
        <i className="flex-1 rounded-[40%_40%_40%_40%/22%_22%_22%_22%] border-2 border-[#c9a227] bg-[#fffdf6]" />
      </span>
    ),
  },
  {
    id: "crown",
    name: "שיש מוזהב",
    hint: "שיש קרם, מסגרות חבל מעוגלות ושם הלוח במדליון",
    preview: (
      <span className="block h-full w-full bg-[linear-gradient(140deg,#f7f1e3,#fffaf0,#efe5d0)] p-1">
        <i className="mx-auto mb-1 block h-[26%] w-[62%] rounded-[999px] border border-[#c9a227] bg-[#fffaf0]" />
        <span className="flex h-[58%] gap-1">
          <i className="flex-1 rounded-xl border border-[#c9a227] bg-[#fffdf7]" />
          <i className="flex-1 rounded-xl border border-[#c9a227] bg-[#fffdf7]" />
        </span>
      </span>
    ),
  },
];

/**
 * The corner shapes offered in "מסגרות". The little preview is the shape
 * itself, drawn with the same CSS the board uses, so what is on the button
 * is what lands on the panels.
 */
export const FRAME_CHOICES: Array<{ id: FrameShape; name: string; hint: string; css: CSSProperties }> = [
  {
    id: "auto",
    name: "לפי הסגנון",
    hint: "כל סגנון שומר על הצורה שלו - קשת נשארת קשת, כיפה נשארת כיפה",
    css: { borderRadius: "10px 10px 4px 4px / 14px 14px 4px 4px" },
  },
  { id: "round", name: "מעוגל", hint: "פינה עגולה רגילה", css: { borderRadius: "12px" } },
  {
    id: "squircle",
    name: "רך",
    hint: "פינה רכה, כמו אייקון של אפליקציה",
    css: { borderRadius: "14px", cornerShape: "superellipse(2)" } as CSSProperties,
  },
  {
    id: "bevel",
    name: "קטום",
    hint: "פינה חתוכה בקו ישר, כמו אבן מסותתת",
    css: { borderRadius: "14px", cornerShape: "bevel" } as CSSProperties,
  },
  {
    id: "scoop",
    name: "מגורע",
    hint: "פינה שנחתכת פנימה בקשת",
    css: { borderRadius: "14px", cornerShape: "scoop" } as CSSProperties,
  },
  {
    id: "notch",
    name: "מדורג",
    hint: "פינה בצורת מדרגה",
    css: { borderRadius: "14px", cornerShape: "notch" } as CSSProperties,
  },
];
