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

// Alias for backward compatibility
export const toHebrewNumeral = toHebrewNumber;

// Convert Hebrew number back to regular number (for sorting/filtering)
export const fromHebrewNumber = (hebrew: string): number => {
  if (!hebrew) return 0;
  
  // Remove geresh and gershayim marks
  const cleaned = hebrew.replace(/[׳״]/g, '');
  
  // Special cases
  if (cleaned === "טו") return 15;
  if (cleaned === "טז") return 16;
  
  let result = 0;
  
  // Map of Hebrew letters to values
  const letterValues: Record<string, number> = {
    'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
    'י': 10, 'כ': 20, 'ל': 30, 'מ': 40, 'נ': 50, 'ס': 60, 'ע': 70, 'פ': 80, 'צ': 90,
    'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400
  };
  
  // Sum up all letter values
  for (const char of cleaned) {
    result += letterValues[char] || 0;
  }
  
  return result;
};
