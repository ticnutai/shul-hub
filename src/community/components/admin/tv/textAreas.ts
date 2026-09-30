import { FAMILY_PREFIX } from "@/tv/boardEdit";

/**
 * The areas of text on the board that can be styled one by one in
 * "טקסט · אזור על הלוח". The "כל ..." ones are style families
 * (boardEdit.STYLE_FAMILIES), so one rule holds for every row.
 */
export const TEXT_AREAS: Array<{ key: string; label: string }> = [
  { key: "header.title", label: "שם בית הכנסת" },
  { key: "header.clock", label: "השעון" },
  { key: "header.date", label: "התאריך" },
  { key: "header.weekday", label: "היום בשבוע" },
  { key: "panel.minyanim", label: "כותרת המניינים" },
  { key: "panel.zmanim", label: "כותרת זמני היום" },
  { key: `${FAMILY_PREFIX}minyan`, label: "כל שורות המניינים" },
  { key: `${FAMILY_PREFIX}minyan:label`, label: "כל שמות המניינים" },
  { key: `${FAMILY_PREFIX}zman`, label: "כל שורות זמני היום" },
  { key: `${FAMILY_PREFIX}ann:title`, label: "כותרות המודעות" },
  { key: `${FAMILY_PREFIX}ann:body`, label: "גוף המודעות" },
  { key: `${FAMILY_PREFIX}shiur`, label: "שורות השיעורים" },
  { key: "ticker", label: "הסרגל הרץ" },
];
