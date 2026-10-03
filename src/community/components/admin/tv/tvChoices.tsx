import type { CSSProperties, ReactNode } from "react";
import type { BoardFrame, FrameShape, TitleStyle } from "@/tv/config";

/**
 * The picture tables the editor chooses from: a frame for the whole board, the
 * way a box's name is set, and the shape of the boxes.
 *
 * They live here, and not in the panel, because the inspector offers the same
 * two when the board's background is selected - and the panel already imports
 * the inspector.
 */

/** A frame for the whole board (config.BOARD_FRAMES), with a little picture of it. */
export const BOARD_FRAME_CHOICES: Array<{ id: BoardFrame | null; name: string; hint: string; preview: ReactNode }> = [
  {
    id: null,
    name: "בלי",
    hint: "בלי מסגרת ללוח",
    preview: (
      <span className="flex h-full w-full gap-1 p-1.5">
        <i className="flex-1 rounded-sm bg-white/15" />
        <i className="flex-1 rounded-sm bg-white/15" />
      </span>
    ),
  },
  {
    id: "columns",
    name: "עמודי זהב",
    hint: "שני עמודי זהב בצדי הלוח, עם כותרת ובסיס",
    preview: (
      <span className="flex h-full w-full gap-1 p-1">
        <i className="w-[10%] rounded-[2px] bg-[linear-gradient(90deg,#8a6a1a,#f6e3a8,#c9a227)]" />
        <i className="flex-1 rounded-sm bg-white/15" />
        <i className="flex-1 rounded-sm bg-white/15" />
        <i className="w-[10%] rounded-[2px] bg-[linear-gradient(90deg,#8a6a1a,#f6e3a8,#c9a227)]" />
      </span>
    ),
  },
  {
    id: "beams",
    name: "קורות זהב",
    hint: "קורת זהב מעל הלוח ומתחתיו",
    preview: (
      <span className="flex h-full w-full flex-col gap-1 p-1">
        <i className="h-[12%] bg-[linear-gradient(#f6e3a8,#c9a227)]" />
        <span className="flex flex-1 gap-1">
          <i className="flex-1 rounded-sm bg-white/15" />
          <i className="flex-1 rounded-sm bg-white/15" />
        </span>
        <i className="h-[12%] bg-[linear-gradient(#c9a227,#f6e3a8)]" />
      </span>
    ),
  },
  {
    id: "heichal",
    name: "היכל",
    hint: "עמודי זהב בצדדים וקורות מעל ומתחת",
    preview: (
      <span className="flex h-full w-full flex-col gap-0.5 p-1">
        <i className="h-[10%] bg-[linear-gradient(#f6e3a8,#c9a227)]" />
        <span className="flex flex-1 gap-1">
          <i className="w-[10%] bg-[linear-gradient(90deg,#8a6a1a,#f6e3a8,#c9a227)]" />
          <i className="flex-1 rounded-sm bg-white/15" />
          <i className="w-[10%] bg-[linear-gradient(90deg,#8a6a1a,#f6e3a8,#c9a227)]" />
        </span>
        <i className="h-[10%] bg-[linear-gradient(#c9a227,#f6e3a8)]" />
      </span>
    ),
  },
  {
    id: "parochet",
    name: "פרוכת",
    hint: "פרוכת קטיפה תלויה מעל הלוח, על מוט זהב ועם גדילים",
    preview: (
      <span className="flex h-full w-full flex-col">
        <i className="h-[8%] bg-[#d9b45a]" />
        <i className="h-[24%] rounded-b-[40%] bg-[repeating-linear-gradient(90deg,#5c0d1c_0_4px,#8a1a30_4px_8px)]" />
        <span className="flex flex-1 gap-1 p-1">
          <i className="flex-1 rounded-sm bg-white/15" />
          <i className="flex-1 rounded-sm bg-white/15" />
        </span>
      </span>
    ),
  },
  {
    id: "curtain",
    name: "וילונות",
    hint: "וילונות קטיפה אסופים בשני צדי הלוח",
    preview: (
      <span className="flex h-full w-full gap-1">
        <i className="w-[14%] bg-[repeating-linear-gradient(90deg,#5c0d1c_0_3px,#8a1a30_3px_6px)] [clip-path:polygon(0_0,100%_0,55%_62%,100%_100%,0_100%)]" />
        <span className="flex flex-1 gap-1 py-1">
          <i className="flex-1 rounded-sm bg-white/15" />
          <i className="flex-1 rounded-sm bg-white/15" />
        </span>
        <i className="w-[14%] bg-[repeating-linear-gradient(90deg,#5c0d1c_0_3px,#8a1a30_3px_6px)] [clip-path:polygon(0_0,100%_0,100%_100%,0_100%,45%_62%)]" />
      </span>
    ),
  },
  {
    id: "carved",
    name: "מסגרת מגולפת",
    hint: "מסגרת זהב מגולפת סביב כל המסך",
    preview: (
      <span className="flex h-full w-full gap-1 border-[3px] border-double border-[#c9a227] p-1">
        <i className="flex-1 rounded-sm bg-white/15" />
        <i className="flex-1 rounded-sm bg-white/15" />
      </span>
    ),
  },
  {
    id: "double-line",
    name: "קו כפול",
    hint: "שני קווים סביב המסך, בצבע ההדגשה",
    preview: (
      <span className="flex h-full w-full p-0.5">
        <span className="flex flex-1 gap-1 border-2 border-[#f0c35c] p-0.5">
          <span className="flex flex-1 gap-1 border border-[#f0c35c]/70 p-0.5">
            <i className="flex-1 rounded-sm bg-white/15" />
            <i className="flex-1 rounded-sm bg-white/15" />
          </span>
        </span>
      </span>
    ),
  },
];

/** How a box's name is set (config.TITLE_STYLES), each drawn on its own button. */
const GOLD = "bg-[linear-gradient(180deg,#fdf3d0,#f0c35c_62%,#a8842c)] text-[#2a1a06]";
export const TITLE_STYLE_CHOICES: Array<{ id: TitleStyle; name: string; preview: ReactNode }> = [
  { id: "plain", name: "רגיל", preview: <span className="font-bold text-[#f0c35c]">שחרית</span> },
  {
    id: "ribbon",
    name: "סרט",
    preview: (
      <span className={`block px-3 py-0.5 font-bold ${GOLD} [clip-path:polygon(0_0,100%_0,calc(100%-6px)_50%,100%_100%,0_100%,6px_50%)]`}>
        שחרית
      </span>
    ),
  },
  { id: "pill", name: "כמוסה", preview: <span className={`rounded-full border border-[#8a6a1a] px-2.5 font-bold ${GOLD}`}>שחרית</span> },
  {
    id: "plate",
    name: "לוחית זהב",
    preview: <span className={`rounded border border-[#8a6a1a] px-2.5 font-bold shadow-[0_2px_4px_rgba(0,0,0,0.5)] ${GOLD}`}>שחרית</span>,
  },
  { id: "underline", name: "קו תחתון", preview: <span className="border-b-2 border-[#f0c35c]/70 font-bold text-[#f0c35c]">שחרית</span> },
  {
    id: "shield",
    name: "מגן",
    preview: (
      <span className={`block px-2.5 pb-2 pt-0.5 font-bold ${GOLD} [clip-path:polygon(0_0,100%_0,100%_55%,50%_100%,0_55%)]`}>
        שחרית
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
  { id: "auto", name: "רגיל", hint: "הפינות המעוגלות הרגילות של התיבה", css: { borderRadius: "8px" } },
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
  {
    id: "arch",
    name: "קשת",
    hint: "ראש מקושת כמו לוחות הברית, והתחתית לפי העיגול למטה",
    css: { borderRadius: "50% 50% 4px 4px / 45% 45% 4px 4px" },
  },
  { id: "pill", name: "כמוסה", hint: "קצוות עגולים לגמרי, כמו גלולה", css: { borderRadius: "999px" } },
  { id: "ellipse", name: "אליפסה", hint: "תיבה עגולה; הטקסט נכנס פנימה מהשוליים", css: { borderRadius: "50%" } },
  {
    id: "hexagon",
    name: "משושה",
    hint: "שש צלעות; הקו מסביב עוקב אחרי הצורה",
    css: { clipPath: "polygon(14% 0, 86% 0, 100% 50%, 86% 100%, 14% 100%, 0 50%)", borderRadius: 0 },
  },
  {
    id: "octagon",
    name: "מתומן",
    hint: "שמונה צלעות - פינות חתוכות; הקו מסביב עוקב אחרי הצורה",
    css: { clipPath: "polygon(18% 0, 82% 0, 100% 22%, 100% 78%, 82% 100%, 18% 100%, 0 78%, 0 22%)", borderRadius: 0 },
  },
  // Silhouettes (TvShapes.tsx), drawn with the board's own clip paths.
  { id: "dome", name: "כיפה", hint: "ראש מעוגל כמו כיפה; הקו מסביב עוקב אחרי הצורה", css: { clipPath: "url(#tv-shape-dome)", borderRadius: 0 } },
  { id: "onion", name: "כיפת בצל", hint: "כתפיים מתעגלות ונפגשות בחוד", css: { clipPath: "url(#tv-shape-onion)", borderRadius: 0 } },
  { id: "lancet", name: "קשת מחודדת", hint: "קשת מחודדת, כמו מעל פתח בית מדרש ישן", css: { clipPath: "url(#tv-shape-lancet)", borderRadius: 0 } },
  { id: "scallop", name: "מסולסל", hint: "קצוות מסולסלים למעלה ולמטה", css: { clipPath: "url(#tv-shape-scallop)", borderRadius: 0 } },
];
