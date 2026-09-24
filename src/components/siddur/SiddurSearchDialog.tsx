import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { loadSiddurCategory } from "@/hooks/useSiddurData";
import {
  indexSections,
  normalizeHebrew,
  searchSections,
  type IndexedSection,
  type SiddurSearchHit,
} from "@/utils/siddurSearch";

export type { SiddurSearchHit };

/**
 * Find a prayer by name or by words in it, across every prayer of the nusach.
 *
 * "אחר" alone holds over a hundred sections — ברכת המזון, הלל, תפילת הדרך, הפרשת חלה —
 * in one list with no way in but scrolling. Search is that way in.
 */

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nusach: string;
  categories: { id: string; name: string }[];
  accent: string;
  onPick: (hit: SiddurSearchHit) => void;
}

export function SiddurSearchDialog({ open, onOpenChange, nusach, categories, accent, onPick }: Props) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [indexed, setIndexed] = useState<IndexedSection[] | null>(null);

  // Built when first opened, not on page load: the nusach is 2-3 MB of text
  // that most visits never search.
  useEffect(() => {
    if (!open || !categories.length) return;
    let alive = true;
    setIndexed(null);
    Promise.all(
      categories.map(async (c) => {
        const cat = await loadSiddurCategory(nusach, c.id);
        return cat ? indexSections(c.id, c.name, cat.sections) : [];
      }),
    ).then((parts) => alive && setIndexed(parts.flat()));
    return () => {
      alive = false;
    };
  }, [open, nusach, categories]);

  const hits = useMemo(() => (indexed ? searchSections(indexed, deferred) : []), [indexed, deferred]);
  const q = normalizeHebrew(deferred);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg text-right p-4 sm:p-6 gap-3 max-h-[85vh] flex flex-col">
        <DialogHeader className="text-right">
          <DialogTitle style={{ fontFamily: "'Noto Serif Hebrew', 'David Libre', serif" }}>חיפוש בסידור</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ברכת המזון, הלל, תפילת הדרך…"
            className="pr-9 text-base"
            data-testid="siddur-search-input"
            dir="rtl"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto -mx-1 px-1" data-testid="siddur-search-results">
          {!indexed && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: accent }} />
            </div>
          )}
          {indexed && q.length >= 2 && hits.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">לא נמצא "{deferred}" בנוסח הזה.</p>
          )}
          {indexed && q.length < 2 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              חיפוש בשמות הסעיפים ובמילות התפילה, בכל התפילות של הנוסח.
            </p>
          )}
          <ul className="space-y-1">
            {hits.map((h) => (
              <li key={`${h.catId}:${h.index}`}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(h);
                    onOpenChange(false);
                  }}
                  className="w-full rounded-lg border border-transparent px-3 py-2 text-right transition hover:border-border hover:bg-muted/50"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold" style={{ fontFamily: "'Noto Serif Hebrew', serif" }}>{h.title}</span>
                    <span className="shrink-0 text-xs" style={{ color: accent }}>{h.catName}</span>
                  </span>
                  {h.snippet && (
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground line-clamp-2">{h.snippet}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
