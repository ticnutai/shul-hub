import type { TvConfig } from "@/tv/config";
import { ElementLook } from "./TvEditInspector";

type Edit = (key: string, update: (c: TvConfig) => TvConfig) => void;

/**
 * The board's text one area at a time - the name, the clock, every minyan
 * row at once. It is the very editor that opens when the area is clicked on
 * the board (ElementLook): the same choices under the same names, for the
 * same setting (config.styles). It used to be a second one, whose weights
 * and labels did not match it. Which areas there are: textAreas.ts.
 */
export function TextAreaControls({ config, onEdit, areaKey }: { config: TvConfig; onEdit: Edit; areaKey: string }) {
  return (
    <div data-testid="text-areas">
      <ElementLook k={areaKey} config={config} onEdit={onEdit} position={false} />
    </div>
  );
}
