// Convert numbers to Hebrew letters with proper geresh/gershayim
const ones = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
const tens = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
const hundreds = ["", "ק", "ר", "ש", "ת"];

export const toHebrewNumber = (num: number): string => {
  if (num === 0) return "";
  if (num > 999) return num.toString(); // Fallback for very large numbers

  let result = "";
  const h = Math.floor(num / 100);
  const t = Math.floor((num % 100) / 10);
  const o = num % 10;

  // Special cases for 15 and 16 (to avoid using God's name)
  if (num === 15) return "ט״ו";
  if (num === 16) return "ט״ז";

  // Hundreds
  if (h > 0) {
    // For 500-900, use ת multiple times
    if (h >= 5) {
      result += hundreds[4].repeat(Math.floor(h / 4));
      result += hundreds[h % 4];
    } else {
      result += hundreds[h];
    }
  }

  // Tens and ones (handle special cases)
  if (t === 1 && o === 5) {
    result += "ט״ו";
  } else if (t === 1 && o === 6) {
    result += "ט״ז";
  } else {
    result += tens[t] + ones[o];
  }

  // Add geresh or gershayim
  if (result.length === 1) {
    // Single letter - add geresh after
    result += "׳";
  } else if (result.length > 1) {
    // Multiple letters - add gershayim before last letter
    result = result.slice(0, -1) + "״" + result.slice(-1);
  }

  return result;
};
