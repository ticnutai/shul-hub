import { createContext } from "react";

/** Filters existing sections without creating a second editor or a second draft. */
export const OrganizedSectionContext = createContext<string | null>(null);