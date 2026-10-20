/**
 * How the gabbai's area is laid out: the tabs, as it always was; tiles - a
 * screen of big buttons, each opening the next step in the whole frame
 * (מניינים → יום חול → שחרית → the list), with a path back at the top; a
 * side menu of the sections in groups; a row of menus, one to a group; or a
 * search - "מה לנהל?" - with what was opened lately (AdminNav.tsx).
 *
 * All are the same screens: the tiles only choose what the tabs and their
 * inner rows of tabs choose, by the same address (?tab=, ?cat=, ?prayer=,
 * ?tvTab=, ?panel=). Kept with the gabbai's display settings, apart on the
 * phone and on the computer; until chosen, tiles on a phone and tabs on a
 * computer, where the tabs reach everything at once.
 */
import { useCallback } from "react";
import { useDisplayMode } from "@/contexts/DisplayModeContext";

export type AdminLayout = "tabs" | "tiles" | "side" | "menus" | "search";

/** Every layout, in the order the chooser offers them. */
export const ADMIN_LAYOUTS: AdminLayout[] = ["tabs", "tiles", "side", "menus", "search"];

export function readAdminLayout(value: unknown, narrow: boolean): AdminLayout {
  return ADMIN_LAYOUTS.includes(value as AdminLayout) ? (value as AdminLayout) : narrow ? "tiles" : "tabs";
}

export function useAdminLayout() {
  const { displaySettings, updateDisplaySettings } = useDisplayMode();
  const narrow = typeof window !== "undefined" && window.innerWidth < 640;
  const layout = readAdminLayout(displaySettings.adminLayout, narrow);
  const setLayout = useCallback((next: AdminLayout) => updateDisplaySettings({ adminLayout: next }), [updateDisplaySettings]);
  return { layout, setLayout };
}
