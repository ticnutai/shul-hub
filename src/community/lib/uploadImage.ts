/**
 * A picture from the gabbai's phone or computer, into the synagogue's own
 * picture storage (community-media) - the one way for an announcement's
 * picture, the home page strip's background and the synagogue's logos.
 *
 * Each of the three had its own list of files it took, its own size (5, 4
 * and 3 "MB") and its own words when a file was refused. Now one list, one
 * size, said the same way everywhere: "עד 5 מגה".
 */
import { toast } from "sonner";
import { supabase } from "@community/integrations/supabase/client";
import { hebrewError } from "@community/lib/hebrewError";

const BUCKET = "community-media";

/** The pictures taken: what a phone or a computer saves, and a drawn logo. */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"] as const;
export const IMAGE_ACCEPT = IMAGE_TYPES.join(",");
export const MAX_IMAGE_MB = 5;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;
/** For the line beside every upload button. */
export const IMAGE_LIMIT_TEXT = `תמונה רגילה מהטלפון או מהמחשב, עד ${MAX_IMAGE_MB} מגה`;
/** Said once a picture is in, before the form that holds it is saved. */
export const UPLOADED_TEXT = 'התמונה הועלתה. לשמירה לחצו "שמירה".';

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

/** Whether this file can be taken; says why not when it cannot. */
export function checkImage(file: File): boolean {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
    toast.error(`"${file.name}" אינו תמונה. אפשר להעלות תמונה רגילה מהטלפון או מהמחשב.`);
    return false;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    toast.error(`"${file.name}" גדולה מדי - עד ${MAX_IMAGE_MB} מגה`);
    return false;
  }
  return true;
}

/**
 * Uploads one picture under `folder` ("announcements", "hero/<shul>",
 * "logos/<shul>"). Returns its place and its address, or null - having said
 * why - when it was refused or failed.
 */
export async function uploadImage(file: File, folder: string): Promise<{ path: string; url: string } | null> {
  if (!checkImage(file)) return null;
  const path = `${folder}/${crypto.randomUUID()}.${EXTENSIONS[file.type] ?? "jpg"}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) {
    toast.error(hebrewError(error, "העלאת התמונה נכשלה"));
    return null;
  }
  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  return { path, url };
}

/** Pictures no longer used: taken out of the storage too. */
export async function removeImages(paths: (string | null | undefined)[]): Promise<void> {
  const list = paths.filter((p): p is string => Boolean(p));
  if (list.length) await supabase.storage.from(BUCKET).remove(list);
}
