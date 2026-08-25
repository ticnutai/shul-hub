import { useState } from "react";
import { Bookmark, BookmarkCheck, Trash2, Plus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBookmarks } from "@/contexts/BookmarksContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export const BookmarksDialog = () => {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");
  const [editTags, setEditTags] = useState("");

  const { bookmarks, removeBookmark, updateBookmark } = useBookmarks();
  const navigate = useNavigate();

  const handleSaveEdit = async () => {
    if (!editingId) return;

    const tags = editTags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    await updateBookmark(editingId, editNote, tags.length > 0 ? tags : undefined);
    setEditingId(null);
    setEditNote("");
    setEditTags("");
  };

  const startEdit = (id: string, note?: string, tags?: string[]) => {
    setEditingId(id);
    setEditNote(note || "");
    setEditTags(tags?.join(", ") || "");
  };

  const navigateToPasuk = (pasukId: string) => {
    // פורמט: "bereishit-1-1"
    const parts = pasukId.split("-");
    if (parts.length === 3) {
      const [sefer, perek, pasuk] = parts;
      navigate(`/chumash?sefer=${sefer}&perek=${perek}&pasuk=${pasuk}`);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" data-bookmarks-trigger>
          <span>הסימניות שלי</span>
          <BookmarkCheck className="h-4 w-4" />
          {bookmarks.length > 0 && (
            <Badge variant="secondary" className="mr-1">
              {bookmarks.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent data-layout="dialog-bookmarks" data-layout-label="📦 דיאלוג: סימניות" className="max-w-3xl max-h-[80vh] overflow-y-auto text-right">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-end text-2xl">
            <span>הסימניות שלי</span>
            <BookmarkCheck className="h-6 w-6" />
          </DialogTitle>
          <DialogDescription className="text-right">
            כל הפסוקים שסימנת
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {bookmarks.length === 0 ? (
            <Card className="p-8 text-center">
              <Bookmark className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                עדיין לא סימנת פסוקים
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                לחץ על אייקון הסימניה ליד פסוק כדי להוסיף אותו
              </p>
            </Card>
          ) : (
            bookmarks.map((bookmark) => (
              <Card key={bookmark.id} className="p-4 hover:shadow-md transition-shadow">
                {editingId === bookmark.id ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>הערה</Label>
                      <Textarea
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        placeholder="הוסף הערה לסימניה..."
                        className="text-right"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>תגיות (מופרדות בפסיק)</Label>
                      <Input
                        value={editTags}
                        onChange={(e) => setEditTags(e.target.value)}
                        placeholder="למשל: חשוב, לימוד, שאלה"
                        className="text-right"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingId(null);
                          setEditNote("");
                          setEditTags("");
                        }}
                      >
                        ביטול
                      </Button>
                      <Button onClick={handleSaveEdit}>
                        <Plus className="h-4 w-4 ml-2" />
                        שמור
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div
                      className="cursor-pointer hover:text-primary transition-colors"
                      onClick={() => navigateToPasuk(bookmark.pasukId)}
                    >
                      <p className="text-lg font-semibold hebrew-text mb-2">
                        {bookmark.pasukText}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {bookmark.pasukId}
                      </p>
                    </div>

                    {bookmark.note && (
                      <p className="text-sm text-muted-foreground bg-accent/10 p-2 rounded">
                        {bookmark.note}
                      </p>
                    )}

                    {bookmark.tags && bookmark.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {bookmark.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary" className="gap-1">
                            <Tag className="h-3 w-3" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2 justify-end pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(bookmark.id, bookmark.note, bookmark.tags)}
                      >
                        <Plus className="h-4 w-4 ml-1" />
                        הוסף הערה/תג
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeBookmark(bookmark.id)}
                      >
                        <Trash2 className="h-4 w-4 ml-1" />
                        הסר סימניה
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
