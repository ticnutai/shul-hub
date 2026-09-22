/**
 * Where the synagogue is, and what that does to its times.
 *
 * Every zman on the board comes from two coordinates and two customs, and
 * until now those were four numbers an admin had to type. "קו רוחב 32.0853"
 * is not something anybody knows about their own shul, and a digit wrong in
 * the fourth place is a mistake nobody can see - the board keeps showing
 * times, they are simply somebody else's.
 *
 * So a place is chosen by name and the numbers follow.
 *
 * Two things differ between towns, and both matter:
 *
 *   Where the sun is. Bnei Brak and Jerusalem are 35 km apart and their
 *   sunsets differ by about two minutes - enough that מנחה 10 דקות לפני
 *   השקיעה is at the wrong time if the board is set to the wrong one.
 *
 *   When candles are lit. This is a custom and not a calculation:
 *   Jerusalem lights 40 minutes before sunset, Haifa 30, and most of the
 *   country 20. It is the difference the gabbai notices first, because it
 *   is printed on every luach in the building.
 *
 * The minutes below are the widely published customs, and they are a
 * starting point, not a ruling: communities differ, and the field stays
 * editable. A shul whose luach says otherwise should follow its luach.
 *
 * Israel only, deliberately. The whole system formats times in
 * Asia/Jerusalem (zmanim.ts, minyan-time.ts and four other places), so a
 * synagogue abroad would be shown its own sunset at Israeli clock time -
 * which is worse than not offering the choice. Adding places abroad means
 * carrying a timezone through all of it first.
 *
 * Elevation is carried but does not change the calculation. Most luachot in
 * Israel compute sunset at sea level for the town's coordinates, and a
 * board that quietly disagreed with the luach on the wall beside it would
 * be a problem, not a feature.
 */

export interface Place {
  /** As it is said, which is how it will be searched for. */
  name: string;
  /** Other names and spellings people actually type. */
  aka?: string[];
  latitude: number;
  longitude: number;
  /** Metres. Stored for later; see the note above. */
  elevation: number;
  /** Minutes before sunset, by the published local custom. */
  candle: number;
}

/**
 * Sorted roughly by size, so the list opens on the places most shuls are
 * in rather than alphabetically on a village.
 */
export const PLACES: Place[] = [
  { name: "ירושלים", latitude: 31.7683, longitude: 35.2137, elevation: 754, candle: 40 },
  { name: "בני ברק", latitude: 32.0807, longitude: 34.8338, elevation: 35, candle: 20 },
  { name: "תל אביב–יפו", aka: ["תל אביב", "יפו"], latitude: 32.0853, longitude: 34.7818, elevation: 5, candle: 20 },
  { name: "חיפה", latitude: 32.794, longitude: 34.9896, elevation: 300, candle: 30 },
  { name: "אשדוד", latitude: 31.8014, longitude: 34.6435, elevation: 50, candle: 20 },
  { name: "פתח תקווה", latitude: 32.0878, longitude: 34.8878, elevation: 40, candle: 20 },
  { name: "ראשון לציון", latitude: 31.973, longitude: 34.8066, elevation: 60, candle: 20 },
  { name: "נתניה", latitude: 32.3215, longitude: 34.8532, elevation: 30, candle: 20 },
  { name: "באר שבע", latitude: 31.253, longitude: 34.7915, elevation: 260, candle: 20 },
  { name: "מודיעין עילית", aka: ["קרית ספר", "ברכפלד"], latitude: 31.93, longitude: 35.04, elevation: 300, candle: 20 },
  { name: "בית שמש", aka: ["רמת בית שמש"], latitude: 31.75, longitude: 34.9886, elevation: 300, candle: 20 },
  { name: "ביתר עילית", latitude: 31.695, longitude: 35.12, elevation: 800, candle: 30 },
  { name: "אלעד", latitude: 32.052, longitude: 34.95, elevation: 150, candle: 20 },
  { name: "רמת גן", latitude: 32.0684, longitude: 34.8248, elevation: 50, candle: 20 },
  { name: "גבעתיים", latitude: 32.0723, longitude: 34.8104, elevation: 60, candle: 20 },
  { name: "חולון", latitude: 32.0167, longitude: 34.7792, elevation: 30, candle: 20 },
  { name: "בת ים", latitude: 32.0171, longitude: 34.7457, elevation: 15, candle: 20 },
  { name: "רחובות", latitude: 31.8928, longitude: 34.8113, elevation: 76, candle: 20 },
  { name: "אשקלון", latitude: 31.6688, longitude: 34.5743, elevation: 60, candle: 20 },
  { name: "כפר סבא", latitude: 32.175, longitude: 34.907, elevation: 60, candle: 20 },
  { name: "הרצליה", latitude: 32.1656, longitude: 34.8436, elevation: 40, candle: 20 },
  { name: "רעננה", latitude: 32.1848, longitude: 34.8713, elevation: 70, candle: 20 },
  { name: "לוד", latitude: 31.9515, longitude: 34.8951, elevation: 55, candle: 20 },
  { name: "רמלה", latitude: 31.9288, longitude: 34.8667, elevation: 80, candle: 20 },
  { name: "יבנה", latitude: 31.8781, longitude: 34.7392, elevation: 40, candle: 20 },
  { name: "נס ציונה", latitude: 31.9293, longitude: 34.7989, elevation: 50, candle: 20 },
  { name: "אור יהודה", latitude: 32.03, longitude: 34.85, elevation: 30, candle: 20 },
  { name: "קרית גת", latitude: 31.61, longitude: 34.7642, elevation: 130, candle: 20 },
  { name: "חדרה", latitude: 32.434, longitude: 34.9196, elevation: 30, candle: 20 },
  { name: "צפת", latitude: 32.9646, longitude: 35.496, elevation: 900, candle: 30 },
  { name: "טבריה", latitude: 32.7922, longitude: 35.5312, elevation: -200, candle: 30 },
  { name: "עפולה", latitude: 32.6078, longitude: 35.2897, elevation: 60, candle: 20 },
  { name: "נוף הגליל", aka: ["נצרת עילית"], latitude: 32.7, longitude: 35.3167, elevation: 400, candle: 20 },
  { name: "קרית שמונה", latitude: 33.2072, longitude: 35.5695, elevation: 150, candle: 20 },
  { name: "מעלה אדומים", latitude: 31.7772, longitude: 35.2975, elevation: 700, candle: 40 },
  { name: "אריאל", latitude: 32.1058, longitude: 35.1739, elevation: 600, candle: 20 },
  { name: "עמנואל", latitude: 32.16, longitude: 35.13, elevation: 400, candle: 20 },
  { name: "רכסים", latitude: 32.74, longitude: 35.11, elevation: 200, candle: 30 },
  { name: "ערד", latitude: 31.2589, longitude: 35.2137, elevation: 600, candle: 20 },
  { name: "דימונה", latitude: 31.0686, longitude: 35.0333, elevation: 570, candle: 20 },
  { name: "אילת", latitude: 29.5577, longitude: 34.9519, elevation: 12, candle: 20 },
];

/**
 * Normalises for searching.
 *
 * Geresh and quotes are dropped, because they live inside words. A hyphen
 * of any kind becomes a space instead of vanishing: "תל-אביב" has to find
 * "תל אביב–יפו", and deleting the dash would glue it into "תלאביב" and
 * match nothing.
 */
const fold = (s: string) =>
  s
    .replace(/["'׳״]/g, "")
    .replace(/[-־–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function searchPlaces(query: string, limit = 8): Place[] {
  const q = fold(query);
  if (!q) return PLACES.slice(0, limit);
  const hit = (p: Place) => [p.name, ...(p.aka ?? [])].some((n) => fold(n).includes(q));
  return PLACES.filter(hit).slice(0, limit);
}

/**
 * The place a set of coordinates is, if it is one we know.
 *
 * Within about a kilometre, because a shul is not at the exact point the
 * table calls the middle of its town - and a board set up by hand years ago
 * should still recognise itself.
 */
export function placeAt(latitude: number, longitude: number): Place | null {
  let best: { p: Place; d: number } | null = null;
  for (const p of PLACES) {
    // Good enough over a few km: a degree of latitude is ~111 km, and a
    // degree of longitude at this latitude is ~94 km.
    const dy = (p.latitude - latitude) * 111;
    const dx = (p.longitude - longitude) * 94;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (!best || d < best.d) best = { p, d };
  }
  return best && best.d <= 1.2 ? best.p : null;
}
