import { describe, expect, it } from "vitest";
import { ADMIN_GROUPS, ADMIN_SECTIONS, groupSections } from "./adminSections";

describe("the sections' groups", () => {
  it("hold every section exactly once", () => {
    const grouped = ADMIN_GROUPS.flatMap((g) => g.sections);
    expect([...grouped].sort()).toEqual(ADMIN_SECTIONS.map((s) => s.value).sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it("leave out what this gabbai has not", () => {
    const groups = groupSections(ADMIN_SECTIONS.filter((s) => s.value !== "tv"));
    expect(groups.flatMap((g) => g.sections.map((s) => s.value))).not.toContain("tv");
    expect(groups.every((g) => g.sections.length > 0)).toBe(true);
  });
});
