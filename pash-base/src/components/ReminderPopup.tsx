import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell, BookOpen, X } from "lucide-react";
import type { SingleReminder } from "@/hooks/useNotifications";

interface ReminderPopupProps {
  reminder: SingleReminder | null;
  onDismiss: () => void;
}

export function ReminderPopup({ reminder, onDismiss }: ReminderPopupProps) {
  if (!reminder) return null;

  return (
    <Dialog open={!!reminder} onOpenChange={(open) => !open && onDismiss()}>
      <DialogContent className="sm:max-w-[400px] text-center" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2 text-xl">
            <Bell className="h-6 w-6 text-primary animate-bounce" />
            <span>תזכורת!</span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-6 space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <p className="text-lg font-semibold">{reminder.message}</p>
          <p className="text-sm text-muted-foreground">{reminder.label}</p>
        </div>

        <div className="flex gap-2 justify-center">
          <Button onClick={onDismiss} variant="outline" className="gap-2">
            <X className="h-4 w-4" />
            סגור
          </Button>
          <Button onClick={onDismiss} className="gap-2">
            <BookOpen className="h-4 w-4" />
            בואו נלמד!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
