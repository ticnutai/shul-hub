import type { CSSProperties } from "react";
import { backdropUrl, findBackdrop } from "./backdrops";
import { boxShapeCss } from "./boxPresets";
import type { TvConfig } from "./config";
import { coloursOnScreen } from "./designs";
import { framePictureUrl } from "./framePictures";
import { isPictureFill } from "./layerCss";

/**
 * A board's look in a few square centimetres: its wall, two boxes in their
 * colour, line, frame and shape, and a stroke of its accent. Drawn from the
 * config, not rendered - it has to be cheap enough for a row of them on a TV.
 */
export function LookThumb({ config, className = "" }: { config: TvConfig; className?: string }) {
  const colours = coloursOnScreen(config);
  const picture = config.backgroundImage ? findBackdrop(config.backgroundImage)?.thumb ?? backdropUrl(config.backgroundImage) : null;
  const wall: CSSProperties = picture
    ? { backgroundImage: `url("${picture}")`, backgroundSize: "cover", backgroundPosition: "center" }
    : config.backgroundGradient
      ? { backgroundImage: config.backgroundGradient }
      : { background: colours["--tv-bg-a"] };
  const fs = config.frameStyle;
  const fill = fs.fill && !isPictureFill(fs.fill) ? fs.fill : colours["--tv-panel"];
  const frame = framePictureUrl(fs.image);
  const shape = config.frame.shape === "auto" ? { borderRadius: 4 } : boxShapeCss(config.frame.shape);
  const box: CSSProperties = {
    ...shape,
    background: fill,
    opacity: fs.fillOpacity ?? 1,
    ...(fs.line ? { outline: `2px solid ${fs.line}`, outlineOffset: -2 } : {}),
    ...(frame ? { borderStyle: "solid", borderColor: "transparent", borderWidth: 4, borderImage: `url("${frame}") 30% fill / 4px stretch` } : {}),
  };
  const fill100: CSSProperties = { display: "block", flex: 1 };
  const column = (side: "left" | "right"): CSSProperties => ({
    position: "absolute",
    top: 0,
    bottom: 0,
    [side]: 0,
    width: "6%",
    background: "linear-gradient(90deg,#8a6a1a,#f6e3a8,#c9a227)",
  });
  return (
    <span
      className={className}
      aria-hidden
      style={{
        ...wall,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "6%",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        padding: "7%",
        boxSizing: "border-box",
      }}
    >
      <i style={{ display: "block", height: "10%", width: "45%", borderRadius: 2, background: colours["--tv-accent"] }} />
      <span style={{ display: "flex", flex: 1, gap: "6%" }}>
        <i style={{ ...fill100, ...box }} />
        <i style={{ ...fill100, ...box }} />
      </span>
      {config.boardFrame && (
        <>
          <i style={column("left")} />
          <i style={column("right")} />
        </>
      )}
    </span>
  );
}
