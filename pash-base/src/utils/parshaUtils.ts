import { HebrewCalendar, HDate, ParshaEvent, Event } from '@hebcal/core';
import { getLeyningForParshaHaShavua } from '@hebcal/leyning';

// Mapping between Hebrew parsha names and our internal parsha IDs
const PARSHA_NAME_TO_ID: Record<string, { sefer: number; parshaId: number }> = {
  // Bereishit
  'Bereshit': { sefer: 1, parshaId: 1 },
  'Noach': { sefer: 1, parshaId: 2 },
  'Lech-Lecha': { sefer: 1, parshaId: 3 },
  'Vayera': { sefer: 1, parshaId: 4 },
  'Chayei Sara': { sefer: 1, parshaId: 5 },
  'Toldot': { sefer: 1, parshaId: 6 },
  'Vayetzei': { sefer: 1, parshaId: 7 },
  'Vayishlach': { sefer: 1, parshaId: 8 },
  'Vayeshev': { sefer: 1, parshaId: 9 },
  'Miketz': { sefer: 1, parshaId: 10 },
  'Vayigash': { sefer: 1, parshaId: 11 },
  'Vayechi': { sefer: 1, parshaId: 12 },
  
  // Shemot
  'Shemot': { sefer: 2, parshaId: 13 },
  'Vaera': { sefer: 2, parshaId: 14 },
  'Bo': { sefer: 2, parshaId: 15 },
  'Beshalach': { sefer: 2, parshaId: 16 },
  'Yitro': { sefer: 2, parshaId: 17 },
  'Mishpatim': { sefer: 2, parshaId: 18 },
  'Terumah': { sefer: 2, parshaId: 19 },
  'Tetzaveh': { sefer: 2, parshaId: 20 },
  'Ki Tisa': { sefer: 2, parshaId: 21 },
  'Vayakhel': { sefer: 2, parshaId: 22 },
  'Pekudei': { sefer: 2, parshaId: 23 },
  
  // Vayikra
  'Vayikra': { sefer: 3, parshaId: 24 },
  'Tzav': { sefer: 3, parshaId: 25 },
  'Shmini': { sefer: 3, parshaId: 26 },
  'Tazria': { sefer: 3, parshaId: 27 },
  'Metzora': { sefer: 3, parshaId: 28 },
  'Achrei Mot': { sefer: 3, parshaId: 29 },
  'Kedoshim': { sefer: 3, parshaId: 30 },
  'Emor': { sefer: 3, parshaId: 31 },
  'Behar': { sefer: 3, parshaId: 32 },
  'Bechukotai': { sefer: 3, parshaId: 33 },
  
  // Bamidbar
  'Bamidbar': { sefer: 4, parshaId: 34 },
  'Nasso': { sefer: 4, parshaId: 35 },
  "Beha'alotcha": { sefer: 4, parshaId: 36 },
  "Sh'lach": { sefer: 4, parshaId: 37 },
  'Korach': { sefer: 4, parshaId: 38 },
  'Chukat': { sefer: 4, parshaId: 39 },
  'Balak': { sefer: 4, parshaId: 40 },
  'Pinchas': { sefer: 4, parshaId: 41 },
  'Matot': { sefer: 4, parshaId: 42 },
  'Masei': { sefer: 4, parshaId: 43 },
  
  // Devarim
  'Devarim': { sefer: 5, parshaId: 44 },
  'Vaetchanan': { sefer: 5, parshaId: 45 },
  'Eikev': { sefer: 5, parshaId: 46 },
  "Re'eh": { sefer: 5, parshaId: 47 },
  'Shoftim': { sefer: 5, parshaId: 48 },
  'Ki Teitzei': { sefer: 5, parshaId: 49 },
  'Ki Tavo': { sefer: 5, parshaId: 50 },
  'Nitzavim': { sefer: 5, parshaId: 51 },
  'Vayeilech': { sefer: 5, parshaId: 52 },
  'Haazinu': { sefer: 5, parshaId: 53 },
  "Vezot Habracha": { sefer: 5, parshaId: 54 },
};

// Handle combined parshiyot (double parshiyot)
const COMBINED_PARSHIYOT: Record<string, { sefer: number; parshaId: number }> = {
  'Vayakhel-Pekudei': { sefer: 2, parshaId: 22 },
  'Tazria-Metzora': { sefer: 3, parshaId: 27 },
  'Achrei Mot-Kedoshim': { sefer: 3, parshaId: 29 },
  'Behar-Bechukotai': { sefer: 3, parshaId: 32 },
  'Chukat-Balak': { sefer: 4, parshaId: 39 },
  'Matot-Masei': { sefer: 4, parshaId: 42 },
  'Nitzavim-Vayeilech': { sefer: 5, parshaId: 51 },
};

export interface WeeklyParsha {
  sefer: number;
  parshaId: number;
  hebrewName: string;
  englishName: string;
  hebrewDate: string;
}

/**
 * Get the current week's Torah portion (parsha)
 * @param il - Whether to use Israel calendar (true) or Diaspora (false)
 * @returns The weekly parsha information or null if not found
 */
export function getCurrentWeeklyParsha(il: boolean = true): WeeklyParsha | null {
  try {
    const today = new Date();
    const hdate = new HDate(today);
    
    // Get the upcoming Shabbat (or current day if it's Shabbat)
    const dayOfWeek = hdate.getDay();
    const saturday = dayOfWeek === 6 ? hdate : hdate.onOrAfter(6);
    
    // Get events for that Shabbat
    const events = HebrewCalendar.calendar({
      start: saturday.greg(),
      end: saturday.greg(),
      sedrot: true,
      il,
    });
    
    // Find the parsha event
    const parshaEvent = events.find((ev: Event) => 
      ev instanceof ParshaEvent
    ) as ParshaEvent | undefined;
    
    if (!parshaEvent) {
      console.warn('No parsha found for current week');
      return null;
    }
    
    const parshaNameRaw = parshaEvent.render('en');
    const hebrewName = parshaEvent.render('he');
    
    // Hebcal sometimes prefixes with "Parashat ", normalize it to match our mapping keys
    const parshaName = parshaNameRaw.replace(/^Parashat\s+/, "");
    
    // Check if it's a combined parsha first
    let parshaInfo = COMBINED_PARSHIYOT[parshaName];
    
    // If not, check regular parshiyot
    if (!parshaInfo) {
      parshaInfo = PARSHA_NAME_TO_ID[parshaName];
    }
    
    if (!parshaInfo) {
      console.error(`Parsha "${parshaName}" not found in mapping. Available parshiyot:`, Object.keys(PARSHA_NAME_TO_ID));
      return null;
    }
    
    const result = {
      sefer: parshaInfo.sefer,
      parshaId: parshaInfo.parshaId,
      hebrewName,
      englishName: parshaName,
      hebrewDate: hdate.toString(),
    };
    return result;
  } catch (error) {
    console.error('Error getting current weekly parsha:', error);
    return null;
  }
}

/**
 * Check if we should load the weekly parsha automatically
 * Returns true if no saved state exists or if the weekly parsha has changed
 */
export function shouldLoadWeeklyParsha(): boolean {
  try {
    const savedState = localStorage.getItem('lastReadingState');
    if (!savedState) return true;
    
    const state = JSON.parse(savedState);
    const lastTimestamp = state.timestamp;
    const lastParshaId = state.selectedParsha;
    
    if (!lastTimestamp) return true;
    
    // Get the current week's parsha
    const isIsrael = getCalendarPreference();
    const currentParsha = getCurrentWeeklyParsha(isIsrael);
    
    if (!currentParsha) return false; // No parsha this week (e.g., during holidays)
    
    // Check if the parsha has changed
    if (lastParshaId !== currentParsha.parshaId) {
      return true;
    }
    
    // Also check if more than 7 days have passed (weekly reset as backup)
    const daysSinceLastVisit = (Date.now() - lastTimestamp) / (1000 * 60 * 60 * 24);
    if (daysSinceLastVisit >= 7) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking if should load weekly parsha:', error);
    return true;
  }
}

/**
 * Get the user's preference for Israel or Diaspora calendar
 * @returns true for Israel, false for Diaspora (default: true)
 */
export function getCalendarPreference(): boolean {
  try {
    const preference = localStorage.getItem('calendarPreference');
    if (preference === null) return true; // Default: Israel
    return preference === 'israel';
  } catch (error) {
    console.error('Error getting calendar preference:', error);
    return true;
  }
}

/**
 * Set the user's preference for Israel or Diaspora calendar
 * @param isIsrael - true for Israel, false for Diaspora
 */
export function setCalendarPreference(isIsrael: boolean): void {
  try {
    localStorage.setItem('calendarPreference', isIsrael ? 'israel' : 'diaspora');
  } catch (error) {
    console.error('Error setting calendar preference:', error);
  }
}

/* ─── Weekday (Mon/Thu) leyning ────────────────────────── */

export interface AliyahRef {
  /** English book name from hebcal (Genesis, Exodus, …) */
  book: string;
  /** Hebrew book name */
  bookHe: string;
  /** Start "perek:pasuk" */
  begin: string;
  /** End "perek:pasuk" */
  end: string;
  /** Number of verses */
  verses: number;
}

export interface WeekdayLeyning {
  /** Hebrew parsha name, e.g. "פרשת אמור" */
  parshaHe: string;
  /** English parsha name */
  parshaEn: string;
  /** The 3 aliyot read on Mon/Thu */
  aliyot: AliyahRef[];
  /** Sefer id (1-5) for navigation */
  seferId: number;
  /** Opening perek (for linking into the app) */
  openPerek: number;
}

const EN_BOOK_TO_HE: Record<string, string> = {
  Genesis:      "בראשית",
  Exodus:       "שמות",
  Leviticus:    "ויקרא",
  Numbers:      "במדבר",
  Deuteronomy:  "דברים",
};

const EN_BOOK_TO_SEFER: Record<string, number> = {
  Genesis: 1, Exodus: 2, Leviticus: 3, Numbers: 4, Deuteronomy: 5,
};

/**
 * Returns the 3-aliyah Monday/Thursday reading for the current week's parsha.
 * Returns null if cannot be determined (e.g. Shabbat with no sedra).
 */
export function getWeekdayLeyning(il?: boolean): WeekdayLeyning | null {
  try {
    const useIl = il ?? getCalendarPreference();
    const hdate = new HDate(new Date());
    const dayOfWeek = hdate.getDay();
    const shabbat = dayOfWeek === 6 ? hdate : hdate.onOrAfter(6);

    const events = HebrewCalendar.calendar({
      start: shabbat.greg(),
      end: shabbat.greg(),
      sedrot: true,
      il: useIl,
    });

    const parshaEvent = events.find((ev: Event) => ev instanceof ParshaEvent) as ParshaEvent | undefined;
    if (!parshaEvent) return null;

    const leyning = getLeyningForParshaHaShavua(parshaEvent, useIl);
    if (!leyning?.fullkriyah) return null;

    const aliyot: AliyahRef[] = (['1', '2', '3'] as const).map(k => {
      const a = leyning.fullkriyah[k];
      if (!a) return null;
      return {
        book:   a.k,
        bookHe: EN_BOOK_TO_HE[a.k] ?? a.k,
        begin:  a.b,
        end:    a.e,
        verses: a.v ?? 0,
      } as AliyahRef;
    }).filter(Boolean) as AliyahRef[];

    if (!aliyot.length) return null;

    const firstAliyah = aliyot[0];
    const perek = Number(firstAliyah.begin.split(':')[0]);

    return {
      parshaHe: parshaEvent.render('he').replace(/^פָּרָשַׁת\s*/, 'פרשת '),
      parshaEn: parshaEvent.render('en').replace(/^Parashat\s+/, ''),
      aliyot,
      seferId: EN_BOOK_TO_SEFER[firstAliyah.book] ?? 1,
      openPerek: perek,
    };
  } catch {
    return null;
  }
}

