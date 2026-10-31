import { describe, expect, it } from "vitest";
import { shiurDaysLabel, shiurOn } from "./shiurDays";

describe("the days a shiur is given", () => {
  it("בימי חול: every day but Shabbat", () => {
    const s = { schedule_type: "weekdays", day_of_week: 0 };
    expect([0, 1, 2, 3, 4, 5].every((d) => shiurOn(s, d))).toBe(true);
    expect(shiurOn(s, 6)).toBe(false);
    expect(shiurDaysLabel(s)).toBe("בימי חול");
  });

  it("בכל יום and one day of the week, as before", () => {
    expect(shiurOn({ schedule_type: "daily", day_of_week: 0 }, 6)).toBe(true);
    expect(shiurOn({ schedule_type: "weekly", day_of_week: 2 }, 2)).toBe(true);
    expect(shiurOn({ schedule_type: "weekly", day_of_week: 2 }, 3)).toBe(false);
    expect(shiurDaysLabel({ schedule_type: "weekly", day_of_week: 1 })).toBe("יום שני");
    expect(shiurDaysLabel({ schedule_type: "daily" })).toBe("בכל יום");
  });
});
