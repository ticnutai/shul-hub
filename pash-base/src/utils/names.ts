/** Parse a pasuk ID string like "1-2-3" into sefer/perek/pasuk numbers */
export const parsePasukId = (pasukId: string): { sefer: number; perek: number; pasuk: number } | null => {
  const parts = pasukId.split('-');
  if (parts.length < 3) return null;
  const sefer = parseInt(parts[0], 10);
  const perek = parseInt(parts[1], 10);
  const pasuk = parseInt(parts[2], 10);
  if (isNaN(sefer) || isNaN(perek) || isNaN(pasuk)) return null;
  return { sefer, perek, pasuk };
};

export const normalizeMefareshName = (name?: string): string => {
  if (!name) return "";
  let n = name.trim();

  // Common misspellings and variants
  const fixes: Array<[RegExp, string]> = [
    [/אבן\s?עזרה/g, "אבן עזרא"], // fix heh->aleph
    [/אִבְּן\s?עֶזְרָה/g, "אבן עזרא"], // niqqud variant
    [/Ibn\s?Ezra/gi, "אבן עזרא"],
  ];

  for (const [re, to] of fixes) {
    n = n.replace(re, to);
  }

  return n;
};
