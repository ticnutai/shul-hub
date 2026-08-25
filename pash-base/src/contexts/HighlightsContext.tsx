/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { torahDB } from "@/utils/torahDB";
import { toast } from "sonner";

export interface Highlight {
  pasukId: string;
  text: string;
  color: string;
  startIndex: number;
  endIndex: number;
  id: string;
}

interface HighlightsContextType {
  highlights: Highlight[];
  addHighlight: (highlight: Omit<Highlight, "id">) => void;
  removeHighlight: (id: string) => void;
  getHighlightsForPasuk: (pasukId: string) => Highlight[];
  loading: boolean;
}

const HighlightsContext = createContext<HighlightsContextType | undefined>(undefined);

export const HighlightsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);

  // Load highlights from Supabase
  useEffect(() => {
    if (user) {
      let ignore = false;
      loadHighlights(() => ignore);
      return () => { ignore = true; };
    } else {
      setHighlights([]);
      setLoading(false);
    }
  }, [user]);

  const loadHighlights = async (isIgnored: () => boolean) => {
    if (!user) return;

    try {
      setLoading(true);

      // 1. Load from IndexedDB cache instantly
      const cached = await torahDB.getUserData('highlights');
      if (isIgnored()) return;
      if (cached) {
        setHighlights(cached as Highlight[]);
        setLoading(false);
      }

      // 2. Sync from Supabase
      const { data, error } = await supabase
        .from("user_highlights")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (isIgnored()) return;
      if (error) throw error;

      const mappedHighlights: Highlight[] = (data || []).map((h) => ({
        id: h.id,
        pasukId: h.pasuk_id,
        text: h.highlight_text,
        color: h.color,
        startIndex: h.start_index,
        endIndex: h.end_index,
      }));

      setHighlights(mappedHighlights);
      // 3. Save to IndexedDB
      torahDB.saveUserData('highlights', mappedHighlights).catch(() => {});
    } catch (error: any) {
      if (isIgnored()) return;
      console.error("Error loading highlights:", error);
      toast.error("שגיאה בטעינת הדגשות");
    } finally {
      if (!isIgnored()) setLoading(false);
    }
  };

  const addHighlight = async (highlight: Omit<Highlight, "id">) => {
    if (!user) {
      toast.error("יש להתחבר כדי להוסיף הדגשה");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_highlights")
        .insert({
          user_id: user.id,
          pasuk_id: highlight.pasukId,
          highlight_text: highlight.text,
          color: highlight.color,
          start_index: highlight.startIndex,
          end_index: highlight.endIndex,
        })
        .select()
        .single();

      if (error) throw error;

      const newHighlight: Highlight = {
        id: data.id,
        pasukId: data.pasuk_id,
        text: data.highlight_text,
        color: data.color,
        startIndex: data.start_index,
        endIndex: data.end_index,
      };

      setHighlights((prev) => {
        const next = [newHighlight, ...prev];
        torahDB.saveUserData('highlights', next).catch(() => {});
        return next;
      });
      toast.success("ההדגשה נוספה בהצלחה");
    } catch (error: any) {
      console.error("Error adding highlight:", error);
      toast.error("שגיאה בהוספת הדגשה");
    }
  };

  const removeHighlight = async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("user_highlights")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      setHighlights((prev) => {
        const next = prev.filter((h) => h.id !== id);
        torahDB.saveUserData('highlights', next).catch(() => {});
        return next;
      });
      toast.success("ההדגשה נמחקה");
    } catch (error: any) {
      console.error("Error deleting highlight:", error);
      toast.error("שגיאה במחיקת הדגשה");
    }
  };

  const getHighlightsForPasuk = useCallback((pasukId: string) => {
    return highlights.filter((h) => h.pasukId === pasukId);
  }, [highlights]);

  const value = useMemo(() => ({
    highlights, addHighlight, removeHighlight, getHighlightsForPasuk, loading
  }), [highlights, addHighlight, removeHighlight, getHighlightsForPasuk, loading]);

  return (
    <HighlightsContext.Provider
      value={value}
    >
      {children}
    </HighlightsContext.Provider>
  );
};

export const useHighlights = () => {
  const context = useContext(HighlightsContext);
  if (!context) {
    throw new Error("useHighlights must be used within HighlightsProvider");
  }
  return context;
};
