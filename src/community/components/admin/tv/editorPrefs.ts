/**
 * How the board editor looks to this gabbai - where the floating save bar
 * stands, the size of the galleries' tiles, how the sliders stand, the
 * editor's layout and its sizes - kept with the gabbai's account (the
 * display settings, synced to user_settings), not only in this browser: the
 * same on every computer the gabbai signs in on, and never back to the
 * defaults on the next visit.
 *
 * Each of them is kept in this browser under its own key, and says so with
 * an event of that name when it changes (writeStored, useViewChoice,
 * FloatingBar). This listens to those, writes them to the account, and, when
 * the account brings other values (from another computer), puts them here.
 */
import { useEffect, useRef } from "react";
import { useDisplayMode } from "@/contexts/DisplayModeContext";
import { BARE_KEY, BUTTONS_FOLDED_KEY, LAYOUT_KEY, SIDE_H_KEY, SIDE_KEY, TOP_KEY } from "./editorLayout";
import { EDITOR_NAV_KEY } from "./EditorNav";

export const EDITOR_PREF_KEYS = [
  "tv-save-bar-spot",
  "tv-tile-size",
  "tv-library-view",
  "tv-slider-layout",
  "tv-part-panel-pos",
  "tv-part-panel-size",
  EDITOR_NAV_KEY,
  LAYOUT_KEY,
  SIDE_KEY,
  TOP_KEY,
  SIDE_H_KEY,
  BARE_KEY,
  BUTTONS_FOLDED_KEY,
] as const;

type Prefs = Record<string, string>;

const readLocal = (): Prefs => {
  const out: Prefs = {};
  for (const k of EDITOR_PREF_KEYS) {
    try {
      const v = localStorage.getItem(k);
      if (v !== null) out[k] = v;
    } catch {
      /* storage unavailable: nothing to keep */
    }
  }
  return out;
};

/** Only strings under the keys known: whatever else an account holds is let go. */
export function readEditorPrefs(v: unknown): Prefs {
  if (!v || typeof v !== "object") return {};
  const out: Prefs = {};
  for (const k of EDITOR_PREF_KEYS) {
    const x = (v as Record<string, unknown>)[k];
    if (typeof x === "string" && x.length < 200) out[k] = x;
  }
  return out;
}

export function useEditorPrefsSync() {
  const { displaySettings, updateDisplaySettings } = useDisplayMode();
  const fromAccount = readEditorPrefs(displaySettings.editorPrefs);
  const account = useRef(fromAccount);
  account.current = fromAccount;
  const accountText = JSON.stringify(fromAccount);

  // The account → this browser (once read, and whenever another computer changed them): all of them written
  // first, and only then said aloud - while they are written, nothing is sent back half done.
  const applying = useRef(false);
  useEffect(() => {
    const changed: string[] = [];
    applying.current = true;
    for (const [k, v] of Object.entries(account.current)) {
      try {
        if (localStorage.getItem(k) === v) continue;
        localStorage.setItem(k, v);
        changed.push(k);
      } catch {
        /* storage unavailable */
      }
    }
    for (const k of changed) {
      window.dispatchEvent(new Event(`${k}:from-account`));
      window.dispatchEvent(new Event(k));
    }
    applying.current = false;
  }, [accountText]);

  // This browser → the account, whenever one of them changes here.
  useEffect(() => {
    const push = () => {
      if (applying.current) return;
      // What this browser holds now - one put back to its default (taken away here) is taken away there too.
      const next = readLocal();
      if (JSON.stringify(next) !== JSON.stringify(account.current)) updateDisplaySettings({ editorPrefs: next });
    };
    for (const k of EDITOR_PREF_KEYS) window.addEventListener(k, push);
    return () => {
      for (const k of EDITOR_PREF_KEYS) window.removeEventListener(k, push);
    };
  }, [updateDisplaySettings]);
}
