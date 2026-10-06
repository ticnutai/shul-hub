import type { SavedElementSet } from "./elements";
import { ORIGINAL_LAYER_DESIGNS } from "./originalLayerDesigns";
import { EMERALD_COMPOSITION } from "./emeraldComposition";

/**
 * The parts of the ready designs, each ready to put on any board: the marble
 * columns of "שיש מואר", the crown and candlesticks of "ספיר מלכותי", the
 * emerald column. A part carries its own cut (the mask that separates it from
 * the painting), so it comes alone - no wall around it - and is moved, sized,
 * hidden or deleted like anything one draws oneself. Pairs come grouped.
 */
const layered = (key: "ivory" | "sapphire") =>
  ORIGINAL_LAYER_DESIGNS.find((d) => d.id === (key === "ivory" ? "d_ivorylayers" : "d_sapphirelayers"))!.values.elements!;

function pick(name: string, from: SavedElementSet["elements"], ids: string[], group?: string): SavedElementSet | null {
  const parts = ids.map((id) => from.find((e) => e.id === id)).filter((e): e is NonNullable<typeof e> => !!e);
  if (parts.length !== ids.length) return null;
  const id = `ready_${ids[0].replace(/[^\w-]/g, "")}`;
  return { id, name, elements: parts.map((e) => ({ ...structuredClone(e), group: group ?? null, locked: false, hidden: false })) };
}

const ivory = layered("ivory");
const sapphire = layered("sapphire");
const emerald = EMERALD_COMPOSITION.values.elements!;

export const READY_PARTS: SavedElementSet[] = [
  pick("שיש מואר · זוג עמודים", ivory, ["original_ivory_column_left", "original_ivory_column_right"], "ready_ivory_columns"),
  pick("שיש מואר · קשת עליונה", ivory, ["original_ivory_crown"]),
  pick("שיש מואר · מסגרת שעון", ivory, ["original_ivory_clock_rim", "original_ivory_clock_fill"], "ready_ivory_clock"),
  pick("שיש מואר · פמוטים ספר וענף", ivory, ["original_ivory_still"]),
  pick("שיש מואר · מסגרת כותרת", ivory, ["original_ivory_title_frame"]),
  pick("שיש מואר · בסיס תחתון", ivory, ["original_ivory_base"]),
  pick("ספיר מלכותי · זוג עמודי זהב", sapphire, ["original_sapphire_column_left", "original_sapphire_column_right"], "ready_sapphire_columns"),
  pick("ספיר מלכותי · עמודים פנימיים", sapphire, ["original_sapphire_innerleft", "original_sapphire_innerright"], "ready_sapphire_inner"),
  pick("ספיר מלכותי · כתר ווילונות", sapphire, ["original_sapphire_crown"]),
  pick("ספיר מלכותי · מסגרת שעון", sapphire, ["original_sapphire_clock_rim", "original_sapphire_clock_fill"], "ready_sapphire_clock"),
  pick("ספיר מלכותי · פמוטים ספר וענף", sapphire, ["original_sapphire_still"]),
  pick("ספיר מלכותי · בסיס תחתון", sapphire, ["original_sapphire_base"]),
  pick("אמרלד · זוג עמודים", emerald, ["emerald_left", "emerald_right"], "ready_emerald_columns"),
].filter((s): s is SavedElementSet => s !== null);
