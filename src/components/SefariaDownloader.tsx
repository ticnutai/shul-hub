import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const COMMENTARIES = [
  { value: "Rashi", label: "רש״י" },
  { value: "Ibn_Ezra", label: "אבן עזרא" },
  { value: "Ramban", label: "רמב״ן" },
  { value: "Sforno", label: "ספורנו" },
  { value: "Rashbam", label: "רשב״ם" },
  { value: "Or_HaChaim", label: "אור החיים" },
  { value: "Chizkuni", label: "חזקוני" },
  { value: "Radak", label: "רד״ק" },
];

const BOOKS = [
  { value: "Genesis", label: "בראשית" },
  { value: "Exodus", label: "שמות" },
  { value: "Leviticus", label: "ויקרא" },
  { value: "Numbers", label: "במדבר" },
  { value: "Deuteronomy", label: "דברים" },
];

export const SefariaDownloader = () => {
  const [commentary, setCommentary] = useState("");
  const [book, setBook] = useState("");
  const [chapter, setChapter] = useState("");
  const [verse, setVerse] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleDownload = async () => {
    if (!commentary || !book || !chapter || !verse) {
      toast.error("נא למלא את כל השדות");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('fetch-sefaria', {
        body: {
          commentaryName: commentary,
          book: book,
          chapter: parseInt(chapter),
          verse: parseInt(verse)
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'שגיאה בהורדת הנתונים');
      }

      // Save to local file
      const fileName = `${commentary}_on_${book}_${chapter}_${verse}.json`;
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      setResult({
        success: true,
        message: `הורדה הושלמה בהצלחה: ${fileName}`
      });
      toast.success("הפרשן הורד בהצלחה!");

    } catch (error) {
      console.error('Download error:', error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'שגיאה לא צפויה'
      });
      toast.error("שגיאה בהורדת הפרשן");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-right">הורדת פרשנים מספריא</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="commentary" className="text-right block">פרשן</Label>
          <Select value={commentary} onValueChange={setCommentary}>
            <SelectTrigger id="commentary">
              <SelectValue placeholder="בחר פרשן" />
            </SelectTrigger>
            <SelectContent>
              {COMMENTARIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="book" className="text-right block">ספר</Label>
          <Select value={book} onValueChange={setBook}>
            <SelectTrigger id="book">
              <SelectValue placeholder="בחר ספר" />
            </SelectTrigger>
            <SelectContent>
              {BOOKS.map(b => (
                <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="chapter" className="text-right block">פרק</Label>
            <Input
              id="chapter"
              type="number"
              min="1"
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="1"
              className="text-right"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="verse" className="text-right block">פסוק</Label>
            <Input
              id="verse"
              type="number"
              min="1"
              value={verse}
              onChange={(e) => setVerse(e.target.value)}
              placeholder="1"
              className="text-right"
            />
          </div>
        </div>

        <Button
          onClick={handleDownload}
          disabled={loading}
          className="w-full gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              מוריד...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              הורד פרשן
            </>
          )}
        </Button>

        {result && (
          <div className={`flex items-start gap-2 p-4 rounded-md ${
            result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {result.success ? (
              <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            )}
            <p className="text-sm text-right flex-1">{result.message}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};