import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Download, FileJson, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EXPORTABLE_TABLES,
  countRows,
  downloadAsExcel,
  downloadAsJson,
  fetchAllData,
  importData,
  parseImportFile,
  tableLabel,
  type ExportData,
  type ExportableTable,
  type ImportTableResult,
} from "@community/lib/data-export";

export function DataExportImportAdmin() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState<"json" | "excel" | null>(null);
  const [preview, setPreview] = useState<ExportData | null>(null);
  const [selectedTables, setSelectedTables] = useState<Set<ExportableTable>>(
    new Set(EXPORTABLE_TABLES),
  );
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportTableResult[] | null>(null);

  async function handleExport(format: "json" | "excel") {
    setExporting(format);
    try {
      const data = await fetchAllData();
      if (format === "json") downloadAsJson(data);
      else await downloadAsExcel(data);
      toast.success("הייצוא הושלם בהצלחה");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "הייצוא נכשל");
    } finally {
      setExporting(null);
    }
  }

  async function handleFileSelected(file: File) {
    try {
      const data = await parseImportFile(file);
      setPreview(data);
      setSelectedTables(new Set(EXPORTABLE_TABLES.filter((t) => (data[t]?.length ?? 0) > 0)));
      setResults(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "קריאת הקובץ נכשלה");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function confirmImport() {
    if (!preview) return;
    setImporting(true);
    try {
      const tables = EXPORTABLE_TABLES.filter((t) => selectedTables.has(t));
      const outcome = await importData(preview, tables);
      setResults(outcome);
      const failed = outcome.filter((r) => r.error);
      const importedTotal = outcome.reduce((sum, r) => sum + r.imported, 0);
      if (failed.length === 0) {
        toast.success(`יובאו ${importedTotal} רשומות בהצלחה`);
        setPreview(null);
      } else {
        toast.error(`הייבוא הושלם עם שגיאות ב-${failed.length} טבלאות`);
      }
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "הייבוא נכשל");
    } finally {
      setImporting(false);
    }
  }

  const counts = preview ? countRows(preview) : null;

  return (
    <div className="space-y-6">
      <div className="card-elev space-y-4 p-6">
        <div>
          <h2 className="font-semibold">ייצוא נתונים</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            הורדת כל תוכן האתר — הגדרות, מניינים, מודעות, שיעורים, חברותות, בקשות חברותא והודעות —
            לקובץ אחד. ניתן להשתמש כגיבוי או לעריכה חיצונית לפני ייבוא חוזר.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => handleExport("excel")} disabled={exporting !== null}>
            <FileSpreadsheet className="size-4" />
            {exporting === "excel" ? "מייצא…" : "ייצוא ל-Excel"}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport("json")}
            disabled={exporting !== null}
          >
            <FileJson className="size-4" />
            {exporting === "json" ? "מייצא…" : "ייצוא ל-JSON"}
          </Button>
        </div>
      </div>

      <div className="card-elev space-y-4 p-6">
        <div>
          <h2 className="font-semibold">ייבוא נתונים</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            העלאת קובץ Excel או JSON שיוצא מהאתר (או שנערך לפי אותו מבנה). רשומות עם{" "}
            <code className="rounded bg-muted px-1">id</code> קיים יעודכנו; רשומות חדשות ללא{" "}
            <code className="rounded bg-muted px-1">id</code> ידלגו. אין מחיקה או יצירה של רשומות
            חדשות — הייבוא מעדכן וממזג רשומות מזוהות בלבד.
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.xlsx,.xlsm"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileSelected(file);
            }}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="size-4" />
            בחירת קובץ לייבוא
          </Button>
        </div>
      </div>

      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>אישור ייבוא נתונים</DialogTitle>
            <DialogDescription>
              בחר אילו טבלאות לייבא. הפעולה תעדכן ותמזג רשומות קיימות לפי מזהה בטבלאות הנבחרות בלבד.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-72 space-y-2 overflow-y-auto">
            {EXPORTABLE_TABLES.map((table) => {
              const count = counts?.[table] ?? 0;
              const result = results?.find((r) => r.table === table);
              return (
                <label
                  key={table}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedTables.has(table)}
                      disabled={count === 0}
                      onCheckedChange={(checked) =>
                        setSelectedTables((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(table);
                          else next.delete(table);
                          return next;
                        })
                      }
                    />
                    {tableLabel(table)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {result
                      ? result.error
                        ? `שגיאה: ${result.error}`
                        : `יובאו ${result.imported}`
                      : `${count} רשומות`}
                  </span>
                </label>
              );
            })}
          </div>

          {results?.some((r) => r.error) && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>חלק מהטבלאות לא יובאו בהצלחה. ניתן לנסות שוב לאחר תיקון הקובץ.</span>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>
              ביטול
            </Button>
            <Button onClick={confirmImport} disabled={importing || selectedTables.size === 0}>
              <Download className="size-4" />
              {importing ? "מייבא…" : "אישור ייבוא"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
