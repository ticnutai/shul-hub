/**
 * The shapes a box or a frame of a board of parts can take - the same names
 * and silhouettes as the boxes of an ordinary board (תיבות in the editor), so
 * the two are one choice. Each is a path in a 100-unit square, stretched to
 * the part; the editor's tile draws the same path, so what is on the tile is
 * what lands on the board. The silhouettes follow the board's own clip paths
 * (TvShapes.tsx), set in by 2 units so a line around them is never cut.
 */
export const PART_SHAPES = [
  { id: 'rectangle', name: 'מלבן', path: 'M2 2H98V98H2Z' },
  { id: 'rounded', name: 'מעוגל', path: 'M12 2H88Q98 2 98 12V88Q98 98 88 98H12Q2 98 2 88V12Q2 2 12 2Z' },
  { id: 'pill', name: 'כמוסה', path: 'M26 2H74A24 48 0 0 1 74 98H26A24 48 0 0 1 26 2Z' },
  { id: 'bevel', name: 'קטום', path: 'M14 2H86L98 14V86L86 98H14L2 86V14Z' },
  { id: 'scoop', name: 'מגורע', path: 'M14 2H86A12 12 0 0 0 98 14V86A12 12 0 0 0 86 98H14A12 12 0 0 0 2 86V14A12 12 0 0 0 14 2Z' },
  { id: 'notch', name: 'מדורג', path: 'M14 2H86V14H98V86H86V98H14V86H2V14H14Z' },
  { id: 'arch', name: 'קשת', path: 'M2 98V38C2 -10 98 -10 98 38V98Z' },
  { id: 'dome', name: 'כיפה', path: 'M2 30.8C2 13.52 21.2 2 50 2C78.8 2 98 13.52 98 30.8L98 95.12Q98 98 95.12 98L4.88 98Q2 98 2 95.12Z' },
  { id: 'onion', name: 'כיפת בצל', path: 'M50 2C54.8 6.8 66.32 6.8 80.72 12.56C92.24 17.36 98 23.12 98 38.48L98 95.12Q98 98 95.12 98L4.88 98Q2 98 2 95.12L2 38.48C2 23.12 7.76 17.36 19.28 12.56C33.68 6.8 45.2 6.8 50 2Z' },
  { id: 'lancet', name: 'קשת מחודדת', path: 'M50 2C67.28 7.76 84.56 15.44 98 26.96L98 95.12Q98 98 95.12 98L4.88 98Q2 98 2 95.12L2 26.96C15.44 15.44 32.72 7.76 50 2Z' },
  { id: 'scallop', name: 'מסולסל', path: 'M2 6.8q6 -4.8 12 0q6 -4.8 12 0q6 -4.8 12 0q6 -4.8 12 0q6 -4.8 12 0q6 -4.8 12 0q6 -4.8 12 0q6 -4.8 12 0L98 93.2q-6 4.8 -12 0q-6 4.8 -12 0q-6 4.8 -12 0q-6 4.8 -12 0q-6 4.8 -12 0q-6 4.8 -12 0q-6 4.8 -12 0q-6 4.8 -12 0Z' },
  { id: 'ellipse', name: 'אליפסה', path: 'M2 50A48 48 0 1 0 98 50A48 48 0 1 0 2 50Z' },
  { id: 'circle', name: 'עיגול', path: 'M2 50A48 48 0 1 0 98 50A48 48 0 1 0 2 50Z' },
  { id: 'hexagon', name: 'משושה', path: 'M25 2H75L98 50L75 98H25L2 50Z' },
  { id: 'octagon', name: 'מתומן', path: 'M20 2H80L98 22V78L80 98H20L2 78V22Z' },
  { id: 'diamond', name: 'מעוין', path: 'M50 2L98 50L50 98L2 50Z' },
] as const;

export type PartShape = (typeof PART_SHAPES)[number]['id'];

export const PART_SHAPE_IDS: readonly PartShape[] = PART_SHAPES.map((s) => s.id);

export const isPartShape = (v: unknown): v is PartShape => typeof v === 'string' && (PART_SHAPE_IDS as readonly string[]).includes(v);

/** The path of a shape, in its 100-unit square. */
export const partShapePath = (shape: PartShape): string => PART_SHAPES.find((s) => s.id === shape)!.path;

/** The shapes a picture frame (straight edges) goes on; on any other the frame is a line that follows the shape. */
export const STRAIGHT_SHAPES: readonly PartShape[] = ["rectangle", "rounded"];

/**
 * The corners of a shape drawn of straight lines only (an octagon, a bevel, a
 * diamond...): where a picture frame's corner ornaments go. A shape with a
 * curve in it (an arch, a dome, an ellipse) has none.
 */
export function shapeCorners(shape: PartShape): Array<[number, number]> {
  const d = partShapePath(shape);
  if (/[^MLHVZ0-9.\s-]/.test(d)) return [];
  const out: Array<[number, number]> = [];
  let x = 0, y = 0;
  for (const [, cmd, args] of d.matchAll(/([MLHVZ])([^MLHVZ]*)/g)) {
    const n = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (cmd === "M" || cmd === "L") [x, y] = n;
    else if (cmd === "H") x = n[0];
    else if (cmd === "V") y = n[0];
    else continue;
    if (!out.some(([a, b]) => a === x && b === y)) out.push([x, y]);
  }
  return out;
}
