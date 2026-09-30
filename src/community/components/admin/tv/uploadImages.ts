import { toast } from "sonner";
import { uploadTvImage } from "./tvAdminData";

/**
 * Uploads pictures for the board and returns their URLs, warning about any
 * that will look soft on a television. One place for it: the board's
 * background, a frame's background, a picture of a frame and the slideshow
 * all upload the same way.
 */
export async function uploadImages(files: FileList | File[] | null): Promise<string[]> {
  const list = files ? Array.from(files) : [];
  const urls: string[] = [];
  for (const file of list) {
    const uploaded = await uploadTvImage(file);
    urls.push(uploaded.url);
    if (uploaded.lowRes)
      toast.warning(
        `"${file.name}" קטנה מדי לטלוויזיה (${uploaded.lowRes.width}×${uploaded.lowRes.height}) ותיראה מעט מטושטשת. לאיכות מלאה העלו תמונה ברוחב 1920 פיקסלים לפחות.`,
        { duration: 9000 },
      );
  }
  return urls;
}
