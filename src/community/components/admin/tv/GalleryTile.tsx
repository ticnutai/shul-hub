import type { ReactNode } from "react";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BoardElements } from "@/tv/BoardElements";
import type { BoardElement } from "@/tv/elements";
import { TileRemove } from "./ReadyShelf";

/**
 * One tile for every gallery of the design tab - backgrounds, the boxes'
 * frame pictures, the board's frames, the boxes' shapes, the title styles -
 * drawn one way: a 16:9 picture on the board's dark blue, its name centred
 * under it, the one worn ringed, ✕ in the corner (hiding a ready one,
 * deleting one's own), and the upload tile, when there is one, first and the
 * same size. Before this each gallery had a tile of its own: square here,
 * 16:10 there, a strip of name over a short swatch in a third, the upload
 * first in one and last in another, and a second click on the worn frame
 * took it off.
 */

/** The grid the tiles stand in; `compact` is the floating panel on the board. */
export function GalleryGrid({
  children,
  testId,
  compact = false,
  scroll = false,
}: {
  children: ReactNode;
  testId?: string;
  compact?: boolean;
  /** A long gallery scrolls inside itself rather than pushing the page. */
  scroll?: boolean;
}) {
  return (
    <div
      data-testid={testId}
      className={`grid ${compact ? "grid-cols-4 gap-1.5" : "grid-cols-3 gap-2 sm:grid-cols-4"} ${scroll ? "max-h-96 overflow-y-auto p-1" : ""}`}
    >
      {children}
    </div>
  );
}

export function GalleryTile({
  name,
  on,
  onPick,
  preview,
  remove,
  hint,
  ariaLabel,
  padded = false,
  compact = false,
  testId,
}: {
  name: string;
  on: boolean;
  onPick: () => void;
  /** What it looks like, drawn inside the 16:9 frame. */
  preview: ReactNode;
  /** ✕ in the corner: `ready` hides (and the shelf below brings back), otherwise deletes. */
  remove?: { ready: boolean; onClick: () => void };
  hint?: string;
  ariaLabel?: string;
  /** A picture of frame art: a little air around it, shown whole. */
  padded?: boolean;
  compact?: boolean;
  testId?: string;
}) {
  return (
    <div className="group relative" data-testid={testId}>
      {remove && <TileRemove name={name} ready={remove.ready} onClick={remove.onClick} />}
      <button
        type="button"
        aria-pressed={on}
        aria-label={ariaLabel ?? name}
        title={hint ?? name}
        onClick={onPick}
        className={`block w-full overflow-hidden rounded-md border bg-card text-center transition focus-visible:ring-2 focus-visible:ring-primary ${
          on ? "ring-2 ring-primary ring-offset-1" : "hover:border-primary/50"
        }`}
      >
        {/* Isolated: what a preview stacks stays inside it, never over the editor's pinned bars. */}
        <span className={`relative isolate block aspect-video w-full overflow-hidden bg-[#0b1628] ${padded ? "p-1" : ""}`} aria-hidden>
          {preview}
        </span>
        <span className={`block truncate px-1 py-1 font-medium ${compact ? "text-[10px]" : "text-[11px]"}`}>{name}</span>
      </button>
    </div>
  );
}

/** A picture, whole, inside a tile (frame art): never cropped. */
export function TilePicture({ src }: { src: string }) {
  return <img src={src} alt="" className="size-full object-contain" loading="lazy" decoding="async" />;
}

/** The upload tile: always first, the same size as the tiles beside it. */
export function UploadTile({
  label,
  uploading,
  multiple = false,
  onFiles,
  hint,
}: {
  label: string;
  uploading: boolean;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  hint?: string;
}) {
  return (
    <label
      title={hint}
      className={`flex cursor-pointer flex-col overflow-hidden rounded-md border border-dashed text-center transition hover:border-primary focus-within:ring-2 focus-within:ring-primary ${uploading ? "opacity-60" : ""}`}
    >
      <span className="flex aspect-video w-full items-center justify-center text-muted-foreground">
        <ImagePlus className="size-5" aria-hidden />
      </span>
      <span className="block truncate px-1 py-1 text-[11px] font-medium">{uploading ? "מעלה…" : label}</span>
      <input
        type="file"
        accept="image/*"
        multiple={multiple}
        className="sr-only"
        disabled={uploading}
        onChange={(e) => {
          // Read before the field is emptied (so the same picture can be chosen again).
          const files = e.target.files ? Array.from(e.target.files) : [];
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </label>
  );
}

/** The "nothing" tile (no frame, as every box): an empty dashed frame. */
export function NoneTilePreview() {
  return <span className="absolute inset-[18%] rounded border-2 border-dashed border-white/40" />;
}

/* ---------------------------------------------------- libraries of parts -- */

/** The grid of parts, the same in every library of parts. */
export const PART_GRID = 'grid grid-cols-2 gap-2 sm:grid-cols-3';

/**
 * One part in a library, drawn one way wherever parts are offered (the shared
 * catalogue, the ready parts, the shul's own): the part where it stands on a
 * dark board, its name under it, and one "הוספה". Before this each library
 * drew its own - a picture with an underlined link, a name beside a button,
 * a name over two buttons and a question that opened inside the card.
 */
export function PartTile({
  name,
  note,
  elements,
  addLabel,
  disabled,
  onAdd,
  remove,
}: {
  name: string;
  note?: string;
  elements: BoardElement[];
  /** What the button says to a screen reader ("הוספת …"). */
  addLabel: string;
  disabled?: boolean;
  onAdd: () => void;
  /** ✕ in the corner: deleting one of the shul's own (asked first by the caller). */
  remove?: { ready: boolean; onClick: () => void };
}) {
  return (
    <article className="group relative rounded-md border bg-card">
      {remove && <TileRemove name={name} ready={remove.ready} onClick={remove.onClick} />}
      {/* Isolated: the part's layers stay inside the tile, never over the editor's pinned bars. */}
      <div className="relative isolate aspect-video overflow-hidden rounded-t-md bg-[#0b1628]" style={{ containerType: 'size' }} aria-hidden>
        <BoardElements elements={elements} />
      </div>
      <div className="space-y-1.5 p-1.5">
        <p className="truncate text-center text-[11px] font-medium" title={name}>{name}</p>
        {note && <p className="line-clamp-2 text-center text-[11px] leading-tight text-muted-foreground">{note}</p>}
        <Button type="button" size="sm" variant="outline" className="h-7 w-full px-2 text-xs" aria-label={addLabel} disabled={disabled} onClick={onAdd}>
          הוספה
        </Button>
      </div>
    </article>
  );
}

export function PartGrid({ children }: { children: ReactNode }) {
  return <div className={PART_GRID}>{children}</div>;
}

