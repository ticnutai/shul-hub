/**
 * Today in the Hebrew calendar, in Hebrew letters: "כ״ו תשרי תשפ״ז". Shared by
 * the home page and its preview in the admin.
 */
export function hebrewNumeral(value: number) {
  let remaining = value % 1000;
  const letters: string[] = [];
  const values: Array<[number, string]> = [
    [400, "ת"],
    [300, "ש"],
    [200, "ר"],
    [100, "ק"],
    [90, "צ"],
    [80, "פ"],
    [70, "ע"],
    [60, "ס"],
    [50, "נ"],
    [40, "מ"],
    [30, "ל"],
    [20, "כ"],
    [10, "י"],
    [9, "ט"],
    [8, "ח"],
    [7, "ז"],
    [6, "ו"],
    [5, "ה"],
    [4, "ד"],
    [3, "ג"],
    [2, "ב"],
    [1, "א"],
  ];

  for (const [amount, letter] of values.slice(0, 4)) {
    while (remaining >= amount) {
      letters.push(letter);
      remaining -= amount;
    }
  }
  if (remaining === 15 || remaining === 16) {
    letters.push("ט", remaining === 15 ? "ו" : "ז");
    remaining = 0;
  }
  for (const [amount, letter] of values.slice(4)) {
    while (remaining >= amount) {
      letters.push(letter);
      remaining -= amount;
    }
  }

  if (letters.length === 1) return `${letters[0]}׳`;
  return `${letters.slice(0, -1).join("")}״${letters.at(-1)}`;
}

export function formatHebrewDate(date: Date) {
  const parts = new Intl.DateTimeFormat("he-IL-u-ca-hebrew", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jerusalem",
  }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  return `${hebrewNumeral(Number(day))} ${month} ${hebrewNumeral(Number(year))}`;
}
