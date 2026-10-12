import ExcelJS from "exceljs";
import { supabase } from "@community/integrations/supabase/client";
import type { Tables } from "@community/integrations/supabase/types";

/**
 * Tables covered by the site-wide export/import feature.
 * Order matters for import: rows are upserted in this order so that
 * foreign keys (e.g. shiurim.category_id -> shiur_categories.id) resolve
 * before the rows that reference them.
 *
 * Deliberately excluded:
 * - user_roles / auth users: role management has its own admin flow and
 *   importing roles blind is a privilege-escalation risk.
 * - notification_preferences / user_ui_preferences: personal per-user data,
 *   not "site content", and not fully readable by an admin under RLS.
 * - migration_logs: internal audit trail, not user-editable content.
 */
export const EXPORTABLE_TABLES = [
  "settings",
  "shiur_categories",
  "minyanim",
  "announcements",
  "shiurim",
  "chavrutot",
  "chavruta_requests",
  "admin_messages",
] as const;

export type ExportableTable = (typeof EXPORTABLE_TABLES)[number];

const TABLE_LABELS: Record<ExportableTable, string> = {
  settings: "הגדרות",
  shiur_categories: "קטגוריות שיעורים",
  minyanim: "מניינים",
  announcements: "מודעות",
  shiurim: "שיעורים",
  chavrutot: "חברותות",
  chavruta_requests: "בקשות חברותא",
  admin_messages: "הודעות לגבאי",
};

/**
 * The columns' names in Hebrew, for the spreadsheet: a gabbai opening the
 * file reads "שעה קבועה", not fixed_time. The file keeps the real names too,
 * in a hidden second row, so it can be imported back exactly.
 */
const COLUMN_LABELS: Record<string, string> = {
  id: "מזהה", community_id: "בית כנסת", created_at: "נוצר", updated_at: "עודכן",
  active: "מוצג", active_from: "מתקיים מתאריך", active_until: "מתקיים עד תאריך",
  address: "כתובת", availability: "זמנים פנויים", body: "תוכן", candle_offset_minutes: "הדלקת נרות - דקות לפני השקיעה",
  category_id: "קטגוריה", city: "עיר", contact: "איש קשר", day_of_week: "יום בשבוע", day_type: "סוג יום",
  description: "תיאור", elevation: "גובה", email: "אימייל", expires_at: "בתוקף עד", fixed_time: "שעה קבועה",
  header_logo: "הלוגו בכותרת", home_header_variant: "תצוגת הכותרת", home_hero: "הרצועה בראש דף הבית",
  home_width: "רוחב בדף הבית", image_path: "קובץ התמונה", image_url: "כתובת התמונה", intent: "מטרה",
  is_read: "נקרא", karovim_logo_desktop_height: "גובה הלוגו במחשב", karovim_logo_desktop_offset_x: "מיקום אופקי של הלוגו במחשב",
  karovim_logo_desktop_offset_y: "מיקום אנכי של הלוגו במחשב", karovim_logo_desktop_width: "רוחב הלוגו במחשב",
  karovim_logo_mobile_height: "גובה הלוגו בטלפון", karovim_logo_mobile_offset_x: "מיקום אופקי של הלוגו בטלפון",
  karovim_logo_mobile_offset_y: "מיקום אנכי של הלוגו בטלפון", karovim_logo_mobile_width: "רוחב הלוגו בטלפון",
  kind: "סוג", label: "שם", latitude: "קו רוחב", level: "רמה", location: "מיקום", logos: "לוגואים",
  longitude: "קו אורך", looking_for_partner: "מחפשים חברותא", minyan_days: "אילו ימים רואים",
  minyan_layout: "פריסת התפילות", name: "שם", note: "הערה", notes: "הערות", notification_enabled: "תזכורת",
  offset_minutes: "הפרש בדקות", partners: "שמות הלומדים", phone: "טלפון", pinned: "מוצמדת", prayer: "תפילה",
  relative_to: "ביחס לזמן", reminder_minutes: "דקות לפני התזכורת", room: "אולם", schedule_type: "תדירות",
  sender_id: "השולח", sender_name: "שם השולח", shabbat_end_minutes: "צאת שבת - דקות אחרי השקיעה",
  share_contact: "פרסום פרטי קשר", show_on_home: "מוצג בדף הבית", sort_order: "מקום ברשימה", status: "מצב",
  study_format: "מסגרת", style: "עיצוב", subject: "נושא", subtitle: "כותרת משנה", teacher: "מגיד השיעור",
  theme: "ערכת נושא", time_mode: "אופן קביעת השעה", time_text: "שעה", title: "כותרת", topic: "נושא הלימוד",
  tzeit_offset_minutes: "צאת הכוכבים - דקות אחרי השקיעה", category: "קטגוריה", subcategories: "תפילות",
};

/** A column's Hebrew name; a column newer than this list keeps its own name. */
export function columnLabel(key: string): string {
  return COLUMN_LABELS[key] ?? key;
}

/** A sheet's name: the table's Hebrew name (a sheet name is at most 31 letters). */
const sheetName = (table: ExportableTable) => tableLabel(table).slice(0, 31);

export function tableLabel(table: ExportableTable): string {
  return TABLE_LABELS[table];
}

export type ExportRow = Record<string, unknown>;
export type ExportData = Partial<Record<ExportableTable, ExportRow[]>>;

export interface ExportBundle {
  exportedAt: string;
  source: "shul-hub";
  version: 1;
  tables: ExportData;
}

/** Fetches every row from every exportable table using the authenticated admin client. */
export async function fetchAllData(): Promise<ExportData> {
  const result: ExportData = {};
  for (const table of EXPORTABLE_TABLES) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) throw new Error(`שגיאה בשליפת ${tableLabel(table)}: ${error.message}`);
    result[table] = (data ?? []) as ExportRow[];
  }
  return result;
}

function buildBundle(data: ExportData): ExportBundle {
  return {
    exportedAt: new Date().toISOString(),
    source: "shul-hub",
    version: 1,
    tables: data,
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function timestampForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function downloadAsJson(data: ExportData) {
  const bundle = buildBundle(data);
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  downloadBlob(blob, `shul-hub-data-${timestampForFilename()}.json`);
}

/** Flattens a value for a spreadsheet cell: objects/arrays become JSON text. */
function cellValue(value: unknown): ExcelJS.CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return JSON.stringify(value);
  return value as ExcelJS.CellValue;
}

export async function downloadAsExcel(data: ExportData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "shul-hub";
  workbook.created = new Date();

  for (const table of EXPORTABLE_TABLES) {
    const rows = data[table] ?? [];
    const sheet = workbook.addWorksheet(sheetName(table), { views: [{ rightToLeft: true }] });
    const columns = rows.length > 0 ? Object.keys(rows[0] ?? {}) : [];
    sheet.columns = columns.map((key) => ({ header: columnLabel(key), key, width: 22 }));
    sheet.getRow(1).font = { bold: true };
    // The real names, hidden: what the import reads to put each value back in its column.
    const keys = sheet.addRow(columns);
    keys.hidden = true;
    for (const row of rows) {
      sheet.addRow(columns.map((key) => cellValue(row[key])));
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, `shul-hub-data-${timestampForFilename()}.xlsx`);
}

/** Parses an uploaded .json export bundle into the internal ExportData shape. */
export async function parseJsonFile(file: File): Promise<ExportData> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("קובץ הגיבוי אינו תקין");
  }
  const tables =
    parsed && typeof parsed === "object" && "tables" in (parsed as Record<string, unknown>)
      ? (parsed as ExportBundle).tables
      : (parsed as ExportData);
  if (!tables || typeof tables !== "object") throw new Error("מבנה קובץ הגיבוי אינו נתמך");

  const result: ExportData = {};
  for (const table of EXPORTABLE_TABLES) {
    const rows = (tables as Record<string, unknown>)[table];
    if (Array.isArray(rows)) result[table] = rows as ExportRow[];
  }
  return result;
}

/** Parses an uploaded .xlsx file into the internal ExportData shape, matching sheet names to tables. */
export async function parseExcelFile(file: File): Promise<ExportData> {
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);

  const result: ExportData = {};
  for (const table of EXPORTABLE_TABLES) {
    // A file from now (Hebrew sheet names) or from before (the tables' own names).
    const sheet = workbook.getWorksheet(sheetName(table)) ?? workbook.getWorksheet(table.slice(0, 31));
    if (!sheet) continue;
    // From now: Hebrew names in the first row, the real ones in a hidden second.
    // From before: the real names in the first row.
    const keyed = sheet.getRow(2).hidden;
    const headerRow = sheet.getRow(keyed ? 2 : 1);
    const firstData = keyed ? 3 : 2;
    const columns: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
      columns[colNumber] = String(cell.value ?? "");
    });

    const rows: ExportRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber < firstData) return;
      const record: ExportRow = {};
      let hasValue = false;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const key = columns[colNumber];
        if (!key) return;
        const value = cell.value;
        record[key] = value === null || value === undefined ? null : value;
        if (value !== null && value !== undefined && value !== "") hasValue = true;
      });
      if (hasValue) rows.push(record);
    });
    result[table] = rows;
  }
  return result;
}

export function parseImportFile(file: File): Promise<ExportData> {
  if (file.name.toLowerCase().endsWith(".json")) return parseJsonFile(file);
  if (/\.(xlsx|xlsm)$/i.test(file.name)) return parseExcelFile(file);
  return Promise.reject(new Error("סוג הקובץ אינו נתמך. יש להעלות קובץ גיבוי (שמסתיים ב-json) או גיליון אקסל (שמסתיים ב-xlsx)."));
}

export interface ImportTableResult {
  table: ExportableTable;
  attempted: number;
  imported: number;
  error?: string;
}

/**
 * Upserts rows for the given tables (by primary key `id`), in EXPORTABLE_TABLES order.
 * Rows without an `id` are skipped (import is a merge/update operation, not a bulk-insert
 * of brand-new records with server-generated ids).
 */
export async function importData(
  data: ExportData,
  tables: ExportableTable[],
): Promise<ImportTableResult[]> {
  const selected = new Set(tables);
  const results: ImportTableResult[] = [];

  for (const table of EXPORTABLE_TABLES) {
    if (!selected.has(table)) continue;
    const rows = (data[table] ?? []).filter((row) => row["id"] != null && row["id"] !== "");
    if (rows.length === 0) {
      results.push({ table, attempted: 0, imported: 0 });
      continue;
    }
    const { error } = await supabase.from(table).upsert(rows as never, { onConflict: "id" });
    results.push({
      table,
      attempted: rows.length,
      imported: error ? 0 : rows.length,
      ...(error ? { error: error.message } : {}),
    });
  }
  return results;
}

export type ExportRowCounts = Record<ExportableTable, number>;

export function countRows(data: ExportData): ExportRowCounts {
  const counts = {} as ExportRowCounts;
  for (const table of EXPORTABLE_TABLES) counts[table] = data[table]?.length ?? 0;
  return counts;
}

export type { Tables };
