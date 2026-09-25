import type { SpecialDayDef } from "@community/lib/specialDays";

/** How many plain built-in designs every special day has (EventSplash.tsx). */
export const BUILTIN_VARIANTS = 3;
/** Pictures a special day can have; they take turns on the board. */
export const MAX_EVENT_IMAGES = 8;

/** The built-in styles by id: the plain designs, then the full scenes (eventScenes.tsx). */
export const STYLE_NAMES: Record<number, string> = {
  0: "זוהר",
  1: "מסגרת זהב",
  2: "לילה",
  3: "סוכה מקושטת",
  4: "סוכה בלילה",
  5: "ארבעת המינים",
};

/** The built-in styles a day can use, the richest first. */
export function stylesFor(def: Pick<SpecialDayDef, "key" | "group">): number[] {
  const plain = [0, 1, 2];
  if (def.group === "sukkot" && def.key !== "shmini_atzeret") return [3, 4, 5, ...plain];
  return plain;
}

/**
 * What takes turns on the day: the uploaded pictures, then the built-in
 * styles the gabbai picked. When he has not picked any, a day with pictures
 * shows only them and a day without shows all its styles; a day never ends
 * up with nothing.
 */
export function eventSlides(
  images: string[] | undefined,
  available: number[] = [0, 1, 2],
  chosen?: number[],
): Array<{ image: string } | { variant: number }> {
  const pictures = (images ?? []).map((image) => ({ image }));
  const picked = chosen?.filter((v) => available.includes(v));
  const styles = picked && (picked.length || pictures.length) ? picked : pictures.length ? [] : available;
  return [...pictures, ...styles.map((variant) => ({ variant }))];
}
