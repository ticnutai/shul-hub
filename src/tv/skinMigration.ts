/**
 * A board saved with one of the old designed frames ("skins"), read as parts.
 *
 * A skin dressed the whole board at once: the boxes' shape, their frame, the
 * way their names were set and what stood around the board. Those are parts
 * of their own now (config.ts: BOARD_FRAMES, TITLE_STYLES, the box shapes,
 * framePictures.ts), so a skin is read as the parts it was made of - each of
 * them only where the board has not already chosen that part itself - and
 * then forgotten. Runs on the stored object, before it is normalised, for the
 * board, each screen's overlay and each saved design.
 */

interface SkinParts {
  boardFrame?: string;
  titleStyle?: string;
  shape?: string;
  /** A frame picture, as FrameStyle.image holds it. */
  image?: string;
}

const SKIN_PARTS: Record<string, SkinParts> = {
  gold: { image: "frame:carved-gold" },
  tablets: { shape: "arch", image: "frame:rosette-corners" },
  parchment: { image: "frame:double-gold" },
  velvet: { image: "frame:double-gold" },
  pillars: { boardFrame: "columns", shape: "arch" },
  curtain: { boardFrame: "parochet", titleStyle: "ribbon" },
  sky: {},
  wood: { titleStyle: "ribbon" },
  arch: { boardFrame: "columns", shape: "arch", titleStyle: "pill" },
  hall: { boardFrame: "curtain", titleStyle: "ribbon", image: "frame:rope" },
  crown: { titleStyle: "pill", image: "frame:rope" },
  heichal: { boardFrame: "heichal", titleStyle: "plate", image: "frame:fan-corners" },
  dome: { shape: "onion", titleStyle: "pill" },
  stone: { shape: "dome" },
  medallion: { shape: "scallop", titleStyle: "shield" },
  printed: { titleStyle: "underline" },
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** One layer (the board, an overlay, a design's values): its skin as parts. */
function layerToParts(layer: Record<string, unknown>): Record<string, unknown> {
  if (!("skin" in layer)) return layer;
  const { skin, ...rest } = layer;
  const parts = typeof skin === "string" ? SKIN_PARTS[skin] : undefined;
  if (!parts) return rest;
  const out: Record<string, unknown> = { ...rest };
  if (parts.boardFrame && out.boardFrame == null) out.boardFrame = parts.boardFrame;
  if (parts.titleStyle && (out.titleStyle == null || out.titleStyle === "plain")) out.titleStyle = parts.titleStyle;
  if (parts.shape) {
    const frame = isObj(out.frame) ? out.frame : {};
    if (frame.shape == null || frame.shape === "auto") out.frame = { top: null, bottom: null, ...frame, shape: parts.shape };
  }
  if (parts.image) {
    const style = isObj(out.frameStyle) ? out.frameStyle : {};
    if (!style.image) out.frameStyle = { ...style, image: parts.image };
  }
  return out;
}

export function skinToParts(raw: unknown): unknown {
  if (!isObj(raw)) return raw;
  let out = layerToParts(raw);
  if (isObj(out.perDevice)) {
    const perDevice = Object.fromEntries(
      Object.entries(out.perDevice).map(([k, v]) => [k, isObj(v) ? layerToParts(v) : v]),
    );
    out = { ...out, perDevice };
  }
  if (Array.isArray(out.designs)) {
    out = {
      ...out,
      designs: out.designs.map((d) => (isObj(d) && isObj(d.values) ? { ...d, values: layerToParts(d.values) } : d)),
    };
  }
  return out;
}
