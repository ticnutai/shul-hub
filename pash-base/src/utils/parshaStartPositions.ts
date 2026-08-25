/**
 * Maps parsha_id → the actual Torah starting position (perek + pasuk).
 *
 * Some parshiot begin mid-chapter. The data files include the full opening
 * chapter from pasuk 1 (for context), so we need this map to know where the
 * parasha ACTUALLY starts when showing the parasha view.
 *
 * Where a parasha begins at perek X pasuk 1, no override is needed, but every
 * parasha is listed here for completeness.
 */
export const PARSHA_START: Record<number, { perek: number; pasuk: number }> = {
  // ─── בראשית ───
  1:  { perek: 1,  pasuk: 1  }, // בראשית
  2:  { perek: 6,  pasuk: 9  }, // נח
  3:  { perek: 12, pasuk: 1  }, // לך לך
  4:  { perek: 18, pasuk: 1  }, // וירא
  5:  { perek: 23, pasuk: 1  }, // חיי שרה
  6:  { perek: 25, pasuk: 19 }, // תולדות
  7:  { perek: 28, pasuk: 10 }, // ויצא
  8:  { perek: 32, pasuk: 4  }, // וישלח
  9:  { perek: 37, pasuk: 1  }, // וישב
  10: { perek: 41, pasuk: 1  }, // מקץ
  11: { perek: 44, pasuk: 18 }, // ויגש
  12: { perek: 47, pasuk: 28 }, // ויחי

  // ─── שמות ───
  13: { perek: 1,  pasuk: 1  }, // שמות
  14: { perek: 6,  pasuk: 2  }, // וארא
  15: { perek: 10, pasuk: 1  }, // בא
  16: { perek: 13, pasuk: 17 }, // בשלח
  17: { perek: 18, pasuk: 1  }, // יתרו
  18: { perek: 21, pasuk: 1  }, // משפטים
  19: { perek: 25, pasuk: 1  }, // תרומה
  20: { perek: 27, pasuk: 20 }, // תצוה
  21: { perek: 30, pasuk: 11 }, // כי תשא
  22: { perek: 35, pasuk: 1  }, // ויקהל
  23: { perek: 38, pasuk: 21 }, // פקודי

  // ─── ויקרא ───
  24: { perek: 1,  pasuk: 1  }, // ויקרא
  25: { perek: 6,  pasuk: 1  }, // צו
  26: { perek: 9,  pasuk: 1  }, // שמיני
  27: { perek: 12, pasuk: 1  }, // תזריע
  28: { perek: 14, pasuk: 1  }, // מצורע
  29: { perek: 16, pasuk: 1  }, // אחרי מות
  30: { perek: 19, pasuk: 1  }, // קדושים
  31: { perek: 21, pasuk: 1  }, // אמור
  32: { perek: 25, pasuk: 1  }, // בהר
  33: { perek: 26, pasuk: 3  }, // בחוקותי

  // ─── במדבר ───
  34: { perek: 1,  pasuk: 1  }, // במדבר
  35: { perek: 4,  pasuk: 21 }, // נשא
  36: { perek: 8,  pasuk: 1  }, // בהעלותך
  37: { perek: 13, pasuk: 1  }, // שלח לך
  38: { perek: 16, pasuk: 1  }, // קרח
  39: { perek: 19, pasuk: 1  }, // חוקת
  40: { perek: 22, pasuk: 2  }, // בלק
  41: { perek: 25, pasuk: 10 }, // פינחס
  42: { perek: 30, pasuk: 2  }, // מטות
  43: { perek: 33, pasuk: 1  }, // מסעי

  // ─── דברים ───
  44: { perek: 1,  pasuk: 1  }, // דברים
  45: { perek: 3,  pasuk: 23 }, // ואתחנן
  46: { perek: 7,  pasuk: 12 }, // עקב
  47: { perek: 11, pasuk: 26 }, // ראה
  48: { perek: 16, pasuk: 18 }, // שופטים
  49: { perek: 21, pasuk: 10 }, // כי תצא
  50: { perek: 26, pasuk: 1  }, // כי תבוא
  51: { perek: 29, pasuk: 9  }, // נצבים
  52: { perek: 31, pasuk: 1  }, // וילך
  53: { perek: 32, pasuk: 1  }, // האזינו
  54: { perek: 33, pasuk: 1  }, // וזאת הברכה
};
