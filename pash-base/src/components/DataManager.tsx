import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

export const DataManager = () => {
  const handleExport = () => {
    try {
      // Collect all data from localStorage
      const exportData = {
        version: "1.0",
        timestamp: new Date().toISOString(),
        data: {} as Record<string, string | null>
      };

      // Collect all torah-prefixed data from localStorage
      const keysToExport = [
        "torah-font-color-settings",
        "torah-display-settings", 
        "torah-theme",
        "torah-notes",
        "torah-highlights",
        "torah-bookmarks",
        "torah-user-content",
        "torah-favorite-mefarshim",
        "torah-commentary-history",
      ];

      for (const key of keysToExport) {
        const value = localStorage.getItem(key);
        if (value) {
          exportData.data[key] = value;
        }
      }

      // Create blob and download
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json"
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `torah-data-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("הנתונים יוצאו בהצלחה!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("שגיאה בייצוא הנתונים");
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importData = JSON.parse(content);

        if (!importData.version || !importData.data) {
          throw new Error("Invalid backup file format");
        }

        // Restore all data to localStorage
        Object.entries(importData.data).forEach(([key, value]) => {
          if (value) {
            localStorage.setItem(key, value as string);
          }
        });

        toast.success("הנתונים יובאו בהצלחה! טוען מחדש...");
        
        // Reload to apply changes
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (error) {
        console.error("Import error:", error);
        toast.error("שגיאה בייבוא הנתונים - וודא שהקובץ תקין");
      }
    };

    reader.readAsText(file);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          <span>ייצוא/יבוא</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right text-xl">
            ייצוא ויבוא נתונים
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Export Section */}
          <div className="space-y-3">
            <h3 className="font-semibold text-right">ייצוא נתונים</h3>
            <p className="text-sm text-muted-foreground text-right">
              ייצא את כל ההגדרות, ההערות, הסימניות וההדגשות שלך לקובץ JSON
            </p>
            <Button
              onClick={handleExport}
              className="w-full gap-2"
              variant="default"
            >
              <Download className="h-4 w-4" />
              ייצא את כל הנתונים
            </Button>
          </div>

          <div className="border-t pt-6">
            {/* Import Section */}
            <div className="space-y-3">
              <h3 className="font-semibold text-right">ייבוא נתונים</h3>
              <p className="text-sm text-muted-foreground text-right">
                טען קובץ גיבוי קודם כדי לשחזר את כל הנתונים שלך
              </p>
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="import-file"
                  className="cursor-pointer"
                >
                  <div className="flex items-center justify-center gap-2 w-full h-10 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors">
                    <Upload className="h-4 w-4" />
                    <span>בחר קובץ לייבוא</span>
                  </div>
                </Label>
                <input
                  id="import-file"
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </div>
              <p className="text-xs text-muted-foreground text-right">
                ⚠️ שים לב: ייבוא יחליף את כל הנתונים הקיימים
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
