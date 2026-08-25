import { useState, useEffect, useCallback } from "react";
import { Download, Trash2, HardDrive, CheckCircle2, Loader2, Database, BookOpen, MessageSquare, Bookmark, Palette, FileText, ChevronDown, ChevronUp, Clock, Search, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { torahDB } from "@/utils/torahDB";
import { downloadAllSefarim, clearAllSeferCache } from "@/utils/lazyLoadSefer";
import { downloadAllCommentaries, downloadCommentaryByMefaresh, clearCommentaryCache } from "@/utils/sefariaCommentaries";
import { AVAILABLE_COMMENTARIES, getCommentariesByCategory } from "@/types/sefaria";
import { toHebrewNumber } from "@/utils/hebrewNumbers";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const SEFER_NAMES = ['בראשית', 'שמות', 'ויקרא', 'במדבר', 'דברים'];
const USER_DATA_KEYS = ['highlights', 'notes', 'personal_questions', 'bookmarks', 'content_titles', 'content_questions', 'content_answers'];

interface StoredInfo {
  seferId: number;
  timestamp: number;
  sizeMB: number;
}

interface DataStatus {
  sefarim: StoredInfo[];
  userDataKeys: string[];
  commentaryCount: number;
  commentaryKeys: string[];
  totalSizeMB: number;
}

/**
 * LocalDBManager — inline storage management panel.
 * Shows storage stats, download buttons for sefarim & commentaries, and clear buttons.
 * Designed to be embedded directly inside a Settings tab.
 */
export const LocalDBManager = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<DataStatus>({
    sefarim: [],
    userDataKeys: [],
    commentaryCount: 0,
    commentaryKeys: [],
    totalSizeMB: 0,
  });
  const [downloading, setDownloading] = useState(false);
  const [downloadingCommentaries, setDownloadingCommentaries] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ completed: 0, total: 5, current: '' });
  const [commentaryProgress, setCommentaryProgress] = useState({ completed: 0, total: 45, current: '' });
  const [initialized, setInitialized] = useState(false);

  const loadStatus = useCallback(async () => {
    const [sefarim, totalSizeMB, commentaryCount, commentaryKeys] = await Promise.all([
      torahDB.getStoredSefarim(),
      torahDB.getTotalSize(),
      torahDB.getCommentaryCount(),
      torahDB.getStoredCommentaryKeys(),
    ]);

    const userDataKeys: string[] = [];
    for (const key of USER_DATA_KEYS) {
      const hasData = await torahDB.hasUserData(key);
      if (hasData) userDataKeys.push(key);
    }

    setStatus({
      sefarim,
      userDataKeys,
      commentaryCount,
      commentaryKeys,
      totalSizeMB: Math.round(totalSizeMB * 10) / 10,
    });
  }, []);

  useEffect(() => {
    if (!initialized) {
      setInitialized(true);
      loadStatus();
    }
  }, [initialized, loadStatus]);

  const handleDownloadAll = async () => {
    setDownloading(true);
    setDownloadProgress({ completed: 0, total: 5, current: SEFER_NAMES[0] });
    
    try {
      await downloadAllSefarim((completed, total, currentName) => {
        setDownloadProgress({ completed, total, current: currentName });
      });
      
      toast.success("כל החומשים נשמרו בהצלחה! הטעינה תהיה מהירה מעכשיו");
      await loadStatus();
    } catch (error) {
      console.error('Download error:', error);
      toast.error("שגיאה בהורדת הנתונים");
    } finally {
      setDownloading(false);
    }
  };

  const handleClearAll = async () => {
    try {
      await torahDB.clearAll();
      clearAllSeferCache();
      clearCommentaryCache();
      toast.success("כל הנתונים המקומיים נמחקו");
      await loadStatus();
    } catch (error) {
      toast.error("שגיאה במחיקת הנתונים");
    }
  };

  const handleClearSefarim = async () => {
    try {
      await clearAllSeferCache();
      toast.success("חומשים מקומיים נמחקו");
      await loadStatus();
    } catch (error) {
      toast.error("שגיאה במחיקה");
    }
  };

  const handleClearUserData = async () => {
    try {
      await torahDB.clearUserData();
      toast.success("נתוני משתמש מקומיים נמחקו");
      await loadStatus();
    } catch (error) {
      toast.error("שגיאה במחיקה");
    }
  };

  const handleClearCommentaries = async () => {
    try {
      await torahDB.clearCommentaries();
      clearCommentaryCache();
      toast.success("מפרשים מקומיים נמחקו");
      await loadStatus();
    } catch (error) {
      toast.error("שגיאה במחיקה");
    }
  };

  const handleDownloadCommentaries = async () => {
    setDownloadingCommentaries(true);
    setCommentaryProgress({ completed: 0, total: 45, current: '' });
    
    try {
      await downloadAllCommentaries((completed, total, current) => {
        setCommentaryProgress({ completed, total, current });
      });
      
      toast.success("כל המפרשים הזמינים נשמרו בהצלחה!");
      await loadStatus();
    } catch (error) {
      console.error('Commentary download error:', error);
      toast.error("שגיאה בהורדת המפרשים");
    } finally {
      setDownloadingCommentaries(false);
    }
  };

  const handleSyncAllToCloud = async () => {
    if (!user) {
      toast.error("אין משתמש מחובר לסנכרון לענן");
      return;
    }

    setSyncingCloud(true);
    try {
      const [
        highlightsRaw,
        notesRaw,
        personalQuestionsRaw,
        bookmarksRaw,
        titlesRaw,
        questionsRaw,
        answersRaw,
      ] = await Promise.all([
        torahDB.getUserData('highlights'),
        torahDB.getUserData('notes'),
        torahDB.getUserData('personal_questions'),
        torahDB.getUserData('bookmarks'),
        torahDB.getUserData('content_titles'),
        torahDB.getUserData('content_questions'),
        torahDB.getUserData('content_answers'),
      ]);

      let syncedRows = 0;

      const highlights = Array.isArray(highlightsRaw) ? highlightsRaw as Array<{ id: string; pasukId: string; text: string; color: string; startIndex: number; endIndex: number; }> : [];
      if (highlights.length > 0) {
        const rows = highlights.map((item) => ({
          id: item.id,
          user_id: user.id,
          pasuk_id: item.pasukId,
          highlight_text: item.text,
          color: item.color,
          start_index: item.startIndex,
          end_index: item.endIndex,
        }));
        const { error } = await supabase.from("user_highlights").upsert(rows, { onConflict: 'id' });
        if (error) throw error;
        syncedRows += rows.length;
      }

      const notes = Array.isArray(notesRaw) ? notesRaw as Array<{ id: string; pasukId: string; content: string; }> : [];
      if (notes.length > 0) {
        const rows = notes.map((item) => ({
          id: item.id,
          user_id: user.id,
          pasuk_id: item.pasukId,
          note_text: item.content,
        }));
        const { error } = await supabase.from("user_notes").upsert(rows, { onConflict: 'id' });
        if (error) throw error;
        syncedRows += rows.length;
      }

      const personalQuestions = Array.isArray(personalQuestionsRaw)
        ? personalQuestionsRaw as Array<{ id: string; pasukId: string; question: string; answer?: string; }>
        : [];
      if (personalQuestions.length > 0) {
        const rows = personalQuestions.map((item) => ({
          id: item.id,
          user_id: user.id,
          pasuk_id: item.pasukId,
          question_text: item.question,
          answer_text: item.answer ?? null,
        }));
        const { error } = await supabase.from("user_personal_questions").upsert(rows, { onConflict: 'id' });
        if (error) throw error;
        syncedRows += rows.length;
      }

      const bookmarks = Array.isArray(bookmarksRaw)
        ? bookmarksRaw as Array<{ id: string; pasukId: string; pasukText: string; note?: string; tags?: string[]; }>
        : [];
      if (bookmarks.length > 0) {
        const rows = bookmarks.map((item) => ({
          id: item.id,
          user_id: user.id,
          pasuk_id: item.pasukId,
          pasuk_text: item.pasukText,
          note: item.note ?? null,
          tags: item.tags ?? null,
        }));
        const { error } = await supabase.from("user_bookmarks").upsert(rows, { onConflict: 'id' });
        if (error) throw error;
        syncedRows += rows.length;
      }

      const titles = Array.isArray(titlesRaw)
        ? titlesRaw as Array<{ id: number; pasukId: string; title: string; isShared?: boolean; }>
        : [];
      if (titles.length > 0) {
        const rows = titles.map((item) => ({
          id: item.id,
          user_id: user.id,
          pasuk_id: item.pasukId,
          title: item.title,
          is_shared: item.isShared ?? false,
        }));
        const { error } = await supabase.from("user_titles").upsert(rows, { onConflict: 'id' });
        if (error) throw error;
        syncedRows += rows.length;
      }

      const questions = Array.isArray(questionsRaw)
        ? questionsRaw as Array<{ id: number; titleId: number; text: string; isShared?: boolean; }>
        : [];
      if (questions.length > 0) {
        const rows = questions.map((item) => ({
          id: item.id,
          user_id: user.id,
          title_id: item.titleId,
          text: item.text,
          is_shared: item.isShared ?? false,
        }));
        const { error } = await supabase.from("user_questions").upsert(rows, { onConflict: 'id' });
        if (error) throw error;
        syncedRows += rows.length;
      }

      const answers = Array.isArray(answersRaw)
        ? answersRaw as Array<{ id: number; questionId: number; mefaresh: string; text: string; isShared?: boolean; }>
        : [];
      if (answers.length > 0) {
        const rows = answers.map((item) => ({
          id: item.id,
          user_id: user.id,
          question_id: item.questionId,
          mefaresh: item.mefaresh,
          text: item.text,
          is_shared: item.isShared ?? false,
        }));
        const { error } = await supabase.from("user_answers").upsert(rows, { onConflict: 'id' });
        if (error) throw error;
        syncedRows += rows.length;
      }

      toast.success(`סנכרון לענן הושלם (${syncedRows} רשומות)`);
      await loadStatus();
    } catch (error) {
      console.error('Cloud sync error:', error);
      toast.error("שגיאה בסנכרון לענן");
    } finally {
      setSyncingCloud(false);
    }
  };

  const allSefarimStored = status.sefarim.length === 5;
  const progressPercent = (downloadProgress.completed / downloadProgress.total) * 100;
  const commentaryProgressPercent = (commentaryProgress.completed / commentaryProgress.total) * 100;
  const hasAnyData = status.sefarim.length > 0 || status.userDataKeys.length > 0 || status.commentaryCount > 0;

  return (
    <div className="space-y-4" dir="rtl">
      {/* Summary Card */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3 justify-end">
          <h3 className="font-semibold text-base">סטטוס אחסון מקומי</h3>
          <Database className="h-5 w-5 text-primary" />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-2.5 bg-muted/50 rounded-lg text-center">
            <div className="font-mono text-lg font-bold text-primary">{status.totalSizeMB} MB</div>
            <div className="text-xs text-muted-foreground">סה"כ נפח</div>
          </div>
          <div className="p-2.5 bg-muted/50 rounded-lg text-center">
            <div className="font-mono text-lg font-bold text-primary">{status.sefarim.length}/5</div>
            <div className="text-xs text-muted-foreground">חומשים</div>
          </div>
          <div className="p-2.5 bg-muted/50 rounded-lg text-center">
            <div className="font-mono text-lg font-bold text-primary">{status.commentaryCount}</div>
            <div className="text-xs text-muted-foreground">מפרשים</div>
          </div>
          <div className="p-2.5 bg-muted/50 rounded-lg text-center">
            <div className="font-mono text-lg font-bold text-primary">{status.userDataKeys.length}</div>
            <div className="text-xs text-muted-foreground">נתוני משתמש</div>
          </div>
        </div>
      </Card>

      {/* Sefarim Section */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClearSefarim}
            disabled={status.sefarim.length === 0 || downloading}
            className="text-destructive hover:text-destructive h-7 px-2"
          >
            <Trash2 className="h-3 w-3 ml-1" />
            <span className="text-xs">מחק</span>
          </Button>
          <h4 className="font-semibold flex items-center gap-1.5">
            <span>חומשים</span>
            <BookOpen className="h-4 w-4 text-primary" />
          </h4>
        </div>
        <div className="grid grid-cols-5 gap-1.5 mb-3">
          {SEFER_NAMES.map((name, i) => {
            const stored = status.sefarim.find(s => s.seferId === i + 1);
            return (
              <div
                key={i}
                className={`text-center text-xs p-2 rounded-lg transition-colors ${
                  stored 
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' 
                    : 'bg-muted text-muted-foreground border border-transparent'
                }`}
              >
                {stored ? <CheckCircle2 className="h-3.5 w-3.5 mx-auto mb-0.5" /> : null}
                {name}
              </div>
            );
          })}
        </div>
        <Button
          onClick={handleDownloadAll}
          disabled={downloading || downloadingCommentaries || allSefarimStored}
          className="w-full gap-2"
          size="sm"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : allSefarimStored ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          <span>{allSefarimStored ? 'כל החומשים מאוחסנים' : 'הורד את כל החומשים'}</span>
        </Button>

        {downloading && (
          <div className="space-y-2 mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="font-mono">{downloadProgress.completed}/{downloadProgress.total}</span>
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                מוריד: {downloadProgress.current}
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}
      </Card>

      {/* Commentaries Section */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClearCommentaries}
            disabled={status.commentaryCount === 0 || downloadingCommentaries}
            className="text-destructive hover:text-destructive h-7 px-2"
          >
            <Trash2 className="h-3 w-3 ml-1" />
            <span className="text-xs">מחק</span>
          </Button>
          <h4 className="font-semibold flex items-center gap-1.5">
            <span>מפרשים ({AVAILABLE_COMMENTARIES.length} מפרשים זמינים)</span>
            <MessageSquare className="h-4 w-4 text-primary" />
          </h4>
        </div>
        <div className="text-xs text-muted-foreground mb-3">
          {status.commentaryCount > 0
            ? `${status.commentaryCount} רשומות מפרשים מאוחסנות מקומית`
            : 'אין מפרשים מאוחסנים — הורדה תאפשר גישה מהירה ואופליין'
          }
        </div>

        {/* Download All */}
        <Button
          onClick={handleDownloadCommentaries}
          disabled={downloadingCommentaries || downloading}
          className="w-full gap-2 mb-2"
          size="sm"
          variant="outline"
        >
          {downloadingCommentaries ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          <span>הורד את כל המפרשים</span>
        </Button>

        {/* Selective Download Collapsible */}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full text-xs gap-1 h-7">
              <ChevronDown className="h-3 w-3" />
              הורדה סלקטיבית לפי מפרש
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {[
              { label: "מפרשים קלאסיים", commentaries: getCommentariesByCategory("classic") },
              { label: "תרגום", commentaries: getCommentariesByCategory("targum") },
              { label: "מפרשים נוספים", commentaries: getCommentariesByCategory("additional") },
            ].map(group => (
              <div key={group.label}>
                <div className="text-xs font-semibold text-muted-foreground mb-1 text-right">{group.label}</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {group.commentaries.map(c => (
                    <Button
                      key={c.english}
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs justify-end gap-1"
                      disabled={downloadingCommentaries || downloading}
                      onClick={async () => {
                        setDownloadingCommentaries(true);
                        setCommentaryProgress({ completed: 0, total: 5, current: c.hebrew });
                        try {
                          await downloadCommentaryByMefaresh(c.english, c.hebrew, (completed, total, current) => {
                            setCommentaryProgress({ completed, total, current });
                          });
                          toast.success(`${c.hebrew} הורד בהצלחה`);
                          await loadStatus();
                        } catch {
                          toast.error(`שגיאה בהורדת ${c.hebrew}`);
                        } finally {
                          setDownloadingCommentaries(false);
                        }
                      }}
                    >
                      <Download className="h-3 w-3" />
                      {c.hebrew}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>

        {downloadingCommentaries && (
          <div className="space-y-2 mt-3 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="font-mono">{commentaryProgress.completed}/{commentaryProgress.total}</span>
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                מוריד: {commentaryProgress.current}
              </span>
            </div>
            <Progress value={commentaryProgressPercent} className="h-2" />
          </div>
        )}
      </Card>

      {/* Commentary View History */}
      <CommentaryHistory />

      {/* Search Cache */}
      <SearchCacheSection />

      {/* User Data Section */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClearUserData}
            disabled={status.userDataKeys.length === 0}
            className="text-destructive hover:text-destructive h-7 px-2"
          >
            <Trash2 className="h-3 w-3 ml-1" />
            <span className="text-xs">מחק</span>
          </Button>
          <h4 className="font-semibold flex items-center gap-1.5">
            <span>נתוני משתמש (קאש מקומי)</span>
            <FileText className="h-4 w-4 text-primary" />
          </h4>
        </div>
        <div className="text-xs text-muted-foreground">
          {status.userDataKeys.length > 0 
            ? `מאוחסן: ${status.userDataKeys.join(', ')}`
            : 'אין נתוני משתמש מקומיים'
          }
        </div>
        <Button
          onClick={handleSyncAllToCloud}
          disabled={syncingCloud || status.userDataKeys.length === 0}
          className="w-full mt-3 gap-2"
          size="sm"
          variant="secondary"
        >
          {syncingCloud ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UploadCloud className="h-4 w-4" />
          )}
          <span>{syncingCloud ? 'מסנכרן לענן...' : 'Sync All לענן'}</span>
        </Button>
      </Card>

      {/* Clear All */}
      <div className="flex justify-center pt-1">
        <Button
          variant="destructive"
          size="sm"
          onClick={handleClearAll}
          disabled={downloading || downloadingCommentaries || !hasAnyData}
          className="gap-1.5"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>מחק את כל הנתונים המקומיים</span>
        </Button>
      </div>

      {/* Info */}
      <div className="text-sm text-muted-foreground text-right p-4 bg-muted/30 rounded-lg space-y-2">
        <p className="font-semibold">💾 מידע על אחסון מקומי</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>הנתונים נשמרים ב-IndexedDB של הדפדפן</li>
          <li>הורדה מאפשרת גישה מהירה ללא חיבור לאינטרנט</li>
          <li>מפרשים שנטענו מ-API נשמרים אוטומטית לשימוש חוזר</li>
          <li>ניתן למחוק נתונים מקומיים בכל עת — הנתונים בשרת לא ייפגעו</li>
          <li>ניתן להוריד מפרש בודד או את כולם</li>
          <li>{AVAILABLE_COMMENTARIES.length} מפרשים זמינים כולל תרגום אונקלוס</li>
        </ul>
      </div>
    </div>
  );
};

/**
 * CommentaryHistory — shows recent commentary views from localStorage
 */
interface CommentaryHistoryEntry {
  seferId: string;
  seferName: string;
  perek: number;
  pasuk: number;
  timestamp: string;
}

const CommentaryHistory = () => {
  const [history, setHistory] = useState<CommentaryHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('torah-commentary-history');
      if (saved) setHistory(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  if (history.length === 0) return null;

  return (
    <Card className="p-4">
      <Collapsible open={showHistory} onOpenChange={setShowHistory}>
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 gap-1">
              {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <span className="text-xs">{history.length} רשומות</span>
            </Button>
          </CollapsibleTrigger>
          <h4 className="font-semibold flex items-center gap-1.5 text-sm">
            <span>היסטוריית צפייה</span>
            <Clock className="h-4 w-4 text-primary" />
          </h4>
        </div>
        <CollapsibleContent className="mt-2">
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {history.slice(0, 20).map((entry, i) => (
              <a
                key={i}
                href={`/commentaries/${entry.seferId}/${entry.perek}/${entry.pasuk}`}
                className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-muted/50 transition-colors"
              >
                <span className="text-muted-foreground">
                  {new Date(entry.timestamp).toLocaleDateString('he-IL')}
                </span>
                <span className="font-medium">
                  {entry.seferName} {toHebrewNumber(entry.perek)}:{toHebrewNumber(entry.pasuk)}
                </span>
              </a>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 text-xs text-destructive hover:text-destructive h-7"
            onClick={() => {
              localStorage.removeItem('torah-commentary-history');
              setHistory([]);
              toast.success("היסטוריה נמחקה");
            }}
          >
            <Trash2 className="h-3 w-3 ml-1" />
            מחק היסטוריה
          </Button>
        </CollapsibleContent>
      </Collapsible>

    </Card>
  );
};

/**
 * SearchCacheSection — standalone section for clearing search index cache
 */
const SearchCacheSection = () => (
  <Card className="p-4">
    <div className="flex items-center justify-between mb-2">
      <div />
      <h4 className="font-semibold text-sm flex items-center gap-2">
        מטמון חיפוש
        <Search className="h-4 w-4 text-primary" />
      </h4>
    </div>
    <p className="text-xs text-muted-foreground text-right mb-3">
      אינדקס החיפוש נשמר במכשיר לטעינה מהירה. ניקוי יגרום לבנייה מחדש בפעם הבאה שתפתח חיפוש.
    </p>
    <Button
      variant="outline"
      size="sm"
      className="w-full gap-2 text-destructive hover:text-destructive"
      onClick={async () => {
        try {
          // Delete the entire database - simplest and most reliable approach
          const deleteReq = indexedDB.deleteDatabase('torah_search_db');
          deleteReq.onsuccess = () => toast.success("מטמון החיפוש נוקה בהצלחה");
          deleteReq.onerror = () => toast.error("שגיאה בניקוי מטמון החיפוש");
        } catch {
          toast.error("שגיאה בניקוי מטמון החיפוש");
        }
      }}
    >
      <Trash2 className="h-3 w-3" />
      נקה מטמון חיפוש
    </Button>
  </Card>
);
