import { createContext, useContext } from "react";
import { HOLY_END_MINUTES } from "@community/lib/specialDays";

/**
 * The synagogue's Shabbat-end minutes, for the parts of the board that list
 * times but are handed only the zmanim (a panel, a painted board's frame).
 * TvBoard sets it once from the config, which TvApp fills from the
 * synagogue's settings - so "צאת השבת והחג" reads the same everywhere.
 */
export const HolyEndMinutesContext = createContext<number>(HOLY_END_MINUTES);

export const useHolyEndMinutes = () => useContext(HolyEndMinutesContext);
