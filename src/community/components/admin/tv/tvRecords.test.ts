import { describe, expect, it } from "vitest";
import { DEFAULT_TV_CONFIG, normalizeTvConfig, type TvConfig } from "@/tv/config";
import { isHidden, makeBoardEdit, setHidden, setText, toggleFlip } from "@/tv/boardEdit";
import { buildSlides, type BoardData } from "@/tv/useBoardData";
import { applyRecordEdits, isAllowedEdit, moveAnnouncement, withRecordEdit } from "./tvRecords";

const base = (): TvConfig => structuredClone(DEFAULT_TV_CONFIG);

const ann = (id: string, title: string, sort_order = 0, created_at = "2026-09-01") =>
  ({ id, title, body: "", sort_order, created_at, expires_at: null, pinned: false, image_url: null }) as never;

const data = (over: Partial<BoardData> = {}): BoardData => ({
  settings: { id: "s1", name: "בית הכנסת", address: "רחוב" } as never,
  minyanim: [],
  categories: [],
  announcements: [],
  shiurim: [],
  stale: false,
  anyLoaded: true,
  sync: { status: "live", lastSyncedAt: null },
  ...over,
});

describe("board wording, hiding and moving (tv_config)", () => {
  it("normalize keeps valid edits and drops unsafe ones and the editor-only records", () => {
    const c = normalizeTvConfig({
      texts: { "header.title": "אושר של יהודי", "bad key!": "x", "heading.prayer": "y".repeat(500) },
      hidden: ["zman.alot", "zman.alot", "<script>", 5],
      flipped: ["header", "sideways"],
      _records: [{ table: "announcements", id: "a", field: "title", value: "t" }],
    });
    expect(c.texts).toEqual({ "header.title": "אושר של יהודי", "heading.prayer": "y".repeat(300) });
    expect(c.hidden).toEqual(["zman.alot"]);
    expect(c.flipped).toEqual(["header"]);
    expect(c._records).toBeUndefined();
  });

  it("an old config without the new fields still loads (existing TVs)", () => {
    const c = normalizeTvConfig({ theme: "royal" });
    expect(c.texts).toEqual({});
    expect(c.hidden).toEqual([]);
    expect(c.flipped).toEqual([]);
  });

  it("hiding the ribbon items uses the existing header switches", () => {
    let c = setHidden(base(), "header.parasha", true);
    expect(c.header.parasha).toBe(false);
    expect(c.hidden).toEqual([]);
    expect(isHidden(c, "header.parasha")).toBe(true);
    c = setHidden(c, "header.title", true);
    expect(c.hidden).toEqual(["header.title"]);
    expect(isHidden(setHidden(c, "header.title", false), "header.title")).toBe(false);
  });

  it("text falls back to the default when empty, and reset removes the override", () => {
    const c = setText(base(), "header.title", "   ");
    expect(makeBoardEdit(c, false).text("header.title", "ברירת מחדל")).toBe("ברירת מחדל");
    const d = setText(c, "header.title", "חדש");
    expect(makeBoardEdit(d, false).text("header.title", "x")).toBe("חדש");
    expect(setText(d, "header.title", null).texts).toEqual({});
  });

  it("marks elements only while editing", () => {
    expect(makeBoardEdit(base(), false).attr("header.title")).toEqual({});
    expect(makeBoardEdit(base(), true).attr("header.title")).toEqual({ "data-edit": "header.title" });
  });

  it("flip toggles on and off", () => {
    const c = toggleFlip(base(), "prayer");
    expect(c.flipped).toEqual(["prayer"]);
    expect(toggleFlip(c, "prayer").flipped).toEqual([]);
  });
});

describe("content edits (records)", () => {
  it("replaces a pending edit of the same field instead of stacking", () => {
    let c = withRecordEdit(base(), { table: "announcements", id: "a", field: "title", value: "1" });
    c = withRecordEdit(c, { table: "announcements", id: "a", field: "title", value: "2" });
    c = withRecordEdit(c, { table: "announcements", id: "a", field: "body", value: "b" });
    expect(c._records).toEqual([
      { table: "announcements", id: "a", field: "title", value: "2" },
      { table: "announcements", id: "a", field: "body", value: "b" },
    ]);
  });

  it("only allows the fields the board can edit", () => {
    expect(isAllowedEdit({ table: "announcements", id: "a", field: "title", value: "x" })).toBe(true);
    expect(isAllowedEdit({ table: "minyanim", id: "m", field: "time", value: "x" })).toBe(false);
    expect(isAllowedEdit({ table: "settings", id: "s", field: "name", value: "x" })).toBe(true);
    expect(isAllowedEdit({ table: "settings", id: "s", field: "admin_email", value: "x" })).toBe(false);
  });

  it("applies edits and deletions to the preview data", () => {
    const d = data({ announcements: [ann("a", "A"), ann("b", "B")] });
    const c = withRecordEdit(
      withRecordEdit(base(), { table: "announcements", id: "a", field: "title", value: "A2" }),
      { table: "announcements", id: "b", delete: true },
    );
    const out = applyRecordEdits(d, c._records);
    expect(out.announcements?.map((a) => a.title)).toEqual(["A2"]);
    expect(d.announcements?.map((a) => a.title)).toEqual(["A", "B"]); // input untouched
  });

  it("moves an announcement even when every sort_order is equal", () => {
    const list = [ann("a", "A"), ann("b", "B"), ann("c", "C")];
    const c = moveAnnouncement(base(), list, list, "c", -1);
    const out = applyRecordEdits(data({ announcements: list }), c._records);
    expect(out.announcements?.map((a) => a.id)).toEqual(["a", "c", "b"]);
    expect(moveAnnouncement(base(), list, list, "a", -1)._records).toBeUndefined();
  });

  it("moving among the board's announcements keeps hidden ones in place on the website", () => {
    const list = [ann("a", "A"), ann("h", "hidden"), ann("b", "B")];
    const visible = [list[0], list[2]];
    const c = moveAnnouncement(base(), list, visible, "b", -1);
    const out = applyRecordEdits(data({ announcements: list }), c._records);
    expect(out.announcements?.map((a) => a.id)).toEqual(["b", "h", "a"]);
    expect(c._records?.filter((r) => r.id === "h")).toEqual([{ table: "announcements", id: "h", field: "sort_order", value: 20 }]);
  });

  it("the synagogue name edit reaches the header data", () => {
    const c = withRecordEdit(base(), { table: "settings", id: "s1", field: "name", value: "אושר של יהודי" });
    expect(applyRecordEdits(data(), c._records).settings?.name).toBe("אושר של יהודי");
  });

  it("items hidden from the board leave the slides (and the website data alone)", () => {
    const d = data({ announcements: [ann("a", "A"), ann("b", "B")] });
    const c = setHidden(base(), "ann:a", true);
    const slides = buildSlides(d, c, new Date("2026-09-18T10:00:00Z"), {} as never);
    const annSlides = slides.filter((s) => s.kind === "announcements");
    expect(annSlides.flatMap((s) => (s.kind === "announcements" ? s.items.map((i) => i.id) : []))).toEqual(["b"]);
    expect(d.announcements).toHaveLength(2);
  });
});
