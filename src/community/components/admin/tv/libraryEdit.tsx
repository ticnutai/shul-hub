/**
 * The library's order (folders, places, tags, favourites) is not a board's
 * look: it is the gabbai's, the same on every board they edit (useTvLibrary),
 * or until they have one the board's own - never an occasion's look, a page's
 * or one kind of screen's. The editor's design tab gives it here, read and
 * written; outside it (a test of one panel) the panel's own board is used.
 */
import { createContext, useContext } from "react";
import type { TvConfig } from "@/tv/config";
import { EMPTY_LIBRARY, type Library } from "@/tv/library";

export type LibraryEdit = (key: string, change: (l: Library) => Library) => void;

export const LibraryContext = createContext<{ library: Library; edit: LibraryEdit } | null>(null);

export function useLibraryEdit(onEdit: (key: string, update: (c: TvConfig) => TvConfig) => void): LibraryEdit {
  return useContext(LibraryContext)?.edit ?? ((key, change) => onEdit(key, (c) => ({ ...c, library: change(c.library ?? EMPTY_LIBRARY) })));
}

/** The library's order as shown: the gabbai's, or the board's. */
export function useLibraryOf(config: TvConfig): Library {
  return useContext(LibraryContext)?.library ?? config.library ?? EMPTY_LIBRARY;
}
