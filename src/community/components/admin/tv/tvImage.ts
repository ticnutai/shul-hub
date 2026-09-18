/**
 * Prepares an uploaded picture for the wall board, in the admin's browser,
 * before it is stored.
 *
 * Why not upload the original:
 *   - A phone photo is 12+ megapixels. The TV box would decode ~48 MB of
 *     pixels per image and then shrink it on its weak GPU with plain bilinear
 *     filtering, which is slow and aliases fine detail (shimmer, jagged text).
 *   - The background layer is drawn at 124% of the screen (it drifts for
 *     burn-in protection) and the slideshow zooms to 110%, so an image made
 *     "1920x1080" is actually stretched on the TV and looks soft.
 *
 * So every image is resampled once, here, with the browser's high-quality
 * filter, to just enough pixels to cover the box it is drawn in at 1:1 on a
 * 1080p TV (with headroom for a 4K box), and never enlarged.
 */

/** Pixels the image must cover on the TV so no step ever enlarges it. */
export const TV_IMAGE_TARGET = { width: 2400, height: 1350 };
/** Common GPU texture limit on TV boxes; larger images may not draw at all. */
const MAX_SIDE = 4096;
/** Below this share of the target the TV visibly enlarges the image. */
const LOW_RES_RATIO = 0.8;
/** Originals are only read locally, so a generous limit is fine. */
export const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
/** What is actually stored stays under the 5 MB the uploader always allowed. */
const STORED_MAX_BYTES = 4.5 * 1024 * 1024;

export interface FitResult {
  width: number;
  height: number;
  /** The source is smaller than what the TV needs; it will look soft. */
  lowRes: boolean;
}

/**
 * Size for a source of `w`x`h` drawn with object-fit: cover in the target box:
 * scaled so it still covers the box, only ever downscaled, capped per side.
 */
export function fitForTv(w: number, h: number, target = TV_IMAGE_TARGET): FitResult {
  const cover = Math.max(target.width / w, target.height / h);
  const scale = Math.min(1, cover, MAX_SIDE / Math.max(w, h));
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
    lowRes: cover > 1 / LOW_RES_RATIO,
  };
}

export interface PreparedImage {
  blob: Blob;
  extension: string;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  lowRes: boolean;
}

/**
 * Formats passed through untouched: vector art only. A GIF goes through the
 * resampler like any photo and is stored as its first frame - an animated
 * GIF would run forever on the TV, and any endless animation costs the box
 * about 45% CPU.
 */
const PASS_THROUGH: Record<string, string> = { "image/svg+xml": "svg" };
/** Formats the TV displays natively, kept as-is when no resize is needed. */
const ORIGINAL_OK: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function prepareTvImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) throw new Error("אפשר להעלות קובץ תמונה בלבד");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("התמונה גדולה מדי. הגודל המרבי הוא 40MB");
  if (PASS_THROUGH[file.type])
    return { blob: file, extension: PASS_THROUGH[file.type], width: 0, height: 0, sourceWidth: 0, sourceHeight: 0, lowRes: false };

  let source: ImageBitmap;
  try {
    // Applies the EXIF rotation, so phone photos are not stored sideways.
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
        ? "תמונות HEIC (אייפון) לא נתמכות בטלוויזיה. שמרו אותה כ-JPG ונסו שוב"
        : "לא ניתן לקרוא את התמונה. נסו קובץ JPG או PNG",
    );
  }

  const sourceWidth = source.width;
  const sourceHeight = source.height;
  const fit = fitForTv(sourceWidth, sourceHeight);
  // Already the right size: re-encoding would only lose quality. (The TV's
  // WebView honours EXIF rotation itself.)
  const keep = ORIGINAL_OK[file.type];
  if (fit.width === sourceWidth && keep && file.size <= STORED_MAX_BYTES) {
    source.close();
    return { blob: file, extension: keep, width: sourceWidth, height: sourceHeight, sourceWidth, sourceHeight, lowRes: fit.lowRes };
  }
  const canvas = document.createElement("canvas");
  canvas.width = fit.width;
  canvas.height = fit.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("הדפדפן לא הצליח לעבד את התמונה");

  let resized: ImageBitmap | null = null;
  if (fit.width !== source.width) {
    try {
      // Chrome's "high" resize is a proper multi-tap filter; drawImage alone
      // is bilinear and aliases on large reductions.
      resized = await createImageBitmap(source, { resizeWidth: fit.width, resizeHeight: fit.height, resizeQuality: "high" });
    } catch {
      resized = null;
    }
  }
  if (resized) ctx.drawImage(resized, 0, 0);
  else drawStepped(ctx, source, fit.width, fit.height);
  resized?.close();
  source.close();

  // PNGs are usually graphics or flyers with text: keep them lossless so
  // letters stay crisp (JPEG halves colour resolution and rings around
  // edges). Photos go to high-quality JPEG.
  const lossless = file.type === "image/png" || file.type === "image/webp" || file.type === "image/gif";
  let blob = lossless ? await toBlob(canvas, "image/png") : null;
  let extension = "png";
  if (!blob || blob.size > STORED_MAX_BYTES) {
    blob = await toBlob(canvas, "image/jpeg", 0.92);
    extension = "jpg";
  }
  if (!blob) throw new Error("הדפדפן לא הצליח לשמור את התמונה");

  return {
    blob,
    extension,
    width: fit.width,
    height: fit.height,
    sourceWidth,
    sourceHeight,
    lowRes: fit.lowRes,
  };
}

/** Fallback resampler: halve repeatedly, then one final smooth step. */
function drawStepped(ctx: CanvasRenderingContext2D, source: CanvasImageSource & { width: number; height: number }, w: number, h: number) {
  let current: CanvasImageSource = source;
  let cw = source.width;
  let ch = source.height;
  while (cw / 2 >= w && ch / 2 >= h) {
    const step = document.createElement("canvas");
    step.width = Math.round(cw / 2);
    step.height = Math.round(ch / 2);
    const sctx = step.getContext("2d")!;
    sctx.imageSmoothingQuality = "high";
    sctx.drawImage(current, 0, 0, step.width, step.height);
    current = step;
    cw = step.width;
    ch = step.height;
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(current, 0, 0, w, h);
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}
