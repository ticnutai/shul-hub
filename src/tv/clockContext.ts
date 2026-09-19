import { createContext } from "react";

/**
 * The per-second time, for the clock only. The dashboard panels are memoised
 * on the minute; reading the seconds from context re-renders just the clock
 * (a weak TV CPU should not redraw every panel every second).
 */
export const ClockContext = createContext<Date>(new Date(0));
