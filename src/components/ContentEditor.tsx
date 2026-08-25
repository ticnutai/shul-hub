import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useContent } from "@/contexts/ContentContext";
import { supabase } from "@/integrations/supabase/client";

interface InitialContext {
  type: "title" | "question" | "answer";
  titleId?: number;
  questionId?: number;
}

interface ContentEditorProps {
  pasukId: string;
  pasukText: string;
  trigger?: React.ReactNode;
  initialContext?: InitialContext;
  defaultTab?: "title" | "question" | "answer";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const ContentEditor = ({ 
  pasukId, 
  pasukText, 
  trigger,
  initialContext,
  defaultTab = "title",
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange
}: ContentEditorProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [mefaresh, setMefaresh] = useState("");
  const [isShared, setIsShared] = useState(false);
  
  const { addTitle, addQuestion, addAnswer } = useContent();

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (controlledOnOpenChange || (() => {})) : setInternalOpen;

  const handleSave = async () => {
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("יש להתחבר כדי לשמור תוכן", {
          action: {
            label: "התחבר",
            onClick: () => window.location.href = "/auth"
          }
        });
        return;
      }

      // Always save all filled fields sequentially
      let titleIdToUse = initialContext?.titleId;
      let questionIdToUse = initialContext?.questionId;
      const savedItems: string[] = [];

      // Save title if provided
      if (title.trim()) {
        titleIdToUse = await addTitle(pasukId, title, isShared);
        savedItems.push("הכותרת");
      }

      // Save question if provided and we have a titleId
      if (question.trim() && titleIdToUse) {
        questionIdToUse = await addQuestion(titleIdToUse, question, isShared);
        savedItems.push("השאלה");
      }

      // Save answer if provided, we have mefaresh, and we have a questionId
      if (answer.trim() && mefaresh.trim() && questionIdToUse) {
        await addAnswer(questionIdToUse, mefaresh, answer, isShared);
        savedItems.push("התשובה");
      }

      // Show appropriate success message
      if (savedItems.length > 0) {
        const itemsList = savedItems.join(", ");
        toast.success(`${itemsList} נוספו בהצלחה!`);
      } else {
        toast.warning("יש למלא לפחות שדה אחד");
        return;
      }
      
      setOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving content:", error);
      toast.error("אירעה שגיאה בשמירת התוכן");
    }
  };

  const resetForm = () => {
    setTitle("");
    setQuestion("");
    setAnswer("");
    setMefaresh("");
    setIsShared(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      {!trigger && (
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 hover:bg-primary/10 hover:border-primary transition-all hover:scale-105"
          >
            <Plus className="h-4 w-4" />
            <span>הוסף תוכן</span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent 
        className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto" 
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="text-right text-xl">הוסף תוכן לפסוק</DialogTitle>
          <div className="text-sm text-muted-foreground text-right pt-2 border-t">
            {pasukText}
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">כותרת</Label>
            <Input
              id="title"
              placeholder="לדוגמה: בריאת העולם, מבול נח..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-right"
            />
            <p className="text-xs text-muted-foreground">
              כותרת זו תופיע מעל השאלות והתשובות (חובה)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="question">שאלה (אופציונלי)</Label>
            <Textarea
              id="question"
              placeholder='לדוגמה: מדוע נאמר "בראשית" ולא "תחילה"?'
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="text-right min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mefaresh">שם המפרש (אופציונלי)</Label>
            <Input
              id="mefaresh"
              placeholder='לדוגמה: רש"י, רמב"ן, אבן עזרא...'
              value={mefaresh}
              onChange={(e) => setMefaresh(e.target.value)}
              className="text-right"
            />
            <p className="text-xs text-muted-foreground">
              חובה אם יש תשובה
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="answer">תשובה / פירוש (אופציונלי)</Label>
            <Textarea
              id="answer"
              placeholder="הכנס את הפירוש או התשובה לשאלה..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="text-right min-h-[120px]"
            />
            <p className="text-xs text-muted-foreground">
              דורש שם מפרש ושאלה
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <div className="flex items-center gap-2 ml-auto">
            <Switch
              id="share-toggle"
              checked={isShared}
              onCheckedChange={setIsShared}
            />
            <Label htmlFor="share-toggle" className="text-sm cursor-pointer">
              שתף עם משתמשים אחרים
            </Label>
          </div>
          <Button variant="outline" onClick={() => setOpen(false)}>
            ביטול
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Plus className="h-4 w-4" />
            שמור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
