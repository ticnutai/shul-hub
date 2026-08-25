import { useState, useCallback, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSearchWorker } from "@/hooks/useSearchWorker";
import { useSearchDataLoader } from "@/hooks/useSearchDataLoader";
import { toHebrewNumber } from "@/utils/hebrewNumbers";
import { normalizeMefareshName } from "@/utils/names";
import { fixText } from "@/utils/fixData";
import { cn } from "@/lib/utils";

interface InlineSearchProps {
  onNavigateToPasuk?: (sefer: number, perek: number, pasuk: number) => void;
}

export function InlineSearch({ onNavigateToPasuk }: InlineSearchProps) {
  const [query, setQuery] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [results, setResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { searchableItems } = useSearchDataLoader(isActive);
  const { initializeIndex, search: workerSearch, isReady: workerReady } = useSearchWorker();

  useEffect(() => {
    if (searchableItems.length > 0) {
      initializeIndex(searchableItems);
    }
  }, [searchableItems, initializeIndex]);

  // Auto-search as user types
  useEffect(() => {
    if (query.trim().length < 2 || !workerReady) {
      if (!query.trim()) { setResults([]); setShowResults(false); }
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await workerSearch(query, { sefer: null, searchType: "pasuk", mefaresh: "הכל", useWildcard: false });
        setResults(res.slice(0, 15));
        setShowResults(true);
      } catch { /* ignore search errors */ }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, workerSearch, workerReady]);

  // Close on outside click
  useEffect(() => {
    if (!showResults) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showResults]);

  const handleNavigate = useCallback((sefer: number, perek: number, pasuk: number) => {
    setShowResults(false);
    setQuery("");
    onNavigateToPasuk?.(sefer, perek, pasuk);
  }, [onNavigateToPasuk]);

  return (
    <div ref={containerRef} className="relative w-full max-w-md" dir="rtl">
      <div className="relative flex items-center">
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsActive(true); }}
          onFocus={() => { setIsActive(true); if (results.length > 0) setShowResults(true); }}
          placeholder="חיפוש מהיר..."
          className="h-9 text-sm pr-9 pl-9 rounded-full border-2 border-accent bg-background text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-accent"
        />
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); setShowResults(false); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Results popover */}
      {showResults && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full min-w-[320px] z-[100] rounded-xl border border-border bg-popover/98 backdrop-blur-lg shadow-2xl overflow-hidden animate-fade-in">
          <div className="px-3 py-2 border-b border-border/50 text-xs text-muted-foreground">
            {results.length} תוצאות
          </div>
          <ScrollArea className="max-h-[360px]">
            <div className="py-1">
              {results.map((result, idx) => {
                const item = result.item;
                const seferName = ["בראשית", "שמות", "ויקרא", "במדבר", "דברים"][item.sefer - 1];
                return (
                  <button
                    key={`${item.id}-${idx}`}
                    onClick={() => handleNavigate(item.sefer, item.perek, item.pasuk_num)}
                    className="w-full text-right px-3 py-2 hover:bg-accent/50 transition-colors flex flex-col gap-0.5 border-b border-border/20 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">
                        {seferName} {toHebrewNumber(item.perek)}:{toHebrewNumber(item.pasuk_num)}
                      </span>
                      <Badge variant={item.type === "pasuk" ? "default" : item.type === "question" ? "secondary" : "outline"} className="text-[10px] h-4 px-1.5">
                        {item.type === "pasuk" ? "פסוק" : item.type === "question" ? "שאלה" : "פירוש"}
                      </Badge>
                      {item.mefaresh && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">{normalizeMefareshName(item.mefaresh)}</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {fixText(item.text).slice(0, 80)}...
                    </span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
