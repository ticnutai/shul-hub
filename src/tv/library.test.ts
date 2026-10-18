import { describe, expect, it } from "vitest";
import { addTag, allTags, EMPTY_LIBRARY, folderOf, moveFolder, normalizeLibrary, putInFolder, removeFolder, removeTag, toggleFavorite } from "./library";
import { DEFAULT_TV_CONFIG, normalizeTvConfig } from "./config";

const lib = () => ({ ...structuredClone(EMPTY_LIBRARY), folders: [{ id: "f_a", name: "חגים" }, { id: "f_b", name: "שבתות" }] });

describe("the library's order", () => {
  it("puts items in a folder, and back home without a trace", () => {
    const homes = { d_x: "topic:שבת", d_y: "mine" };
    const known = new Set(["f_a", "f_b", "topic:שבת", "mine"]);
    let l = putInFolder(lib(), ["d_x", "d_y"], "f_a", homes);
    expect(folderOf(l, "d_x", homes.d_x, known)).toBe("f_a");
    l = putInFolder(l, ["d_x"], "topic:שבת", homes);
    expect(l.place).toEqual({ d_y: "f_a" });
    // A folder that is not there: home.
    expect(folderOf({ ...l, place: { d_x: "f_gone" } }, "d_x", homes.d_x, known)).toBe("topic:שבת");
  });

  it("a folder deleted sends what was in it home; folders move", () => {
    const l = removeFolder(putInFolder(lib(), ["d_x"], "f_a", {}), "f_a");
    expect(l.folders.map((f) => f.id)).toEqual(["f_b"]);
    expect(l.place).toEqual({});
    expect(moveFolder(lib(), "f_b", -1).folders.map((f) => f.id)).toEqual(["f_b", "f_a"]);
    expect(moveFolder(lib(), "f_a", -1)).toEqual(lib());
  });

  it("tags and favourites", () => {
    let l = addTag(addTag(addTag(lib(), "d_x", "כחול"), "d_y", "כחול"), "d_y", "זהב");
    expect(addTag(l, "d_x", "כחול")).toBe(l);
    expect(allTags(l)).toEqual(["כחול", "זהב"]);
    l = removeTag(l, "d_y", "זהב");
    expect(l.tags.d_y).toEqual(["כחול"]);
    expect(toggleFavorite(toggleFavorite(l, "d_x"), "d_x").favorites).toEqual([]);
  });

  it("is kept through saving, and what is broken in it dropped", () => {
    const raw = { folders: [{ id: "f_ok", name: "חגים" }, { id: "bad", name: "x" }, { id: "f_empty", name: "" }], place: { d_x: "f_ok", "bad key!": "f_ok" }, tags: { d_x: ["כחול", "כחול", ""] }, favorites: ["d_x", "d_x"] };
    expect(normalizeLibrary(raw)).toEqual({ folders: [{ id: "f_ok", name: "חגים" }], place: { d_x: "f_ok" }, tags: { d_x: ["כחול"] }, favorites: ["d_x"] });
    expect(normalizeTvConfig({ ...DEFAULT_TV_CONFIG, library: raw }).library.folders).toHaveLength(1);
    expect(normalizeLibrary(null)).toEqual(EMPTY_LIBRARY);
  });
});

describe("the topics' folders, in Hebrew", () => {
  it("keep what was put in them through saving and loading", async () => {
    const { normalizeLibrary } = await import("./library");
    const lib = normalizeLibrary(JSON.parse(JSON.stringify({ folders: [], place: { d_abc123: "topic:שבת", d_def456: "topic:ראש חודש" }, tags: {}, favorites: [] })));
    expect(lib.place).toEqual({ d_abc123: "topic:שבת", d_def456: "topic:ראש חודש" });
  });
});
