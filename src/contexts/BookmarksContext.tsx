import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { torahDB } from "@/utils/torahDB";
import { toast } from "sonner";

export interface Bookmark {
  id: string;
  pasukId: string;
  pasukText: string;
  note?: string;
  tags?: string[];
  createdAt: string;
}

interface BookmarksContextType {
  bookmarks: Bookmark[];
  addBookmark: (pasukId: string, pasukText: string, note?: string, tags?: string[]) => Promise<void>;
  removeBookmark: (id: string) => Promise<void>;
  toggleBookmark: (pasukId: string, pasukText: string) => Promise<void>;
  updateBookmark: (id: string, note?: string, tags?: string[]) => Promise<void>;
  getBookmarksForPasuk: (pasukId: string) => Bookmark[];
  isBookmarked: (pasukId: string) => boolean;
  loading: boolean;
}

const BookmarksContext = createContext<BookmarksContextType | undefined>(undefined);

export const BookmarksProvider = ({ children }: { children: ReactNode }) => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // טעינת סימניות מ-Supabase
  useEffect(() => {
    if (user) {
      loadBookmarks();
    } else {
      setBookmarks([]);
      setLoading(false);
    }
  }, [user]);

  const loadBookmarks = async () => {
    if (!user) return;

    try {
      // 1. Load from IndexedDB cache instantly
      const cached = await torahDB.getUserData('bookmarks');
      if (cached) {
        setBookmarks(cached as Bookmark[]);
        setLoading(false);
      }

      // 2. Sync from Supabase
      const { data, error } = await supabase
        .from("user_bookmarks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedBookmarks: Bookmark[] = (data || []).map((b) => ({
        id: b.id,
        pasukId: b.pasuk_id,
        pasukText: b.pasuk_text,
        note: b.note || undefined,
        tags: b.tags || undefined,
        createdAt: b.created_at,
      }));

      setBookmarks(formattedBookmarks);
      // 3. Save to IndexedDB
      torahDB.saveUserData('bookmarks', formattedBookmarks).catch(() => {});
    } catch (error) {
      console.error("Error loading bookmarks:", error);
      toast.error("שגיאה בטעינת הסימניות");
    } finally {
      setLoading(false);
    }
  };

  const addBookmark = useCallback(async (
    pasukId: string,
    pasukText: string,
    note?: string,
    tags?: string[]
  ) => {
    if (!user) {
      toast.error("יש להתחבר כדי להוסיף סימניות");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_bookmarks")
        .insert({
          user_id: user.id,
          pasuk_id: pasukId,
          pasuk_text: pasukText,
          note,
          tags,
        })
        .select()
        .single();

      if (error) throw error;

      const newBookmark: Bookmark = {
        id: data.id,
        pasukId: data.pasuk_id,
        pasukText: data.pasuk_text,
        note: data.note || undefined,
        tags: data.tags || undefined,
        createdAt: data.created_at,
      };

      setBookmarks((prev) => {
        const next = [newBookmark, ...prev];
        torahDB.saveUserData('bookmarks', next).catch(() => {});
        return next;
      });
      toast.success("הסימניה נוספה בהצלחה");
    } catch (error) {
      console.error("Error adding bookmark:", error);
      toast.error("שגיאה בהוספת סימניה");
    }
  }, [user]);

  const removeBookmark = useCallback(async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("user_bookmarks")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      setBookmarks((prev) => {
        const next = prev.filter((b) => b.id !== id);
        torahDB.saveUserData('bookmarks', next).catch(() => {});
        return next;
      });
      toast.success("הסימניה הוסרה");
    } catch (error) {
      console.error("Error removing bookmark:", error);
      toast.error("שגיאה בהסרת סימניה");
    }
  }, [user]);

  const toggleBookmark = useCallback(async (pasukId: string, pasukText: string) => {
    const existing = bookmarks.find((b) => b.pasukId === pasukId);
    if (existing) {
      await removeBookmark(existing.id);
    } else {
      await addBookmark(pasukId, pasukText);
    }
  }, [bookmarks, removeBookmark, addBookmark]);

  const updateBookmark = useCallback(async (id: string, note?: string, tags?: string[]) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("user_bookmarks")
        .update({ note, tags, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      setBookmarks((prev) => {
        const next = prev.map((b) => (b.id === id ? { ...b, note, tags } : b));
        torahDB.saveUserData('bookmarks', next).catch(() => {});
        return next;
      });
      toast.success("הסימניה עודכנה");
    } catch (error) {
      console.error("Error updating bookmark:", error);
      toast.error("שגיאה בעדכון סימניה");
    }
  }, [user]);

  const getBookmarksForPasuk = useCallback((pasukId: string) => {
    return bookmarks.filter((b) => b.pasukId === pasukId);
  }, [bookmarks]);

  const isBookmarked = useCallback((pasukId: string) => {
    return bookmarks.some((b) => b.pasukId === pasukId);
  }, [bookmarks]);

  const value = useMemo(() => ({
    bookmarks,
    addBookmark,
    removeBookmark,
    toggleBookmark,
    updateBookmark,
    getBookmarksForPasuk,
    isBookmarked,
    loading,
  }), [bookmarks, addBookmark, removeBookmark, toggleBookmark, updateBookmark, getBookmarksForPasuk, isBookmarked, loading]);

  return (
    <BookmarksContext.Provider
      value={value}
    >
      {children}
    </BookmarksContext.Provider>
  );
};

export const useBookmarks = () => {
  const context = useContext(BookmarksContext);
  if (!context) {
    throw new Error("useBookmarks must be used within BookmarksProvider");
  }
  return context;
};
