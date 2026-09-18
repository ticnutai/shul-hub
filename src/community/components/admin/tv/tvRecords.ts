import type { RecordEdit, RecordTable } from "@/tv/config";
import { isAllowedEdit } from "@/tv/records";
import { tvDb } from "./tvAdminData";

/** Pure helpers live with the board (the draft window applies them too). */
export { applyRecordEdits, EDITABLE_FIELDS, isAllowedEdit, moveAnnouncement, pendingValue, withRecordEdit } from "@/tv/records";

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
