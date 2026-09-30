import goldOrnate from "./assets/frames/gold-ornate.jpg";
import carvedWood from "./assets/frames/carved-wood.jpg";

/**
 * The ready-made pictures of frames: the frames of the painted boards, cut
 * out of them (scripts/tv-frame-pictures.py) so they can go on any panel of
 * any layout, over any background.
 *
 * Stored in FrameStyle.image as "frame:<id>" - like the backgrounds'
 * "backdrop:<id>" - so a board keeps its frames when the build renames the
 * file. `slice` is how much of each edge of the picture is the frame, and
 * `width` how thick it is drawn by default; both can then be moved.
 */
export const FRAME_PICTURE_PREFIX = "frame:";

export interface FramePicture {
  id: string;
  name: string;
  url: string;
  slice: number;
  width: number;
}

export const FRAME_PICTURES: FramePicture[] = [
  { id: "gold-ornate", name: "זהב מעוטר", url: goldOrnate, slice: 32, width: 3 },
  { id: "carved-wood", name: "עץ מגולף", url: carvedWood, slice: 24, width: 3 },
];

export const framePictureRef = (id: string) => FRAME_PICTURE_PREFIX + id;

/** What the board loads: a ready-made frame's file, or an uploaded picture as it is. */
export function framePictureUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith(FRAME_PICTURE_PREFIX)) return value;
  const id = value.slice(FRAME_PICTURE_PREFIX.length);
  return FRAME_PICTURES.find((f) => f.id === id)?.url ?? null;
}
