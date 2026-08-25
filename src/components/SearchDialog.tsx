import { useState, useEffect, useCallback } from "react";
import { Toggle } from "@/components/ui/toggle";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchFilters } from "@/components/search/SearchFilters";
import { SearchResults } from "@/components/search/SearchResults";
import { CommentaryExpandDialog } from "@/components/CommentaryExpandDialog";
import { useSearchWorker } from "@/hooks/useSearchWorker";
import { useSearchDataLoader } from "@/hooks/useSearchDataLoader";
import { Loader2, Sparkles, Maximize2, Minimize2, Clock, Asterisk } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const SEARCH_HISTORY_KEY = 'search_history';
const MAX_SEARCH_HISTORY = 10;

function getSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function addToSearchHistory(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return;
  const history = getSearchHistory().filter(h => h !== trimmed);
  history.unshift(trimmed);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_SEARCH_HISTORY)));
}

function clearSearchHistory() {
  localStorage.removeItem(SEARCH_HISTORY_KEY);
}

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateToPasuk?: (sefer: number, perek: number, pasuk: number) => void;
}

export function SearchDialog({ open, onOpenChange, onNavigateToPasuk }: SearchDialogProps) {
  // Load data only when dialog opens, with parallel loading + IndexedDB cache
  const { searchableItems, books, isReady, isFullyLoaded, completedCount, totalProgress } = useSearchDataLoader(open);

  const { initializeIndex, search: workerSearch, isReady: workerReady, isSearching } = useSearchWorker();
  const [isMaximized, setIsMaximized] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sefer, setSefer] = useState<number | null>(null);
  const [searchType, setSearchType] = useState<"all" | "question" | "perush" | "pasuk">("pasuk");
  const [mefaresh, setMefaresh] = useState("הכל");
  const [useWildcard, setUseWildcard] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [activeResults, setActiveResults] = useState<any[]>([]);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [searchHistoryItems, setSearchHistoryItems] = useState<string[]>(getSearchHistory());

  const [expandDialog, setExpandDialog] = useState({
    open: false, sefer: 1, perek: 1, pasuk: 1, mefaresh: ""
  });

  // Initialize index whenever searchable items change (instant with regex-based search)
  useEffect(() => {
    if (searchableItems.length > 0) {
      initializeIndex(searchableItems);
    }
  }, [searchableItems, initializeIndex]);

  const runSearch = useCallback(async (query: string, saveHistory = false) => {
    if (!query.trim() || !workerReady) return;
    try {
      const results = await workerSearch(query, { sefer, searchType, mefaresh, useWildcard });
      setActiveResults(results);
      setHasSearched(true);
      if (saveHistory) {
        addToSearchHistory(query);
        setSearchHistoryItems(getSearchHistory());
      }
    } catch (error) {
      console.error("Search error:", error);
    }
  }, [workerSearch, workerReady, sefer, searchType, mefaresh, useWildcard]);

  const handleExactSearch = useCallback(() => {
    if (!searchQuery.trim()) { toast.error("נא להזין שאילתת חיפוש"); return; }
    if (!workerReady) { toast.error("מנוע החיפוש עדיין טוען..."); return; }
    runSearch(searchQuery, true);
  }, [searchQuery, workerReady, runSearch]);

  // Auto-search as user types (debounced)
  useEffect(() => {
    if (searchQuery.trim().length < 2 || !workerReady) {
      if (!searchQuery.trim()) {
        setActiveResults([]);
        setHasSearched(false);
      }
      return;
    }
    const timer = setTimeout(() => runSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, runSearch, workerReady]);

  const handleSmartSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      toast.error("נא להזין שאילתת חיפוש");
      return;
    }
    setAiLoading(true);
    setAiSuggestion("");
    try {
      const context = sefer ? ["בראשית", "שמות", "ויקרא", "במדבר", "דברים"][sefer - 1] : "כל התורה";
      const { data, error } = await supabase.functions.invoke('smart-search', {
        body: { query: searchQuery, context }
      });
      if (error) throw error;
      if (data?.suggestion) {
        setAiSuggestion(data.suggestion);
        handleExactSearch();
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Smart search error:", error);
      if (error.message?.includes('429')) toast.error("מגבלת בקשות הושגה, אנא נסה שוב מאוחר יותר");
      else if (error.message?.includes('402')) toast.error("נדרש תשלום, אנא הוסף זיכויים למערכת");
      else toast.error("שגיאה בחיפוש חכם");
    } finally {
      setAiLoading(false);
    }
  }, [searchQuery, sefer, handleExactSearch]);

  const handleExpandCommentary = (sefer: number, perek: number, pasuk: number, mefaresh: string) => {
    setExpandDialog({ open: true, sefer, perek, pasuk, mefaresh });
  };

  // Loading banner removed - index builds instantly with regex

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          data-layout="dialog-search" data-layout-label="📦 דיאלוג: חיפוש"
          className={cn(
            "transition-all duration-300 w-[95vw] sm:w-auto overflow-hidden",
            isMaximized ? "max-w-[95vw] h-[95vh]" : "max-w-4xl max-h-[85vh]"
          )}
        >
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-2xl">חיפוש בתורה</DialogTitle>
              <Button
                variant="ghost" size="icon"
                onClick={() => setIsMaximized(!isMaximized)}
                className="h-8 w-8"
              >
                {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground text-right">
              חפש פסוקים, שאלות ופירושים בכל חמשת חומשי התורה
            </p>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[calc(85vh-8rem)]">

            <Card className="p-3 sm:p-6 mt-2">
              <Tabs defaultValue="exact" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="exact">חיפוש מדויק</TabsTrigger>
                  <TabsTrigger value="smart">
                    <Sparkles className="h-4 w-4 ml-2" />
                    חיפוש חכם (AI)
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="exact" className="space-y-4 mt-4">
                  <div className="flex items-center gap-2">
                    <SearchBar value={searchQuery} onChange={setSearchQuery} onSearch={handleExactSearch} />
                    <Toggle
                      pressed={useWildcard}
                      onPressedChange={setUseWildcard}
                      size="sm"
                      className="shrink-0 h-10 px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                      title="חיפוש עם כוכביות (למשל: בר*שית)"
                    >
                      <Asterisk className="h-4 w-4" />
                    </Toggle>
                  </div>

                  {searchHistoryItems.length > 0 && !searchQuery && activeResults.length === 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> חיפושים אחרונים
                        </span>
                        <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground"
                          onClick={() => { clearSearchHistory(); setSearchHistoryItems([]); }}>
                          נקה
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {searchHistoryItems.map((item, i) => (
                          <Button key={i} variant="outline" size="sm" className="h-7 text-xs"
                            onClick={() => setSearchQuery(item)}>
                            {item}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  <SearchFilters sefer={sefer} searchType={searchType} mefaresh={mefaresh}
                    onSeferChange={setSefer} onSearchTypeChange={setSearchType} onMefareshChange={setMefaresh} />

                  <div className="pt-4">
                    {hasSearched && activeResults.length > 0 && (
                      <div className="mb-4 text-sm text-muted-foreground text-right">
                        נמצאו {activeResults.length} תוצאות
                      </div>
                    )}
                    {hasSearched && activeResults.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        לא נמצאו תוצאות
                      </div>
                    )}
                    <SearchResults results={activeResults} onExpandCommentary={handleExpandCommentary}
                      onNavigate={onNavigateToPasuk ? (s, p, v) => { onOpenChange(false); onNavigateToPasuk(s, p, v); } : undefined} />
                  </div>
                </TabsContent>

                <TabsContent value="smart" className="space-y-4 mt-4">
                  <SearchBar value={searchQuery} onChange={setSearchQuery} onSearch={handleSmartSearch}
                    placeholder="שאל שאלה או תאר מה אתה מחפש..." />

                  <SearchFilters sefer={sefer} searchType={searchType} mefaresh={mefaresh}
                    onSeferChange={setSefer} onSearchTypeChange={setSearchType} onMefareshChange={setMefaresh} />

                  {aiLoading && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary ml-2" />
                      <span className="text-muted-foreground">מנתח את השאילתא...</span>
                    </div>
                  )}

                  {aiSuggestion && (
                    <Alert className="bg-primary/5 border-primary/20">
                      <Sparkles className="h-4 w-4" />
                      <AlertDescription className="text-right whitespace-pre-wrap">{aiSuggestion}</AlertDescription>
                    </Alert>
                  )}

                  <div className="pt-4">
                    {activeResults.length > 0 && (
                      <div className="mb-4 text-sm text-muted-foreground text-right">
                        נמצאו {activeResults.length} תוצאות
                      </div>
                    )}
                    <SearchResults results={activeResults} onExpandCommentary={handleExpandCommentary}
                      onNavigate={onNavigateToPasuk ? (s, p, v) => { onOpenChange(false); onNavigateToPasuk(s, p, v); } : undefined} />
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <CommentaryExpandDialog
        open={expandDialog.open}
        onOpenChange={(open) => setExpandDialog({ ...expandDialog, open })}
        sefer={expandDialog.sefer} perek={expandDialog.perek}
        pasuk={expandDialog.pasuk} mefaresh={expandDialog.mefaresh}
      />
    </>
  );
}
