import { MAX_CUSTOM_BOXES, newCustomBoxId, type CustomBlockId, type Screen, type ScreenRow, type TvConfig } from "./config";
import { readOccasions } from "./occasions";

/**
 * Boxes the gabbai adds by hand (config.customBoxes): made, renamed and
 * rewritten, and taken off again - from the list, and from every place that
 * names them, so nothing is left pointing at a box that is gone.
 */

export function addCustomBox(c: TvConfig, title = "תיבה חדשה", id: CustomBlockId = newCustomBoxId()): { config: TvConfig; id: CustomBlockId } {
  if (c.customBoxes.length >= MAX_CUSTOM_BOXES) return { config: c, id };
  return { config: { ...c, customBoxes: [...c.customBoxes, { id, title, text: "" }] }, id };
}

export function editCustomBox(c: TvConfig, id: CustomBlockId, patch: { title?: string; text?: string }): TvConfig {
  return {
    ...c,
    customBoxes: c.customBoxes.map((b) =>
      b.id === id
        ? { ...b, ...(patch.title !== undefined ? { title: patch.title.slice(0, 60) } : {}), ...(patch.text !== undefined ? { text: patch.text.slice(0, 800) } : {}) }
        : b,
    ),
  };
}

const withoutRows = (grid: ScreenRow[] | undefined, id: string): ScreenRow[] | undefined => {
  if (!grid) return grid;
  const rows = grid
    .map((r) => {
      const keep = r.blocks.map((b, i) => [b, r.widths[i]] as const).filter(([b]) => b !== id);
      return { ...r, blocks: keep.map(([b]) => b), widths: keep.map(([, w]) => w) };
    })
    .filter((r) => r.blocks.length);
  return rows.length ? rows : undefined;
};

const withoutOnScreen = (s: Screen, id: string): Screen => {
  const grid = withoutRows(s.grid, id);
  const { grid: _old, ...rest } = s;
  return { ...rest, blocks: s.blocks.filter((b) => b.block !== id), ...(grid ? { grid } : {}) };
};

export function removeCustomBox(c: TvConfig, id: CustomBlockId): TvConfig {
  const frameLooks = { ...c.frameLooks };
  delete frameLooks[id];
  return {
    ...c,
    customBoxes: c.customBoxes.filter((b) => b.id !== id),
    screens: c.screens?.map((s) => withoutOnScreen(s, id)),
    layouts: c.layouts.map((l) => ({ ...l, grid: withoutRows(l.grid, id) ?? [] })).filter((l) => l.grid.length),
    occasions: readOccasions(c).map((o) => (o.screen ? { ...o, screen: withoutOnScreen(o.screen, id) } : o)),
    frameLooks,
  };
}
