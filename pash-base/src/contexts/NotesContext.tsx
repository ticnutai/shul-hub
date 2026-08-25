/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { torahDB } from "@/utils/torahDB";
import { toast } from "sonner";

export interface Note {
  id: string;
  pasukId: string;
  content: string;
  createdAt: number;
}

export interface PersonalQuestion {
  id: string;
  pasukId: string;
  question: string;
  answer?: string;
  createdAt: number;
}

interface NotesContextType {
  notes: Note[];
  questions: PersonalQuestion[];
  addNote: (pasukId: string, content: string) => void;
  updateNote: (id: string, content: string) => void;
  deleteNote: (id: string) => void;
  getNotesForPasuk: (pasukId: string) => Note[];
  addQuestion: (pasukId: string, question: string) => void;
  updateQuestion: (id: string, question: string, answer?: string) => void;
  deleteQuestion: (id: string) => void;
  getQuestionsForPasuk: (pasukId: string) => PersonalQuestion[];
  loading: boolean;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

export const NotesProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [questions, setQuestions] = useState<PersonalQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Load notes and questions from Supabase
  useEffect(() => {
    if (user) {
      loadNotesAndQuestions();
    } else {
      setNotes([]);
      setQuestions([]);
      setLoading(false);
    }
  }, [user]);

  const loadNotesAndQuestions = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // 1. Load from IndexedDB cache instantly
      const [cachedNotes, cachedQuestions] = await Promise.all([
        torahDB.getUserData('notes'),
        torahDB.getUserData('personal_questions'),
      ]);
      if (cachedNotes || cachedQuestions) {
        if (cachedNotes) setNotes(cachedNotes as Note[]);
        if (cachedQuestions) setQuestions(cachedQuestions as PersonalQuestion[]);
        setLoading(false);
      }

      // 2. Sync from Supabase
      // Load notes
      const { data: notesData, error: notesError } = await supabase
        .from("user_notes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (notesError) throw notesError;

      const mappedNotes: Note[] = (notesData || []).map((note) => ({
        id: note.id,
        pasukId: note.pasuk_id,
        content: note.note_text,
        createdAt: new Date(note.created_at).getTime(),
      }));

      setNotes(mappedNotes);

      // Load personal questions
      const { data: questionsData, error: questionsError } = await supabase
        .from("user_personal_questions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (questionsError) throw questionsError;

      const mappedQuestions: PersonalQuestion[] = (questionsData || []).map((q) => ({
        id: q.id,
        pasukId: q.pasuk_id,
        question: q.question_text,
        answer: q.answer_text || undefined,
        createdAt: new Date(q.created_at).getTime(),
      }));

      setQuestions(mappedQuestions);

      // 3. Save to IndexedDB
      torahDB.saveUserData('notes', mappedNotes).catch(() => {});
      torahDB.saveUserData('personal_questions', mappedQuestions).catch(() => {});
    } catch (error: any) {
      console.error("Error loading notes and questions:", error);
      toast.error("שגיאה בטעינת הערות ושאלות");
    } finally {
      setLoading(false);
    }
  };

  const addNote = useCallback(async (pasukId: string, content: string) => {
    if (!user) {
      toast.error("יש להתחבר כדי להוסיף הערה");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_notes")
        .insert({
          user_id: user.id,
          pasuk_id: pasukId,
          note_text: content,
        })
        .select()
        .single();

      if (error) throw error;

      const newNote: Note = {
        id: data.id,
        pasukId: data.pasuk_id,
        content: data.note_text,
        createdAt: new Date(data.created_at).getTime(),
      };

      setNotes((prev) => {
        const next = [newNote, ...prev];
        torahDB.saveUserData('notes', next).catch(() => {});
        return next;
      });
      toast.success("ההערה נוספה בהצלחה");
    } catch (error: any) {
      console.error("Error adding note:", error);
      toast.error("שגיאה בהוספת הערה");
    }
  }, [user]);

  const updateNote = useCallback(async (id: string, content: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("user_notes")
        .update({ note_text: content })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      setNotes((prev) => {
        const next = prev.map((note) => (note.id === id ? { ...note, content } : note));
        torahDB.saveUserData('notes', next).catch(() => {});
        return next;
      });
      toast.success("ההערה עודכנה");
    } catch (error: any) {
      console.error("Error updating note:", error);
      toast.error("שגיאה בעדכון הערה");
    }
  }, [user]);

  const deleteNote = useCallback(async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("user_notes")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      setNotes((prev) => {
        const next = prev.filter((note) => note.id !== id);
        torahDB.saveUserData('notes', next).catch(() => {});
        return next;
      });
      toast.success("ההערה נמחקה");
    } catch (error: any) {
      console.error("Error deleting note:", error);
      toast.error("שגיאה במחיקת הערה");
    }
  }, [user]);

  const getNotesForPasuk = useCallback((pasukId: string) => {
    return notes.filter((note) => note.pasukId === pasukId);
  }, [notes]);

  const addQuestion = useCallback(async (pasukId: string, question: string) => {
    if (!user) {
      toast.error("יש להתחבר כדי להוסיף שאלה");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_personal_questions")
        .insert({
          user_id: user.id,
          pasuk_id: pasukId,
          question_text: question,
        })
        .select()
        .single();

      if (error) throw error;

      const newQuestion: PersonalQuestion = {
        id: data.id,
        pasukId: data.pasuk_id,
        question: data.question_text,
        answer: data.answer_text || undefined,
        createdAt: new Date(data.created_at).getTime(),
      };

      setQuestions((prev) => {
        const next = [newQuestion, ...prev];
        torahDB.saveUserData('personal_questions', next).catch(() => {});
        return next;
      });
      toast.success("השאלה נוספה בהצלחה");
    } catch (error: any) {
      console.error("Error adding question:", error);
      toast.error("שגיאה בהוספת שאלה");
    }
  }, [user]);

  const updateQuestion = useCallback(async (id: string, question: string, answer?: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("user_personal_questions")
        .update({
          question_text: question,
          answer_text: answer || null,
        })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      setQuestions((prev) => {
        const next = prev.map((q) => (q.id === id ? { ...q, question, answer } : q));
        torahDB.saveUserData('personal_questions', next).catch(() => {});
        return next;
      });
      toast.success("השאלה עודכנה");
    } catch (error: any) {
      console.error("Error updating question:", error);
      toast.error("שגיאה בעדכון שאלה");
    }
  }, [user]);

  const deleteQuestion = useCallback(async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("user_personal_questions")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      setQuestions((prev) => {
        const next = prev.filter((q) => q.id !== id);
        torahDB.saveUserData('personal_questions', next).catch(() => {});
        return next;
      });
      toast.success("השאלה נמחקה");
    } catch (error: any) {
      console.error("Error deleting question:", error);
      toast.error("שגיאה במחיקת שאלה");
    }
  }, [user]);

  const getQuestionsForPasuk = useCallback((pasukId: string) => {
    return questions.filter((q) => q.pasukId === pasukId);
  }, [questions]);

  const value = useMemo(() => ({
    notes,
    questions,
    addNote,
    updateNote,
    deleteNote,
    getNotesForPasuk,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    getQuestionsForPasuk,
    loading,
  }), [notes, questions, addNote, updateNote, deleteNote, getNotesForPasuk, addQuestion, updateQuestion, deleteQuestion, getQuestionsForPasuk, loading]);

  return (
    <NotesContext.Provider
      value={value}
    >
      {children}
    </NotesContext.Provider>
  );
};

export const useNotes = () => {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error("useNotes must be used within NotesProvider");
  }
  return context;
};
