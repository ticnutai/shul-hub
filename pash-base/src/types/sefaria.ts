// Types for Sefaria commentaries integration

export interface SefariaCommentary {
  mefaresh: string;        // Hebrew name: "רש\"י"
  mefareshEn: string;      // English name: "Rashi"
  text: string;            // Commentary text in Hebrew
  id: number;              // Unique ID
}

export interface SefariaPerek {
  [pasukNum: string]: SefariaCommentary[];
}

export interface SefariaData {
  [perekNum: string]: SefariaPerek;
}

// Mapping of internal book names to Sefaria names
export const SEFARIA_BOOK_NAMES: Record<string, string> = {
  bereishit: "Genesis",
  shemot: "Exodus",
  vayikra: "Leviticus",
  bamidbar: "Numbers",
  devarim: "Deuteronomy"
};

/**
 * Commentary category for UI grouping
 */
export type CommentaryCategory = "classic" | "targum" | "additional";

/**
 * Single source of truth for all available commentaries.
 * Every mefaresh in the system is defined here once.
 */
export interface CommentaryInfo {
  hebrew: string;
  english: string;
  category: CommentaryCategory;
}

export const AVAILABLE_COMMENTARIES: CommentaryInfo[] = [
  // Classic mefarshim
  { hebrew: "רש\"י", english: "Rashi", category: "classic" },
  { hebrew: "רמב\"ן", english: "Ramban", category: "classic" },
  { hebrew: "אבן עזרא", english: "Ibn_Ezra", category: "classic" },
  { hebrew: "ספורנו", english: "Sforno", category: "classic" },
  { hebrew: "אור החיים", english: "Or_HaChaim", category: "classic" },
  { hebrew: "כלי יקר", english: "Kli_Yakar", category: "classic" },
  { hebrew: "רשב\"ם", english: "Rashbam", category: "classic" },
  { hebrew: "חזקוני", english: "Chizkuni", category: "classic" },
  { hebrew: "בעל הטורים", english: "Baal_HaTurim", category: "classic" },
  // Targum
  { hebrew: "תרגום אונקלוס", english: "Onkelos", category: "targum" },
  // Additional mefarshim
  { hebrew: "מלבי\"ם", english: "Malbim", category: "additional" },
  { hebrew: "אלשיך", english: "Alshich", category: "additional" },
  { hebrew: "העמק דבר", english: "HaEmek_Davar", category: "additional" },
  { hebrew: "דעת זקנים", english: "Daat_Zkenim", category: "additional" },
  { hebrew: "מצודת דוד", english: "Metzudat_David", category: "additional" },
  { hebrew: "ביאור הגר\"א", english: "Beur_HaGra", category: "additional" },
];

/**
 * Derived mapping: Hebrew → English (generated from AVAILABLE_COMMENTARIES)
 */
export const MEFARESH_MAPPING: Record<string, string> = Object.fromEntries(
  AVAILABLE_COMMENTARIES.map(c => [c.hebrew, c.english])
);

/**
 * Derived reverse mapping: English → Hebrew
 */
export const MEFARESH_REVERSE_MAPPING: Record<string, string> = Object.fromEntries(
  AVAILABLE_COMMENTARIES.map(c => [c.english, c.hebrew])
);

/**
 * Get all Hebrew names as array (for filters etc.)
 */
export const ALL_MEFARSHIM_HEBREW = AVAILABLE_COMMENTARIES.map(c => c.hebrew);

/**
 * Get commentaries by category
 */
export const getCommentariesByCategory = (category: CommentaryCategory): CommentaryInfo[] =>
  AVAILABLE_COMMENTARIES.filter(c => c.category === category);
