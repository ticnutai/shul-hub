/**
 * The library's order: the gabbai's folders, which folder each item stands
 * in, its tags, and the favourites. Items are kits and saved parts, by id
 * (a saved part as "part:<id>"); one that was never placed stands in its home
 * folder - a kit in its topic (catalogCategories.ts), one's own in "הערכות
 * שלי". Only the order is kept here, never the items: an item gone leaves
 * nothing but a name no one reads.
 */
export interface LibraryFolder {
  id: string;
  name: string;
}

export interface Library {
  /** The gabbai's own folders, in their order (the topic folders are always there, after them). */
  folders: LibraryFolder[];
  /** Where an item was put, by its id: a folder's id. */
  place: Record<string, string>;
  /** The tags of an item, by its id. */
  tags: Record<string, string[]>;
  /** The items starred, shown first of all. */
  favorites: string[];
}

export const EMPTY_LIBRARY: Library = { folders: [], place: {}, tags: {}, favorites: [] };

export const MAX_FOLDERS = 40;
export const MAX_TAGS = 8;
// Hebrew too, and a space: the topics' folders are "topic:שבת", "topic:ראש חודש" - without them a kit put there
// went back to its own folder at the next load (18.10.2026).
const ID = /^[\w֐-׿: -]{1,90}$/;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function normalizeLibrary(raw: unknown): Library {
  if (!raw || typeof raw !== "object") return structuredClone(EMPTY_LIBRARY);
  const r = raw as Record<string, unknown>;
  const seen = new Set<string>();
  const folders = (Array.isArray(r.folders) ? r.folders : []).slice(0, MAX_FOLDERS).flatMap((f): LibraryFolder[] => {
    const id = text(f?.id, 60), name = text(f?.name, 40);
    if (!id.startsWith("f_") || !ID.test(id) || !name || seen.has(id)) return [];
    seen.add(id);
    return [{ id, name }];
  });
  const place: Record<string, string> = {};
  if (r.place && typeof r.place === "object")
    for (const [k, v] of Object.entries(r.place as Record<string, unknown>).slice(0, 500))
      if (ID.test(k) && typeof v === "string" && ID.test(v)) place[k] = v;
  const tags: Record<string, string[]> = {};
  if (r.tags && typeof r.tags === "object")
    for (const [k, v] of Object.entries(r.tags as Record<string, unknown>).slice(0, 500)) {
      const list = Array.isArray(v) ? [...new Set(v.map((t) => text(t, 20)).filter(Boolean))].slice(0, MAX_TAGS) : [];
      if (ID.test(k) && list.length) tags[k] = list;
    }
  const favorites = Array.isArray(r.favorites) ? [...new Set(r.favorites.filter((v): v is string => typeof v === "string" && ID.test(v)))].slice(0, 200) : [];
  return { folders, place, tags, favorites };
}

export const newFolderId = () => `f_${crypto.randomUUID().slice(0, 12)}`;

/** The folder an item stands in: where it was put (if that folder is there), else its home. */
export function folderOf(lib: Library, id: string, home: string, known: ReadonlySet<string>): string {
  const put = lib.place[id];
  return put && known.has(put) ? put : home;
}

/** Items put in a folder - or, with `home` the folder they belong to anyway, put back there. */
export function putInFolder(lib: Library, ids: string[], folder: string, homes: Record<string, string>): Library {
  const place = { ...lib.place };
  for (const id of ids) {
    if (homes[id] === folder) delete place[id];
    else place[id] = folder;
  }
  return { ...lib, place };
}

/** A folder of one's own gone: what was in it goes back home, nothing is deleted. */
export function removeFolder(lib: Library, folder: string): Library {
  const place = Object.fromEntries(Object.entries(lib.place).filter(([, f]) => f !== folder));
  return { ...lib, folders: lib.folders.filter((f) => f.id !== folder), place };
}

export function toggleFavorite(lib: Library, id: string): Library {
  return { ...lib, favorites: lib.favorites.includes(id) ? lib.favorites.filter((x) => x !== id) : [...lib.favorites, id] };
}

export function addTag(lib: Library, id: string, tag: string): Library {
  const t = tag.trim().slice(0, 20);
  const now = lib.tags[id] ?? [];
  if (!t || now.includes(t) || now.length >= MAX_TAGS) return lib;
  return { ...lib, tags: { ...lib.tags, [id]: [...now, t] } };
}

export function removeTag(lib: Library, id: string, tag: string): Library {
  const left = (lib.tags[id] ?? []).filter((x) => x !== tag);
  const tags = { ...lib.tags };
  if (left.length) tags[id] = left;
  else delete tags[id];
  return { ...lib, tags };
}

/** Every tag in use, the most used first. */
export function allTags(lib: Library, ids?: ReadonlySet<string>): string[] {
  const count = new Map<string, number>();
  for (const [id, list] of Object.entries(lib.tags)) if (!ids || ids.has(id)) for (const t of list) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "he")).map(([t]) => t);
}

/** A folder moved one step up or down among the gabbai's folders. */
export function moveFolder(lib: Library, folder: string, direction: -1 | 1): Library {
  const at = lib.folders.findIndex((f) => f.id === folder), to = at + direction;
  if (at < 0 || to < 0 || to >= lib.folders.length) return lib;
  const folders = [...lib.folders];
  [folders[at], folders[to]] = [folders[to], folders[at]];
  return { ...lib, folders };
}
