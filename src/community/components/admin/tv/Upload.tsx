/**
 * Bringing a file into the editor, the one way: a button that opens the
 * file chooser, "מעלה…" while it runs, and a failure said once in a toast.
 *
 * There were eleven: each upload kept its own "busy" flag, its own try and
 * its own message, and its button was a link here, an outlined button there
 * and a dashed box in a third. Now an upload is useUpload (pictures, into the
 * shul's storage - uploadImages), any other file is useFileTask (a package,
 * a file of parts, an old file of colours), and the button is FileButton.
 * The galleries keep their upload tile (GalleryTile's UploadTile), first in
 * the gallery and the size of the tiles beside it.
 */
import { useCallback, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadImages } from "./uploadImages";

/** A task on a file: busy while it runs, its failure in a toast. A second one waits for the first. */
export function useFileTask(failure = "הפעולה נכשלה") {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const run = useCallback(
    async (task: () => Promise<void>) => {
      if (running.current) return;
      running.current = true;
      setBusy(true);
      try {
        await task();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : failure);
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [failure],
  );
  return { busy, run };
}

/** Pictures into the shul's storage; `use` gets their addresses (never called with none). */
export function useUpload() {
  const { busy, run } = useFileTask("ההעלאה נכשלה");
  const upload = useCallback(
    (files: FileList | File[] | null, use: (urls: string[]) => void) =>
      run(async () => {
        const list = files ? Array.from(files) : [];
        if (!list.length) return;
        const urls = await uploadImages(list);
        if (urls.length) use(urls);
      }),
    [run],
  );
  return { uploading: busy, upload };
}

/** The button that opens the file chooser: "מעלה…" while busy, the same file can be chosen again. */
export function FileButton({
  label,
  busy = false,
  onFiles,
  accept = "image/*",
  multiple = false,
  ariaLabel,
  icon = <ImagePlus className="size-4" aria-hidden />,
  variant = "outline",
  title,
}: {
  label: ReactNode;
  busy?: boolean;
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  /** The file field's own name, for a reader of the page (and the tests). */
  ariaLabel?: string;
  icon?: ReactNode;
  variant?: "outline" | "default" | "ghost";
  title?: string;
}) {
  return (
    <Button type="button" variant={variant} size="sm" className="h-8 cursor-pointer" asChild>
      <label title={title} aria-disabled={busy || undefined}>
        {icon} {busy ? "מעלה…" : label}
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          aria-label={ariaLabel}
          disabled={busy}
          onChange={(e) => {
            // Read before the field is emptied (so the same file can be chosen again).
            const files = e.target.files ? Array.from(e.target.files) : [];
            e.target.value = "";
            if (files.length) onFiles(files);
          }}
        />
      </label>
    </Button>
  );
}
