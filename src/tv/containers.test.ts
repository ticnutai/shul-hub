import { describe, expect, it } from "vitest";
import { newElement, type BoardElement } from "./elements";
import {
  changeContainer, containerName, containerTree, deleteContainer, duplicateContainer,
  fitIntoContainer, gatherIntoContainer, moveLayer, newContainerParts, normalizeContainers, partsOf, takeOut, writeContainers,
} from "./containers";
import { BUILTIN_DESIGNS } from "./designs";
import { DEFAULT_TV_CONFIG, normalizeTvConfig } from "./config";

const part = (id: string, kind: BoardElement["kind"], x: number, y: number, w: number, h: number, more: Partial<BoardElement> = {}): BoardElement =>
  ({ ...newElement(kind), id, name: id, x, y, width: w, height: h, ...more });

/** Two arches, each a frame with a heading and its content; a column alone. */
const board = () => [
  part("frame_r", "frame", 60, 20, 30, 60),
  part("head_r", "text", 62, 22, 26, 8, { text: "זמני תפילות" }),
  part("list_r", "text", 62, 32, 26, 40, { binding: "prayers" }),
  part("frame_l", "frame", 10, 20, 30, 60),
  part("head_l", "text", 12, 22, 26, 8, { text: "שיעורים" }),
  part("column", "column", 45, 10, 8, 80),
];

describe("containers read off a board that has none written", () => {
  it("are its sections, named by their headings; a part alone stands on the background", () => {
    const tree = containerTree(board(), []);
    expect(tree.containers.map((c) => [c.name, c.parts, c.saved])).toEqual([
      ["זמני תפילות", ["frame_r", "head_r", "list_r"], false],
      ["שיעורים", ["frame_l", "head_l"], false],
    ]);
    expect(tree.loose).toEqual(["column"]);
  });

  it("are written down once: each part takes its container's group, each container a record", () => {
    const written = writeContainers({ elements: board(), containers: [] });
    const tree = containerTree(written.elements, written.containers);
    expect(tree.containers.every((c) => c.saved)).toBe(true);
    expect(written.elements.find((e) => e.id === "head_r")!.group).toBe(written.elements.find((e) => e.id === "frame_r")!.group);
    expect(written.elements.find((e) => e.id === "column")!.group).toBeNull();
    // Written again: nothing changes.
    expect(writeContainers(written)).toEqual(written);
  });

  it("read every kit there is without losing a part", () => {
    for (const d of BUILTIN_DESIGNS.filter((x) => x.values.screenLayout === "composition")) {
      const els = d.values.elements!;
      const tree = containerTree(els, []);
      const all = [...tree.containers.flatMap((c) => c.parts), ...tree.loose].sort();
      expect(all).toEqual(els.map((e) => e.id).sort());
    }
  });
});

describe("a container changed", () => {
  const start = () => writeContainers({ elements: board(), containers: [] });
  const idOf = (b: ReturnType<typeof start>, name: string) => containerTree(b.elements, b.containers).containers.find((c) => c.name === name)!.id;

  it("one layer up: all of it over its neighbour, together", () => {
    const b = start();
    const lessons = idOf(b, "שיעורים");
    const tree = containerTree(b.elements, b.containers);
    // The lessons stand over the prayers already; one step up - over the column.
    const up = moveLayer(b, partsOf(tree, lessons), null, "up");
    expect(up.map((e) => e.id)).toEqual(["frame_r", "head_r", "list_r", "column", "frame_l", "head_l"]);
    const down = moveLayer({ elements: up, containers: b.containers }, partsOf(tree, lessons), null, "down");
    expect(down.map((e) => e.id)).toEqual(["frame_r", "head_r", "list_r", "frame_l", "head_l", "column"]);
  });

  it("duplicated: new parts, a new container named a copy, laid over the original", () => {
    const b = start();
    const prayers = idOf(b, "זמני תפילות");
    const d = duplicateContainer(b, prayers);
    expect(d.elements).toHaveLength(9);
    expect(d.ids).toHaveLength(3);
    expect(d.containers.find((c) => c.id === d.copy)!.name).toBe("זמני תפילות (עותק)");
    expect(d.elements.slice(3, 6).map((e) => e.id)).toEqual(d.ids);
    expect(new Set(d.elements.filter((e) => d.ids.includes(e.id)).map((e) => e.group))).toEqual(new Set([d.copy]));
  });

  it("deleted with all in it; gathered from parts; a part taken out stands alone", () => {
    const b = start();
    const gone = deleteContainer(b, idOf(b, "שיעורים"));
    expect(gone.elements.map((e) => e.id)).toEqual(["frame_r", "head_r", "list_r", "column"]);
    expect(gone.containers.map((c) => c.name)).toEqual(["זמני תפילות"]);

    const g = gatherIntoContainer(b, ["column"], "עמוד");
    expect(containerTree(g.elements, g.containers).containers.find((c) => c.id === g.id)!.parts).toEqual(["column"]);

    const out = takeOut(b, "head_r");
    const tree = containerTree(out.elements, out.containers);
    expect(tree.loose).toContain("head_r");
    expect(tree.containers.find((c) => c.name === "זמני תפילות")!.parts).toEqual(["frame_r", "list_r"]);
  });

  it("renamed, put inside another, never inside itself", () => {
    const b = start();
    const prayers = idOf(b, "זמני תפילות"), lessons = idOf(b, "שיעורים");
    const inside = changeContainer(changeContainer(b, prayers, { name: "תפילות" }), lessons, { parent: prayers });
    const tree = containerTree(inside.elements, inside.containers);
    expect(tree.containers.find((c) => c.id === lessons)!.parent).toBe(prayers);
    expect(partsOf(tree, prayers)).toEqual(["frame_r", "head_r", "list_r", "frame_l", "head_l"]);
    // A ring is refused.
    expect(changeContainer(inside, prayers, { parent: lessons }).containers.find((c) => c.id === prayers)!.parent).toBeNull();
  });
});

describe("the containers' records", () => {
  it("are kept through saving, and what is broken in them is dropped", () => {
    const raw = [
      { id: "a", name: "ראשי", parent: null, shape: "dome" },
      { id: "b", name: "", parent: "a", shape: "star" },
      { id: "c", name: "יתום", parent: "nowhere" },
      { id: "bad id!", name: "x" },
      { id: "a", name: "כפול" },
    ];
    expect(normalizeContainers(raw)).toEqual([
      { id: "a", name: "ראשי", parent: null, shape: "dome" },
      { id: "b", name: "קונטיינר", parent: "a" },
      { id: "c", name: "יתום", parent: null },
    ]);
    expect(normalizeTvConfig({ ...DEFAULT_TV_CONFIG, containers: raw }).containers).toHaveLength(3);
  });

  it("are named as the gabbai sees them", () => {
    expect(containerName([part("f", "frame", 0, 0, 10, 10, { name: "מסגרת שיעורים" })])).toBe("שיעורים");
    expect(containerName([part("t", "text", 0, 0, 10, 10, { binding: "zmanim" })])).toBe("זמני היום");
  });
});

describe("two containers read with the same heading", () => {
  it("are told apart by where they stand", () => {
    const els = [
      part("fr", "frame", 65, 20, 30, 60), part("hr", "text", 67, 22, 26, 8, { text: "זמני תפילות" }),
      part("fl", "frame", 5, 20, 30, 60), part("hl", "text", 7, 22, 26, 8, { text: "זמני תפילות" }),
    ];
    expect(containerTree(els, []).containers.map((c) => c.name)).toEqual(["זמני תפילות (ימין)", "זמני תפילות (שמאל)"]);
  });
});

describe("a picture put into a container", () => {
  const made = newContainerParts({ x: 60, y: 20, width: 30, height: 50 }, "dome");
  const picture: BoardElement = { ...newElement("image"), x: 5, y: 5, width: 20, height: 20, image: "https://x/p.png", name: "תפילין" };
  const start = { elements: [...made.parts, picture], containers: [made.container] };

  it("fills the container's board, in its shape, over the board and under the frame and the heading", () => {
    const { elements } = fitIntoContainer(start, picture.id, made.container.id);
    const p = elements.find((e) => e.id === picture.id)!;
    expect(p.group).toBe(made.container.id);
    expect(p.shape).toBe("dome");
    expect(p.fit).toBe("cover");
    expect(p.x).toBeGreaterThan(60);
    expect(p.x + p.width).toBeLessThan(90);
    expect(p.y + p.height).toBeLessThan(70);
    const order = elements.map((e) => e.name);
    expect(order.indexOf("תפילין")).toBe(order.indexOf("לוח הקונטיינר") + 1);
    expect(order.indexOf("תפילין")).toBeLessThan(order.indexOf("מסגרת הקונטיינר"));
  });

  it("follows the container when fitted again after it changed", () => {
    const once = fitIntoContainer(start, picture.id, made.container.id);
    const moved = { ...once, elements: once.elements.map((e) => (e.name === "לוח הקונטיינר" ? { ...e, x: 10, width: 40 } : e)) };
    const p = fitIntoContainer(moved, picture.id, made.container.id).elements.find((e) => e.id === picture.id)!;
    expect(p.x).toBeGreaterThan(10);
    expect(p.width).toBeGreaterThan(30);
  });

  it("a container of words alone (a kit's painted arch): the picture over what lies there, its words over the picture", () => {
    const words = { ...newElement("text"), id: "w1", name: "שיעורים", x: 70, y: 30, width: 20, height: 40, group: "c_words" };
    const painted = { ...newElement("image"), id: "arch", name: "קשת מצוירת", x: 65, y: 25, width: 30, height: 50, image: "x.png", crop: { x: 0, y: 0, width: 1, height: 1 } } as BoardElement;
    const b = { elements: [words, painted, picture], containers: [{ id: "c_words", name: "שיעורים", parent: null }] };
    const order = fitIntoContainer(b, picture.id, "c_words").elements.map((e) => e.id);
    expect(order).toEqual(["arch", picture.id, "w1"]);
  });

  it("a kit's painted frame (solid inside): the picture over it, inside its edge, under the words", () => {
    const frame = { ...newElement("image"), id: "f", name: "מסגרת שיעורים", x: 60, y: 20, width: 30, height: 60, image: "k.webp", group: "c_k" } as BoardElement;
    const words = { ...newElement("text"), id: "w", name: "שיעורים", x: 65, y: 30, width: 20, height: 40, group: "c_k" };
    const b = { elements: [frame, words, picture], containers: [{ id: "c_k", name: "שיעורים", parent: null }] };
    const out = fitIntoContainer(b, picture.id, "c_k").elements;
    expect(out.map((e) => e.id)).toEqual(["f", picture.id, "w"]);
    const p = out.find((e) => e.id === picture.id)!;
    expect(p.x).toBeGreaterThan(62);
  });

  it("leaves the board as it was for a container that is not there", () => {
    expect(fitIntoContainer(start, picture.id, "c_none").elements.find((e) => e.id === picture.id)!.x).toBe(5);
  });
});
