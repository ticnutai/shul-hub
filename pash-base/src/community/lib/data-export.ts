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
  admin_messages: "הודעות למנהל",
};

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
    const sheet = workbook.addWorksheet(table.slice(0, 31));
    const columns = rows.length > 0 ? Object.keys(rows[0] ?? {}) : [];
    sheet.columns = columns.map((key) => ({ header: key, key, width: 22 }));
    sheet.getRow(1).font = { bold: true };
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
    throw new Error("קובץ ה-JSON אינו תקין");
  }
  const tables =
    parsed && typeof parsed === "object" && "tables" in (parsed as Record<string, unknown>)
      ? (parsed as ExportBundle).tables
      : (parsed as ExportData);
  if (!tables || typeof tables !== "object") throw new Error("מבנה קובץ ה-JSON אינו נתמך");

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
    const sheet = workbook.getWorksheet(table.slice(0, 31));
    if (!sheet) continue;
    const headerRow = sheet.getRow(1);
    const columns: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
      columns[colNumber] = String(cell.value ?? "");
    });

    const rows: ExportRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
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
  return Promise.reject(new Error("סוג הקובץ אינו נתמך. יש להעלות קובץ JSON או Excel (xlsx)."));
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
