import { describe, expect, it } from "vitest";
import {
  announcementCardStyle,
  normalizeAnnouncementStyle,
  presetAnnouncementStyle,
} from "./announcement-style";

describe("announcement design", () => {
  it("uses the synagogue classic design for old announcements without style data", () => {
    expect(normalizeAnnouncementStyle(null)).toMatchObject({
      preset: "classic",
      background: "#ffffff",
      foreground: "#172c57",
      accent: "#d6a619",
      align: "right",
    });
  });

  it("applies a complete preset", () => {
    expect(presetAnnouncementStyle("gold")).toMatchObject({
      preset: "gold",
      background: "#fffaf0",
      align: "center",
      radius: 20,
      shadow: true,
    });
  });

  it("rejects unsafe colors and clamps numeric design controls", () => {
    const style = normalizeAnnouncementStyle({
      preset: "minimal",
      background: "url(javascript:alert(1))",
      foreground: "red",
      accent: "#123456",
      titleSize: 100,
      bodySize: 1,
      radius: -12,
    });

    expect(style.background).toBe("#ffffff");
    expect(style.foreground).toBe("#172c57");
    expect(style.accent).toBe("#123456");
    expect(style.titleSize).toBe(34);
    expect(style.bodySize).toBe(12);
    expect(style.radius).toBe(0);
  });

  it("turns normalized values into card presentation styles", () => {
    expect(announcementCardStyle({ preset: "memorial" })).toMatchObject({
      backgroundColor: "#f5f5f4",
      color: "#292524",
      borderColor: "#78716c",
      borderRadius: 12,
      boxShadow: "none",
      textAlign: "right",
    });
  });
});
