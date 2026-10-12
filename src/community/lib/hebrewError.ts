/**
 * An error, said to the gabbai in Hebrew.
 *
 * What the server sends back is in English ("new row violates row-level
 * security policy", "Failed to fetch"), and it was put on the screen as it
 * came - to somebody who reads Hebrew only. A message of the site's own
 * (already Hebrew) is kept; a known server one is said in plain words; any
 * other gets the action's own Hebrew message. The original goes to the
 * console, for whoever looks into it.
 */
const HEBREW = /[֐-׿]/;

const KNOWN: [RegExp, string][] = [
  [/failed to fetch|network|load failed|timeout|timed out/i, "אין חיבור לשרת. בדקו את החיבור לאינטרנט ונסו שוב."],
  [/jwt|expired|not authenticated|invalid.*token|session/i, "ההתחברות פגה. התחברו מחדש ונסו שוב."],
  [/row-level security|permission|not allowed|forbidden|unauthori[sz]ed|42501/i, "אין הרשאה לפעולה הזו."],
  [/duplicate key|already exists|unique/i, "כבר קיים פריט כזה."],
  [/foreign key|violates.*constraint|still referenced/i, "אי אפשר, כי פריט אחר עדיין קשור לזה."],
  [/payload too large|too large|413/i, "הקובץ גדול מדי."],
];

export function hebrewError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "";
  if (message && HEBREW.test(message)) return message;
  if (message) console.warn("[שגיאה]", message);
  const known = KNOWN.find(([re]) => re.test(message));
  return known ? `${fallback}: ${known[1]}` : fallback;
}
