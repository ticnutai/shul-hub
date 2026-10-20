/**
 * The pieces of adding and keeping, the same wherever they show (the list of
 * layers, the panel by the board, the library of parts):
 *
 *   ImagePick      a picture - uploaded (and kept in "התמונות שלי"), or one
 *                  of "התמונות שלי"
 *   InsideButtons  something new inside a container: a frame, a text, a box,
 *                  an ornament, a picture (addInside)
 *   SaveToParts    what was chosen, kept in "החלקים שלי" under a name
 *                  (saveToLibrary)
 */
import { useState } from "react";
import { Plus, Save } from "lucide-react";
import type { TvConfig } from "@/tv/config";
import type { BoardElement } from "@/tv/elements";
import type { InsideKind } from "@/tv/containers";
import { saveToLibrary } from "./ElementLibrary";
import { FileButton, useUpload } from "./Upload";
import { useTvLibraryItems } from "./useTvLibrary";
import { NameForm, SELECT_CLASS } from "./editorParts";

export type Picture = { url: string; name: string };
const SMALL = "inline-flex h-7 items-center gap-1 rounded border bg-background px-2 text-xs hover:border-primary/50";

/** A picture to use: uploaded now (kept in "התמונות שלי" for next time), or one already there. */
export function ImagePick({ label, what, onPick }: {
  label: string;
  /** Its fields' names: "העלאת תמונה ל{what}", "תמונה מהתמונות שלי ל{what}". */
  what: string;
  onPick: (picture: Picture) => void;
}) {
  const { uploading, upload } = useUpload();
  const library = useTvLibraryItems();
  const mine = library.items.filter((r) => r.kind === "image" && typeof (r.data as { url?: unknown } | null)?.url === "string");
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <FileButton label={label} ariaLabel={`העלאת תמונה ל${what}`} accept="image/png,image/jpeg,image/webp" busy={uploading} icon={<Plus className="size-3.5" aria-hidden />}
        onFiles={(files) => upload(files, ([url]) => {
          onPick({ url, name: files[0].name.replace(/\.[a-z0-9]{2,5}$/i, "").slice(0, 80) });
          library.keepImage(url, files[0].name);
        })} />
      {mine.length > 0 && (
        <select aria-label={`תמונה מהתמונות שלי ל${what}`} className={`${SELECT_CLASS} h-7 max-w-36`} value=""
          onChange={(ev) => {
            const r = mine.find((x) => x.id === ev.target.value);
            if (r) onPick({ url: (r.data as { url: string }).url, name: r.name });
          }}>
          <option value="">מהתמונות שלי…</option>
          {mine.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      )}
    </span>
  );
}

/** Something new inside a container - the one row of it. A frame only where it has none. */
export function InsideButtons({ name, hasFrame, onAdd }: {
  name: string;
  hasFrame: boolean;
  onAdd: (kind: InsideKind, more?: Partial<BoardElement>) => void;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1" data-testid="inside-buttons">
      {!hasFrame && <button type="button" className={SMALL} aria-label={`מסגרת לתוך ${name}`} onClick={() => onAdd("frame")}><Plus className="size-3.5" aria-hidden /> מסגרת</button>}
      <button type="button" className={SMALL} aria-label={`טקסט לתוך ${name}`} onClick={() => onAdd("text")}><Plus className="size-3.5" aria-hidden /> טקסט</button>
      <button type="button" className={SMALL} aria-label={`תיבה לתוך ${name}`} title="לוח קטן בתוך הקונטיינר - לכתוב עליו, או לשים בו תמונה" onClick={() => onAdd("box")}><Plus className="size-3.5" aria-hidden /> תיבה</button>
      <button type="button" className={SMALL} aria-label={`עיטור לתוך ${name}`} onClick={() => onAdd("ornament")}><Plus className="size-3.5" aria-hidden /> עיטור</button>
      <ImagePick label="תמונה" what={`תוך ${name}`} onPick={(p) => onAdd("image", { image: p.url, name: p.name })} />
    </span>
  );
}

/** "שמירה בחלקים שלי": the name asked (what it is called already, to change or keep), then kept. */
export function SaveToParts({ config, onEdit, elements, name, compact = false }: {
  config: TvConfig;
  onEdit: (key: string, update: (c: TvConfig) => TvConfig) => void;
  elements: BoardElement[];
  /** The name offered: the container's, the picture's. */
  name: string;
  /** In a header: a small button. */
  compact?: boolean;
}) {
  const [naming, setNaming] = useState<string | null>(null);
  if (naming === null)
    return (
      <button type="button" disabled={!elements.length} onClick={() => setNaming(name.slice(0, 80))} data-testid="save-to-parts"
        title={'נשמר בתיקייה "החלקים שלי" - ומשם מוסיפים עותק לכל לוח'}
        className={`${compact ? "h-7 px-2 text-xs" : "h-8 px-3 text-sm"} inline-flex items-center gap-1 rounded-md border bg-background hover:border-primary/50 disabled:opacity-40`}>
        <Save className="size-3.5" aria-hidden /> שמירה בחלקים שלי
      </button>
    );
  return (
    <div className="w-full min-w-64">
      <NameForm label="שם החלק" value={naming} maxLength={80} placeholder="למשל: תמונת הרב בקשת"
        onChange={setNaming}
        onSave={() => void saveToLibrary(config, onEdit, naming, elements).then((ok) => ok && setNaming(null))}
        onCancel={() => setNaming(null)} />
    </div>
  );
}
