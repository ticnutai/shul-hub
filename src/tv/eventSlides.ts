/** How many built-in designs each special day has (EventSplash.tsx). */
export const BUILTIN_VARIANTS = 3;
/** Pictures a special day can have; they take turns on the board. */
export const MAX_EVENT_IMAGES = 8;

/** What takes turns on the day: the uploaded pictures, or the built-in designs. */
export function eventSlides(images: string[] | undefined): Array<{ image: string } | { variant: number }> {
  if (images && images.length) return images.map((image) => ({ image }));
  return Array.from({ length: BUILTIN_VARIANTS }, (_, variant) => ({ variant }));
}
