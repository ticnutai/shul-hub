/**
 * The list of parts, drawn and clicked: the side buttons move a part with its
 * frame, and every kind of live content can be added - not only the three
 * that once had buttons of their own.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_TV_CONFIG, type TvConfig } from "@/tv/config";
import { BINDING_LABELS, ELEMENT_BINDINGS, boundsOf, normalizeElements, sectionOf, sideOf } from "@/tv/elements";
import { PREMIUM_DESIGNS } from "@/tv/premiumDesigns";
import { ElementEditingProvider } from "./ElementEditingProvider";
import { ElementsEditor } from "./ElementsEditor";
import { PartsContent } from "./PartsContent";

afterEach(cleanup);

let latest: TvConfig;
function Harness({ start }: { start: TvConfig }) {
  const [config, setConfig] = useState(start);
  latest = config;
  return (
    <ElementEditingProvider>
      <ElementsEditor config={config} onEdit={(_key, update) => setConfig((c) => update(c))} />
    </ElementEditingProvider>
  );
}
const board = (): TvConfig => ({ ...structuredClone(DEFAULT_TV_CONFIG), ...structuredClone(PREMIUM_DESIGNS[1].values) } as TvConfig);
const sideOfPart = (name: string) => {
  const e = latest.elements.find((x) => x.name === name)!;
  return sideOf(boundsOf(latest.elements, sectionOf(latest.elements, e.id)));
};

describe("ElementsEditor - sides and live content", () => {
  it("puts the lessons on the left and the prayers on the right, with their frames", () => {
    render(<Harness start={board()} />);
    expect(sideOfPart("תפילות היום")).toBe("left");
    expect(screen.getByRole("button", { name: "תפילות היום לשמאל" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "שיעורי היום לשמאל" }));
    expect(sideOfPart("שיעורי היום")).toBe("left");
    expect(sideOfPart("מסגרת שיעורים")).toBe("left");
    expect(sideOfPart("תפילות היום")).toBe("right");
    expect(sideOfPart("כותרת תפילות")).toBe("right");
    expect(screen.getByRole("button", { name: "תפילות היום לימין" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("offers every kind of live content, and adds the announcements in a frame", () => {
    render(<Harness start={board()} />);
    const picker = screen.getByRole("combobox", { name: "איזה תוכן להוסיף" }) as HTMLSelectElement;
    expect(picker.options).toHaveLength(ELEMENT_BINDINGS.length);
    for (const b of ["zmanim", "announcements", "logos", "dafYomi", "seasonal"] as const)
      expect([...picker.options].some((o) => o.textContent?.startsWith(BINDING_LABELS[b]))).toBe(true);
    const before = latest.elements.length;
    fireEvent.change(picker, { target: { value: "announcements" } });
    fireEvent.click(screen.getByRole("button", { name: "הוספה" }));
    // In the board's look: a copy of its arch, its heading and the content.
    const added = latest.elements.slice(before);
    expect(added.map((e) => e.kind).sort()).toEqual(["image", "text", "text"]);
    const content = latest.elements.find((e) => e.binding === "announcements")!;
    expect(content.name).toBe("הודעות");
    // Added in the middle; the side buttons take it, frame and all, to a side.
    expect(sideOfPart("הודעות")).toBe("center");
    expect(sectionOf(latest.elements, content.id)).toHaveLength(3);
    // To the right it goes alone: the centre frame it was dropped onto stays.
    const centre = latest.elements.find((e) => e.name === "מסגרת מרכזית ופמוטים")!;
    fireEvent.click(screen.getByRole("button", { name: "הודעות לימין" }));
    expect(sideOfPart("הודעות")).toBe("right");
    expect(sideOfPart("כותרת הודעות")).toBe("right");
    expect(latest.elements.find((e) => e.name === "מסגרת מרכזית ופמוטים")).toEqual(centre);
    // Where the prayers stand it goes over them: they are not pushed into the middle, over the clock.
    const prayers = latest.elements.find((e) => e.name === "תפילות היום")!;
    fireEvent.click(screen.getByRole("button", { name: "הודעות לשמאל" }));
    expect(sideOfPart("הודעות")).toBe("left");
    expect(latest.elements.find((e) => e.name === "תפילות היום")).toEqual(prayers);
  });
});

function PartsHarness({ start }: { start: TvConfig }) {
  const [config, setConfig] = useState(start);
  latest = config;
  return (
    <ElementEditingProvider>
      <PartsContent config={config} onEdit={(_key, update) => setConfig((c) => update(c))} onManual={() => {}} />
    </ElementEditingProvider>
  );
}
const named = (name: string) => latest.elements.find((e) => e.name === name)!;

describe("PartsContent - the layout tab of a board of parts", () => {
  it("lists the frames on the board, each with what it shows", () => {
    render(<PartsHarness start={board()} />);
    const prayers = screen.getByRole("combobox", { name: "מה מציגה זמני תפילות" }) as HTMLSelectElement;
    expect(prayers.value).toBe("prayers");
    expect(prayers.options).toHaveLength(ELEMENT_BINDINGS.length);
    expect((screen.getByRole("combobox", { name: "מה מציגה שיעורי תורה" }) as HTMLSelectElement).value).toBe("lessons");
  });

  it("makes the arch of the prayers show the day's times: same arch, its heading changed", () => {
    render(<PartsHarness start={board()} />);
    const arch = named("מסגרת תפילות");
    fireEvent.change(screen.getByRole("combobox", { name: "מה מציגה זמני תפילות" }), { target: { value: "zmanim" } });
    const content = latest.elements.find((e) => e.binding === "zmanim")!;
    expect(content.name).toBe("זמני היום");
    expect(latest.elements.some((e) => e.binding === "prayers")).toBe(false);
    expect(named("כותרת זמני היום").text).toBe("זמני היום");
    // The arch itself: the same picture, in the same place.
    const after = latest.elements.find((e) => e.id === arch.id)!;
    expect({ ...after, name: arch.name }).toEqual(arch);
    expect(screen.getByRole("combobox", { name: "מה מציגה זמני היום" })).toBeTruthy();
  });

  it("adds a new frame in the board's own look, and sends it to a side alone", () => {
    render(<PartsHarness start={board()} />);
    const before = latest.elements.length;
    fireEvent.change(screen.getByRole("combobox", { name: "איזו תצוגה להוסיף" }), { target: { value: "announcements" } });
    fireEvent.click(screen.getByRole("button", { name: "הוספה" }));
    const added = latest.elements.slice(before);
    // A copy of an arch of the board - its picture - not a dark box.
    expect(added.some((e) => e.kind === "image" && e.crop)).toBe(true);
    expect(added.some((e) => e.kind === "box")).toBe(false);
    expect(added.find((e) => e.binding === "announcements")).toBeTruthy();
    expect(added.find((e) => e.kind === "text" && !e.binding)?.text).toBe("הודעות");
    expect(sideOfPart("הודעות")).toBe("center");
    const untouched = latest.elements.slice(0, before);
    fireEvent.click(screen.getByRole("button", { name: "הודעות לשמאל" }));
    expect(sideOfPart("הודעות")).toBe("left");
    // The prayers stood there: the new frame stands over them, nothing else moved.
    expect(latest.elements.slice(0, before)).toEqual(untouched);
  });

  it("hides a frame whole and brings it back; a shared frame keeps standing", () => {
    render(<PartsHarness start={board()} />);
    fireEvent.click(screen.getByRole("button", { name: "הסתרת זמני תפילות" }));
    for (const n of ["תפילות היום", "כותרת תפילות", "מסגרת תפילות"]) expect(named(n).hidden).toBe(true);
    expect(named("שיעורי היום").hidden).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "הצגת זמני תפילות" }));
    for (const n of ["תפילות היום", "כותרת תפילות", "מסגרת תפילות"]) expect(named(n).hidden).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "הסתרת פרשת השבוע" }));
    expect(named("פרשת השבוע").hidden).toBe(true);
    expect(named("מסגרת מרכזית ופמוטים").hidden).toBe(false);
    expect(named("התאריך העברי").hidden).toBe(false);
  });

  it("puts the lessons on the left from here too, with their frame", () => {
    render(<PartsHarness start={board()} />);
    fireEvent.click(screen.getByRole("button", { name: "שיעורי תורה לשמאל" }));
    expect(sideOfPart("מסגרת שיעורים")).toBe("left");
    expect(sideOfPart("תפילות היום")).toBe("right");
    expect(screen.getByRole("button", { name: "זמני תפילות לימין" }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("a long notice: shrunk, or the moving curtain", () => {
  it("is chosen per frame, kept through saving, and offered only where content can move", () => {
    render(<PartsHarness start={board()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "איזו תצוגה להוסיף" }), { target: { value: "announcements" } });
    fireEvent.click(screen.getByRole("button", { name: "הוספה" }));
    const fit = screen.getByRole("combobox", { name: "כשלא נכנס - הודעות" }) as HTMLSelectElement;
    expect(fit.value).toBe("");
    expect([...fit.options].map((o) => o.textContent)).toEqual(["הקטנה כדי שייכנס", "גלילה עם עצירות", "וילון רציף"]);
    fireEvent.change(fit, { target: { value: "loop" } });
    const notice = latest.elements.find((e) => e.binding === "announcements")!;
    expect(notice.scroll).toBe("loop");
    expect(normalizeElements(latest.elements).find((e) => e.id === notice.id)!.scroll).toBe("loop");
    expect(screen.getByRole("group", { name: "מהירות הגלילה" })).toBeTruthy();
    // A list pages by default; a clock has nothing to move.
    expect((screen.getByRole("combobox", { name: "כשלא נכנס - שיעורי תורה" }) as HTMLSelectElement).options[0].textContent).toBe("דפדוף בין עמודים");
    expect(screen.queryByRole("combobox", { name: "כשלא נכנס - שעון מחוגים" })).toBeNull();
    fireEvent.change(fit, { target: { value: "" } });
    expect(latest.elements.find((e) => e.id === notice.id)!.scroll).toBeUndefined();
  });
});
