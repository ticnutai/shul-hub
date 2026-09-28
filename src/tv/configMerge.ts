/**
 * Saving what was changed here, not the whole board as it was when the page opened.
 *
 * The editor used to write its entire draft over the stored row. A draft is a
 * copy taken when the page opened, so anything that changed the board since -
 * another window, another administrator, a fix made on the server - was
 * silently put back by the next "שמור ושדר". That is how the synagogue's name
 * on the board of תורה ואהבתה came back after it had been removed: an editor
 * open from before still held the old name, and saving wrote it again.
 *
 * So both directions are a three-way merge against what the editor started
 * from (`base`):
 *  - what the editor changed wins, because that is what its user just did;
 *  - what it did not touch takes whatever the server has now.
 * Only a field changed in both places has to choose, and there the person
 * pressing save wins - they are looking at it.
 *
 * Objects merge key by key. Arrays and values are whole: the list of screens
 * is one decision, and merging two lists item by item would invent a third
 * list nobody made.
 */

type Json = unknown;

const isPlainObject = (v: Json): v is Record<string, Json> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Equal as data - key order does not count, since the database reorders keys. */
export function sameJson(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => sameJson(x, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a).filter((k) => a[k] !== undefined);
    const kb = Object.keys(b).filter((k) => b[k] !== undefined);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => sameJson(a[k], b[k]));
  }
  return false;
}

/**
 * `mine` and `theirs` both started from `base`; keep both sets of changes.
 * `undefined` means absent, so a key one side removed stays removed.
 */
export function mergeJson(base: Json, mine: Json, theirs: Json): Json {
  if (sameJson(mine, base)) return theirs;
  if (sameJson(theirs, base) || sameJson(mine, theirs)) return mine;
  if (isPlainObject(mine) && isPlainObject(theirs)) {
    const from = isPlainObject(base) ? base : {};
    const out: Record<string, Json> = {};
    for (const key of new Set([...Object.keys(theirs), ...Object.keys(mine)])) {
      const value = mergeJson(from[key], mine[key], theirs[key]);
      if (value !== undefined) out[key] = value;
    }
    return out;
  }
  // Changed in both places, differently: the save being made now wins.
  return mine;
}

export function mergeConfig<T>(base: T, mine: T, theirs: T): T {
  return mergeJson(base, mine, theirs) as T;
}
