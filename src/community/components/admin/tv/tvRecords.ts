import type { RecordEdit, RecordTable, TvConfig } from "@/tv/config";
import type { BoardData } from "@/tv/useBoardData";
import { tvDb } from "./tvAdminData";

/**
 * Content edits made on the board (an announcement's text, a minyan's name,
 * the synagogue's name for the whole site...). They are the same rows the
 * website shows, so they are edited in place - but only when the admin
 * presses "שמור ושדר". Until then they ride in the draft (config._records),
 * which gives them undo/redo and "discard changes" for free, and are laid
 * over the preview data by applyRecordEdits().
 */

/** Fields that may be edited from the board, per table. Anything else is refused. */
export const EDITABLE_FIELDS: Record<RecordTable, readonly string[]> = {
  announcements: ["title", "body", "sort_order"],
  shiurim: ["title", "teacher"],
  minyanim: ["label"],
  settings: ["name", "address"],
};

export function isAllowedEdit(e: RecordEdit): boolean {
  if ("delete" in e) return e.table === "announcements";
  return EDITABLE_FIELDS[e.table]?.includes(e.field) ?? false;
}

/** Adds or replaces the pending edit of one field (or a deletion). */
export function withRecordEdit(config: TvConfig, edit: RecordEdit): TvConfig {
  const same = (e: RecordEdit) =>
    e.table === edit.table && e.id === edit.id && ("delete" in edit ? "delete" in e : !("delete" in e) && e.field === edit.field);
  return { ...config, _records: [...(config._records ?? []).filter((e) => !same(e)), edit] };
}

export function pendingValue(config: TvConfig, table: RecordTable, id: string, field: string): string | number | undefined {
  const e = config._records?.find((r) => r.table === table && r.id === id && !("delete" in r) && r.field === field);
  return e && !("delete" in e) ? e.value : undefined;
}

type Row = { id: string } & Record<string, unknown>;

function patchRows<T extends Row>(rows: T[] | null, table: RecordTable, edits: RecordEdit[]): T[] | null {
  if (!rows) return rows;
  const mine = edits.filter((e) => e.table === table);
  if (!mine.length) return rows;
  const deleted = new Set(mine.filter((e) => "delete" in e).map((e) => e.id));
  return rows
    .filter((r) => !deleted.has(r.id))
    .map((r) => {
      const fields = mine.filter((e) => e.id === r.id && !("delete" in e));
      if (!fields.length) return r;
      const next = { ...r } as Record<string, unknown>;
      for (const e of fields) if (!("delete" in e)) next[e.field] = e.value;
      return next as T;
    });
}

/** The preview's data with the pending edits applied, in the website's order. */
export function applyRecordEdits(data: BoardData, edits: RecordEdit[] | undefined): BoardData {
  if (!edits?.length) return data;
  const announcements = patchRows(data.announcements, "announcements", edits);
  if (announcements && edits.some((e) => e.table === "announcements" && !("delete" in e) && e.field === "sort_order"))
    // Same order as the query: sort_order, then newest first.
    announcements.sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(b.created_at).localeCompare(String(a.created_at)),
    );
  const settings = data.settings ? (patchRows([data.settings], "settings", edits)?.[0] ?? null) : null;
  return {
    ...data,
    settings,
    announcements,
    shiurim: patchRows(data.shiurim, "shiurim", edits),
    minyanim: patchRows(data.minyanim, "minyanim", edits),
  };
}

/**
 * Pending sort_order edits that move one announcement a step earlier or later
 * among `ordered` (the list as currently shown). Every row gets a spaced
 * number, because rows created together often share sort_order 0 and a swap
 * of equal numbers would change nothing.
 */
export function moveAnnouncement(config: TvConfig, ordered: Array<{ id: string }>, id: string, delta: -1 | 1): TvConfig {
  const from = ordered.findIndex((a) => a.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ordered.length) return config;
  const next = [...ordered];
  [next[from], next[to]] = [next[to], next[from]];
  let c = config;
  next.forEach((a, i) => {
    c = withRecordEdit(c, { table: "announcements", id: a.id, field: "sort_order", value: (i + 1) * 10 });
  });
  return c;
}

/**
 * Writes the pending edits, one update per row. Stops at the first failure
 * (the draft is kept, so nothing is lost and the admin can retry).
 */
export async function commitRecordEdits(edits: RecordEdit[] | undefined): Promise<number> {
  const valid = (edits ?? []).filter(isAllowedEdit);
  const deletes = valid.filter((e): e is Extract<RecordEdit, { delete: true }> => "delete" in e);
  const deletedIds = new Set(deletes.map((d) => `${d.table}:${d.id}`));
  const updates = new Map<string, { table: RecordTable; id: string; fields: Record<string, string | number> }>();
  for (const e of valid) {
    if ("delete" in e || deletedIds.has(`${e.table}:${e.id}`)) continue;
    const k = `${e.table}:${e.id}`;
    const u = updates.get(k) ?? { table: e.table, id: e.id, fields: {} };
    u.fields[e.field] = e.value;
    updates.set(k, u);
  }
  let n = 0;
  for (const u of updates.values()) {
    const { error } = await tvDb.from(u.table).update(u.fields).eq("id", u.id);
    if (error) throw new Error(`שמירת התוכן נכשלה (${u.table}): ${error.message}`);
    n += 1;
  }
  for (const d of deletes) {
    const { error } = await tvDb.from(d.table).delete().eq("id", d.id);
    if (error) throw new Error(`מחיקת המודעה נכשלה: ${error.message}`);
    n += 1;
  }
  return n;
}
