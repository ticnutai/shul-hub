import { describe, expect, it } from "vitest";
import { AI_INTAKE_EVENT_KEYS, AI_INTAKE_SCHEMA } from "../../../supabase/functions/_shared/aiIntakePrompt";
import { SPECIAL_DAYS } from "./specialDays";

describe("the עוזר חכם answer schema", () => {
  it("knows exactly the special days the site does, less the state's", () => {
    // Written out in the shared prompt (it runs in Deno too); this keeps it from drifting.
    expect([...AI_INTAKE_EVENT_KEYS].sort()).toEqual(SPECIAL_DAYS.filter((d) => !d.national).map((d) => d.key).sort());
  });

  it("can propose a festival's tab and a dated one, not only an everyday tab", () => {
    const minyan = (AI_INTAKE_SCHEMA.properties.minyanim as { items: { properties: Record<string, unknown>; required: string[] } }).items;
    for (const f of ["new_category_event", "new_category_from", "new_category_until"]) {
      expect(minyan.properties).toHaveProperty(f);
      expect(minyan.required).toContain(f);
    }
  });
});
