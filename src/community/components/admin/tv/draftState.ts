/**
 * The editor's draft: what is on the preview, what it started from, and the
 * undo history. Kept apart from the panel so it can be tested without it.
 */
import type { TvConfig } from "@/tv/config";
import { mergeConfig, sameJson } from "@/tv/configMerge";

export interface DraftState {
  past: TvConfig[];
  present: TvConfig;
  /**
   * The board as stored, the last time this editor read it. What differs
   * from it in `present` is what was changed here - and only that is saved,
   * and only that counts as unsaved. See src/tv/configMerge.ts.
   */
  base: TvConfig;
  future: TvConfig[];
  lastKey: string | null;
  lastAt: number;
  /** When the draft was last changed here or in another window (0 = as loaded). */
  editedAt: number;
}

export type DraftAction =
  | { type: "load"; config: TvConfig }
  /**
   * The stored board changed (a save elsewhere, a fix on the server). The
   * edits made here stay; everything else follows the server. Before this an
   * editor left open kept the old board in its draft, showed it as "unsaved
   * changes", and wrote it back on the next save.
   */
  | { type: "rebase"; config: TvConfig }
  | { type: "edit"; key: string; update: (c: TvConfig) => TvConfig }
  | { type: "undo" }
  | { type: "redo" }
  /** A newer draft from the other editor window (tvDraftChannel). */
  | { type: "adopt"; config: TvConfig; editedAt: number };

const COALESCE_MS = 800;

export function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case "load":
      return {
        past: [],
        present: action.config,
        base: action.config,
        future: [],
        lastKey: null,
        lastAt: 0,
        editedAt: 0,
      };
    case "rebase": {
      if (sameJson(action.config, state.base)) return state;
      const present = sameJson(state.present, state.base)
        ? action.config
        : mergeConfig(state.base, state.present, action.config);
      return { ...state, present, base: action.config };
    }
    case "adopt":
      if (JSON.stringify(action.config) === JSON.stringify(state.present))
        return { ...state, editedAt: action.editedAt };
      return {
        base: state.base,
        past: [...state.past.slice(-60), state.present],
        present: action.config,
        future: [],
        lastKey: null,
        lastAt: 0,
        editedAt: action.editedAt,
      };
    case "edit": {
      const next = action.update(state.present);
      if (JSON.stringify(next) === JSON.stringify(state.present)) return state;
      const now = Date.now();
      const coalesce = action.key === state.lastKey && now - state.lastAt < COALESCE_MS;
      return {
        base: state.base,
        past: coalesce ? state.past : [...state.past.slice(-60), state.present],
        present: next,
        future: [],
        lastKey: action.key,
        lastAt: now,
        editedAt: now,
      };
    }
    case "undo": {
      if (!state.past.length) return state;
      const previous = state.past[state.past.length - 1];
      return {
        base: state.base,
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
        lastKey: null,
        lastAt: 0,
        editedAt: Date.now(),
      };
    }
    case "redo": {
      if (!state.future.length) return state;
      const [next, ...rest] = state.future;
      return {
        base: state.base,
        past: [...state.past, state.present],
        present: next,
        future: rest,
        lastKey: null,
        lastAt: 0,
        editedAt: Date.now(),
      };
    }
  }
}

