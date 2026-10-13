/**
 * The design tab's topics (kits, background, boxes, frames, text, parts) and
 * how they are shown: one at a time, a click swapping it for another
 * ("switch", the default), or all of them down the page, a click scrolling
 * to it ("scroll"). The choice is the gabbai's, kept on this device.
 *
 * Kept outside React, so a button anywhere in the editor ("עריכה בחלקים",
 * "לתקן את הטקסט") can open a topic with showDesignTopic.
 */
import { useSyncExternalStore } from "react";

export const DESIGN_TOPICS = [
  { id: "design-sets", label: "ערכות" },
  { id: "design-background", label: "רקע" },
  { id: "design-boxes", label: "תיבות" },
  { id: "design-frames", label: "מסגרות" },
  { id: "design-text", label: "טקסט" },
  { id: "design-elements", label: "חלקים" },
] as const;

export type DesignTopicId = (typeof DESIGN_TOPICS)[number]["id"];
export type DesignView = "switch" | "scroll";

const VIEW_KEY = "tv-design-view";

const readView = (): DesignView => {
  try {
    return localStorage.getItem(VIEW_KEY) === "scroll" ? "scroll" : "switch";
  } catch {
    return "switch";
  }
};

let state: { view: DesignView; topic: DesignTopicId } = { view: readView(), topic: "design-sets" };
const listeners = new Set<() => void>();
const set = (next: Partial<typeof state>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};

export const isDesignTopic = (id: string): id is DesignTopicId => DESIGN_TOPICS.some((t) => t.id === id);

export function useDesignTopics() {
  const current = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
  return {
    ...current,
    setTopic: (topic: DesignTopicId) => set({ topic }),
    setView: (view: DesignView) => {
      try {
        localStorage.setItem(VIEW_KEY, view);
      } catch {
        /* a private window: the choice lasts this visit */
      }
      set({ view });
    },
  };
}

/**
 * Opens a topic and brings it into sight - after the tab has drawn (the
 * caller may just have switched to the design tab). Instant: a smooth scroll
 * does not run while the window is in the background.
 */
export function showDesignTopic(id: DesignTopicId) {
  set({ topic: id });
  window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 80);
}
