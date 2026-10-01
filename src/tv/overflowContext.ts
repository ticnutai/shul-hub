import { createContext, useContext } from "react";

import type { TvConfig } from "./config";

/** The board's choice for content that does not fit its frame; drawn by AutoScroll.tsx. */
export interface OverflowSettings {
  mode: TvConfig["overflow"]["mode"];
  speed: TvConfig["overflow"]["speed"];
  /** Stands still - in the editor while editing, so a row can be clicked. */
  still: boolean;
}

export const OverflowContext = createContext<OverflowSettings>({ mode: "off", speed: "slow", still: false });

/** Whether the board scrolls what does not fit, rather than leaving it out. */
export function useScrolls(): boolean {
  return useContext(OverflowContext).mode !== "off";
}

/** The blocks that are lists, and so can scroll: the rest fill their frame. */
export const SCROLLING_BLOCKS: readonly string[] = ["prayers", "zmanim", "announcements", "shiurim"];
