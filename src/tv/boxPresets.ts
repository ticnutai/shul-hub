import type { CSSProperties } from "react";
import type { FrameShape } from "./config";
import type { BoxShape } from "./frameLooks";

/** A small box in a shape, for a tile or a thumbnail (LookThumb). */
export function boxShapeCss(shape: BoxShape | FrameShape): CSSProperties {
  switch (shape) {
    case "square":
      return { borderRadius: 0 };
    case "pill":
      return { borderRadius: 999 };
    case "ellipse":
      return { borderRadius: "50%" };
    case "hexagon":
      return { borderRadius: 0, clipPath: "polygon(14% 0, 86% 0, 100% 50%, 86% 100%, 14% 100%, 0 50%)" };
    case "octagon":
      return { borderRadius: 0, clipPath: "polygon(18% 0, 82% 0, 100% 22%, 100% 78%, 82% 100%, 18% 100%, 0 78%, 0 22%)" };
    case "arch":
      return { borderRadius: "50% 50% 4px 4px / 45% 45% 4px 4px" };
    // The silhouettes are the board's own clip paths (TvShapes.tsx), which the preview beside it draws.
    case "dome":
    case "onion":
    case "lancet":
    case "scallop":
      return { borderRadius: 0, clipPath: `url(#tv-shape-${shape})` };
    default:
      return { borderRadius: 8 };
  }
}
