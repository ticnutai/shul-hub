import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useBookmarks } from "@/contexts/BookmarksContext";
import { useNotes } from "@/contexts/NotesContext";
import { useContent } from "@/contexts/ContentContext";
import { useHighlights } from "@/contexts/HighlightsContext";
import { 
  BookmarkCheck, 
  StickyNote, 
  FileText, 
  Highlighter, 
  User,
  ArrowRight,
  Trash2,
  Edit,
  Share2,
  ChevronLeft
} from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Shield } from "lucide-react";
import { useUserRoles } from "@/hooks/useUserRoles";

export const UserProfile = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { isAdmin } = useUserRoles();
  const { bookmarks, removeBookmark, updateBookmark } = useBookmarks();
  const { notes, questions, deleteNote, deleteQuestion } = useNotes();
  const { titles, questions: contentQuestions, answers, deleteTitle, deleteQuestion: deleteContentQuestion, deleteAnswer, updateTitleSharing, updateQuestionSharing, updateAnswerSharing } = useContent();
  const { highlights, removeHighlight } = useHighlights();

  const [editingBookmark, setEditingBookmark] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");
  const [editTags, setEditTags] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">טוען...</div>
      </div>
    );
  }

  if (!user) return null;

  const navigateToPasuk = (pasukId: string) => {
    const [sefer, perek, pasuk] = pasukId.split(":");
    navigate(`/commentaries/${sefer}/${perek}/${pasuk}`);
  };

  const handleSaveBookmark = async (id: string) => {
    await updateBookmark(id, editNote, editTags ? editTags.split(",").map(t => t.trim()) : []);
    setEditingBookmark(null);
    setEditNote("");
    setEditTags("");
  };

  const userTitles = titles.filter(t => t.userId === user.id);
  const userQuestions = contentQuestions.filter(q => q.userId === user.id);
  const userAnswers = answers.filter(a => a.userId === user.id);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/community")}
            className="mb-4 flex-row-reverse"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            <span>חזרה לדף הראשי</span>
          </Button>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-right">המערכת שלי</h1>
          <p className="text-muted-foreground text-right truncate overflow-hidden">{user.email}</p>
          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => navigate("/admin/permissions")}
              className="mt-3 gap-2"
            >
              <Shield className="h-4 w-4" />
              <span>ניהול הרשאות משתמשים</span>
            </Button>
          )}
        </div>

        <Tabs defaultValue="bookmarks" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-8">
            <TabsTrigger value="bookmarks" className="gap-2 min-h-[44px]">
              <BookmarkCheck className="h-5 w-5" />
              <span className="hidden sm:inline">סימניות</span>
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-2 min-h-[44px]">
              <StickyNote className="h-5 w-5" />
              <span className="hidden sm:inline">הערות</span>
            </TabsTrigger>
            <TabsTrigger value="content" className="gap-2 min-h-[44px]">
              <FileText className="h-5 w-5" />
              <span className="hidden sm:inline">תוכן</span>
            </TabsTrigger>
            <TabsTrigger value="highlights" className="gap-2 min-h-[44px]">
              <Highlighter className="h-5 w-5" />
              <span className="hidden sm:inline">הדגשות</span>
            </TabsTrigger>
            <TabsTrigger value="account" className="gap-2 min-h-[44px]">
              <User className="h-5 w-5" />
              <span className="hidden sm:inline">חשבון</span>
            </TabsTrigger>
          </TabsList>

          {/* Bookmarks Tab */}
          <TabsContent value="bookmarks" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 flex-row-reverse justify-end">
                  <span>הסימניות שלי</span>
                  <BookmarkCheck className="h-5 w-5" />
                </CardTitle>
                <CardDescription className="text-right">
                  {bookmarks.length} סימניות שמורות
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {bookmarks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    אין סימניות עדיין
                  </div>
                ) : (
                  bookmarks.map((bookmark) => (
                    <Card key={bookmark.id}>
                      <CardContent className="pt-6">
                        <div className="space-y-3">
                          <div 
                            className="font-hebrew text-lg cursor-pointer hover:text-primary transition-colors"
                            onClick={() => navigateToPasuk(bookmark.pasukId)}
                          >
                            {bookmark.pasukText}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {bookmark.pasukId}
                          </div>
                          
                          {editingBookmark === bookmark.id ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editNote}
                                onChange={(e) => setEditNote(e.target.value)}
                                placeholder="הערה..."
                                className="min-h-[80px]"
                              />
                              <Input
                                value={editTags}
                                onChange={(e) => setEditTags(e.target.value)}
                                placeholder="תגיות (מופרדות בפסיקים)"
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveBookmark(bookmark.id)}
                                >
                                  שמור
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingBookmark(null);
                                    setEditNote("");
                                    setEditTags("");
                                  }}
                                >
                                  בטל
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {bookmark.note && (
                                <div className="text-sm bg-muted p-3 rounded-md">
                                  {bookmark.note}
                                </div>
                              )}
                              {bookmark.tags && bookmark.tags.length > 0 && (
                                <div className="flex gap-2 flex-wrap">
                                  {bookmark.tags.map((tag, i) => (
                                    <Badge key={i} variant="secondary">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              <div className="flex gap-2 flex-row-reverse">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingBookmark(bookmark.id);
                                    setEditNote(bookmark.note || "");
                                    setEditTags(bookmark.tags?.join(", ") || "");
                                  }}
                                  className="flex-row-reverse"
                                >
                                  <span>ערוך</span>
                                  <Edit className="h-4 w-4 mr-2" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => navigateToPasuk(bookmark.pasukId)}
                                  className="flex-row-reverse"
                                >
                                  <span>עבור לפסוק</span>
                                  <ArrowRight className="h-4 w-4 mr-2" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => removeBookmark(bookmark.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 flex-row-reverse justify-end">
                  <span>הערות ושאלות אישיות</span>
                  <StickyNote className="h-5 w-5" />
                </CardTitle>
                <CardDescription className="text-right">
                  {notes.length} הערות, {questions.length} שאלות
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3 text-right">הערות</h3>
                  {notes.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      אין הערות עדיין
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {notes.map((note) => (
                        <Card key={note.id}>
                          <CardContent className="pt-4">
                            <div className="space-y-2">
                              <div className="text-sm text-muted-foreground">
                                {note.pasukId}
                              </div>
                              <p className="whitespace-pre-wrap">{note.content}</p>
                               <div className="flex gap-2 flex-row-reverse">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => navigateToPasuk(note.pasukId)}
                                  className="flex-row-reverse"
                                >
                                  <span>עבור לפסוק</span>
                                  <ArrowRight className="h-4 w-4 mr-2" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => deleteNote(note.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-3 text-right">שאלות</h3>
                  {questions.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      אין שאלות עדיין
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {questions.map((q) => (
                        <Card key={q.id}>
                          <CardContent className="pt-4">
                            <div className="space-y-2">
                              <div className="text-sm text-muted-foreground">
                                {q.pasukId}
                              </div>
                              <p className="font-semibold">{q.question}</p>
                              {q.answer && (
                                <p className="text-sm text-muted-foreground">
                                  תשובה: {q.answer}
                                </p>
                              )}
                               <div className="flex gap-2 flex-row-reverse">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => navigateToPasuk(q.pasukId)}
                                  className="flex-row-reverse"
                                >
                                  <span>עבור לפסוק</span>
                                  <ArrowRight className="h-4 w-4 mr-2" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => deleteQuestion(q.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Content Tab */}
          <TabsContent value="content" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 flex-row-reverse justify-end">
                  <span>תוכן שהוספתי</span>
                  <FileText className="h-5 w-5" />
                </CardTitle>
                <CardDescription className="text-right">
                  {userTitles.length} כותרות, {userQuestions.length} שאלות, {userAnswers.length} תשובות
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3 text-right">כותרות</h3>
                  {userTitles.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      לא הוספת כותרות עדיין
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {userTitles.map((title) => (
                        <Card key={title.id}>
                          <CardContent className="pt-4">
                            <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-right">{title.title}</h4>
                                {title.isShared && (
                                  <Badge variant="secondary" className="flex-row-reverse">
                                    <span>משותף</span>
                                    <Share2 className="h-3 w-3 mr-1" />
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground text-right">
                                {title.pasukId}
                              </div>
                              <div className="flex gap-2 flex-row-reverse">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => navigateToPasuk(title.pasukId)}
                                  className="flex-row-reverse"
                                >
                                  <span>עבור לפסוק</span>
                                  <ArrowRight className="h-4 w-4 mr-2" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateTitleSharing(title.id, !title.isShared)}
                                  className="flex-row-reverse"
                                >
                                  <span>{title.isShared ? "בטל שיתוף" : "שתף"}</span>
                                  <Share2 className="h-4 w-4 mr-2" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => deleteTitle(title.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-3 text-right">שאלות</h3>
                  {userQuestions.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      לא הוספת שאלות עדיין
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {userQuestions.map((q) => {
                        const titleData = titles.find(t => t.id === q.titleId);
                        return (
                          <Card key={q.id}>
                            <CardContent className="pt-4">
                              <div className="space-y-2">
                                {titleData && (
                                  <div className="text-sm text-muted-foreground text-right">
                                    כותרת: {titleData.title}
                                  </div>
                                )}
                                <p className="font-semibold text-right">{q.text}</p>
                                {q.isShared && (
                                  <Badge variant="secondary" className="flex-row-reverse">
                                    <span>משותף</span>
                                    <Share2 className="h-3 w-3 mr-1" />
                                  </Badge>
                                )}
                                <div className="flex gap-2 flex-row-reverse">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateQuestionSharing(q.id, !q.isShared)}
                                    className="flex-row-reverse"
                                  >
                                    <span>{q.isShared ? "בטל שיתוף" : "שתף"}</span>
                                    <Share2 className="h-4 w-4 mr-2" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => deleteContentQuestion(q.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-3 text-right">תשובות</h3>
                  {userAnswers.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      לא הוספת תשובות עדיין
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {userAnswers.map((a) => {
                        const questionData = contentQuestions.find(q => q.id === a.questionId);
                        return (
                          <Card key={a.id}>
                            <CardContent className="pt-4">
                              <div className="space-y-2">
                                {questionData && (
                                  <div className="text-sm text-muted-foreground text-right">
                                    שאלה: {questionData.text}
                                  </div>
                                )}
                                <p className="whitespace-pre-wrap text-right">{a.text}</p>
                                <div className="text-sm text-muted-foreground text-right">
                                  מפרש: {a.mefaresh}
                                </div>
                                {a.isShared && (
                                  <Badge variant="secondary" className="flex-row-reverse">
                                    <span>משותף</span>
                                    <Share2 className="h-3 w-3 mr-1" />
                                  </Badge>
                                )}
                                <div className="flex gap-2 flex-row-reverse">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateAnswerSharing(a.id, !a.isShared)}
                                    className="flex-row-reverse"
                                  >
                                    <span>{a.isShared ? "בטל שיתוף" : "שתף"}</span>
                                    <Share2 className="h-4 w-4 mr-2" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => deleteAnswer(a.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Highlights Tab */}
          <TabsContent value="highlights" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 flex-row-reverse justify-end">
                  <span>ההדגשות שלי</span>
                  <Highlighter className="h-5 w-5" />
                </CardTitle>
                <CardDescription className="text-right">
                  {highlights.length} הדגשות שמורות
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {highlights.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    אין הדגשות עדיין
                  </div>
                ) : (
                  highlights.map((highlight) => (
                    <Card key={highlight.id}>
                      <CardContent className="pt-4">
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground text-right">
                            {highlight.pasukId}
                          </div>
                          <div
                            className="p-2 rounded text-right"
                            style={{ backgroundColor: highlight.color }}
                          >
                            {highlight.text}
                          </div>
                          <div className="flex gap-2 flex-row-reverse">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigateToPasuk(highlight.pasukId)}
                              className="flex-row-reverse"
                            >
                              <span>עבור לפסוק</span>
                              <ArrowRight className="h-4 w-4 mr-2" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => removeHighlight(highlight.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 flex-row-reverse justify-end">
                  <span>פרטי החשבון</span>
                  <User className="h-5 w-5" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground mb-1">אימייל</div>
                    <div className="font-semibold">{user.email}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground mb-1">תאריך הצטרפות</div>
                    <div className="font-semibold">
                      {new Date(user.created_at || "").toLocaleDateString("he-IL")}
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-4 text-right">סטטיסטיקות</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-primary mb-1">
                            {bookmarks.length}
                          </div>
                          <div className="text-sm text-muted-foreground">סימניות</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-primary mb-1">
                            {notes.length + questions.length}
                          </div>
                          <div className="text-sm text-muted-foreground">הערות ושאלות</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-primary mb-1">
                            {userTitles.length + userQuestions.length + userAnswers.length}
                          </div>
                          <div className="text-sm text-muted-foreground">תוכן משותף</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-primary mb-1">
                            {highlights.length}
                          </div>
                          <div className="text-sm text-muted-foreground">הדגשות</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
