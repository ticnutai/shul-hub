import { useState } from "react";
import { Search, Sparkles, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface SmartSearchDialogProps {
  onSearch: (query: string) => void;
}

export const SmartSearchDialog = ({ onSearch }: SmartSearchDialogProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSmartSearch = async () => {
    if (!query.trim()) {
      toast.error("אנא הזן שאלה או נושא לחיפוש");
      return;
    }

    setIsLoading(true);
    setSuggestion("");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ query }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 429) {
          toast.error("מגבלת בקשות הושגה, אנא נסה שוב מאוחר יותר");
        } else if (response.status === 402) {
          toast.error("נדרש תשלום, אנא הוסף זיכויים למערכת");
        } else {
          toast.error(error.error || "שגיאה בחיפוש חכם");
        }
        return;
      }

      const data = await response.json();
      setSuggestion(data.suggestion);
      toast.success("קיבלת המלצות חיפוש!");
    } catch (error) {
      console.error("Smart search error:", error);
      toast.error("שגיאה בתקשורת עם השרת");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplySuggestion = (keyword: string) => {
    onSearch(keyword);
    setOpen(false);
    toast.success(`מחפש: ${keyword}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 bg-gradient-to-l from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 border-purple-300 dark:border-purple-700"
        >
          <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <span>חיפוש חכם</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right text-xl flex items-center justify-end gap-2">
            <span>חיפוש חכם בתורה</span>
            <Sparkles className="h-5 w-5 text-purple-600" />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Search Input */}
          <div className="space-y-2">
            <div className="relative">
              <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-500" />
              <Input
                placeholder='שאל שאלה או תאר נושא, למשל: "מה זה גאולה?" או "פרשות על אמונה"'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSmartSearch()}
                className="pr-10 text-right h-12"
                autoFocus
              />
            </div>
            <p className="text-sm text-muted-foreground text-right">
              המערכת תנתח את שאלתך ותמליץ על מילות מפתח, פרשות ומפרשים רלוונטיים
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <Button
              onClick={() => {
                setQuery("");
                setSuggestion("");
              }}
              variant="outline"
              disabled={isLoading}
            >
              <X className="h-4 w-4 ml-2" />
              נקה
            </Button>
            <Button 
              onClick={handleSmartSearch} 
              disabled={isLoading || !query.trim()}
              className="gap-2 bg-gradient-to-l from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <Sparkles className="h-4 w-4 ml-2" />
              )}
              {isLoading ? "מחפש..." : "קבל המלצות"}
            </Button>
          </div>

          {/* AI Suggestions */}
          {suggestion && (
            <Card className="p-6 bg-gradient-to-br from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200 dark:border-purple-800 space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-semibold">
                <Sparkles className="h-5 w-5" />
                <span>המלצות חיפוש</span>
              </div>
              
              <div className="prose prose-sm max-w-none text-right whitespace-pre-wrap leading-relaxed">
                {suggestion}
              </div>

              <div className="pt-4 border-t border-purple-200 dark:border-purple-800">
                <p className="text-sm text-muted-foreground text-right mb-3">
                  ניתן להעתיק מילות מפתח לחיפוש הרגיל:
                </p>
                <div className="flex flex-wrap gap-2 justify-end">
                  {suggestion
                    .split(/[,،\n]/)
                    .map((s) => s.trim())
                    .filter((s) => s && s.length > 2 && s.length < 50)
                    .slice(0, 8)
                    .map((keyword, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        size="sm"
                        onClick={() => handleApplySuggestion(keyword)}
                        className="hover:bg-purple-100 dark:hover:bg-purple-900 hover:border-purple-400"
                      >
                        <Search className="h-3 w-3 ml-1" />
                        {keyword}
                      </Button>
                    ))}
                </div>
              </div>
            </Card>
          )}

          {/* Loading State */}
          {isLoading && (
            <Card className="p-8 flex flex-col items-center justify-center gap-4 animate-pulse">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              <p className="text-muted-foreground">מנתח את שאלתך ומחפש המלצות...</p>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
