/**
 * The admin's screen for the strip at the top of the home page, drawn and
 * used with a synagogue of samples: no sign-in, no database. What it saves
 * is what was chosen; a picture goes to the synagogue's own storage.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STORED = "https://bfiayuuhjtyccqobsjvl.supabase.co/storage/v1/object/public/community-media/hero/c1/x.jpg";
const mutate = vi.fn();
const upload = vi.fn(async () => ({ error: null }));
let settings: Record<string, unknown>;

vi.mock("@community/lib/data", () => ({ useSettings: () => ({ data: settings }) }));
vi.mock("@community/lib/admin", () => ({ useSaveRow: () => ({ mutate, isPending: false }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ upload, getPublicUrl: () => ({ data: { publicUrl: STORED } }) }) } },
}));

import { HomeHeroSettings } from "./HomeHeroSettings";
import { DEFAULT_HOME_HERO } from "@community/lib/homeHero";

afterEach(cleanup);
beforeEach(() => {
  mutate.mockClear();
  upload.mockClear();
  settings = {
    id: "s1", community_id: "c1", name: "אהל משה", subtitle: "תורה ותפילה", home_header_variant: "standard",
    latitude: 32.08, longitude: 34.83, elevation: 40, candle_offset_minutes: 20, tzeit_offset_minutes: 20, home_hero: {},
  };
});

const preview = () => screen.getByTestId("home-hero-preview");
const strip = () => preview().querySelector('[data-testid="home-hero"]');

describe("the admin's screen for the strip", () => {
  it("shows the strip as it is, without the name the header already shows", () => {
    render(<HomeHeroSettings />);
    expect(strip()?.getAttribute("data-hero-layout")).toBe("classic");
    expect(within(preview()).queryAllByText("אהל משה").filter((el) => !el.classList.contains("sr-only"))).toHaveLength(0);
    expect(within(preview()).getByTestId("hero-next-prayer").textContent).toContain("מנחה");
    expect(screen.getByRole("button", { name: "שמירה" })).toHaveProperty("disabled", true);
  });

  it("saves what was chosen: layout, colours, what shows, and a phone's own layout", () => {
    render(<HomeHeroSettings />);
    fireEvent.click(screen.getByRole("radio", { name: /שני טורים/ }));
    fireEvent.click(screen.getByRole("radio", { name: /ירוק אמרלד/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /התפילה הבאה/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "שם בית הכנסת ברצועה" }), { target: { value: "show" } });
    fireEvent.change(screen.getByRole("combobox", { name: "פריסה בטלפון" }), { target: { value: "compact" } });
    expect(strip()?.getAttribute("data-hero-layout")).toBe("split");
    expect(within(preview()).queryByTestId("hero-next-prayer")).toBeNull();
    // As a phone: the phone's own layout.
    fireEvent.click(screen.getByRole("radio", { name: "טלפון" }));
    expect(strip()?.getAttribute("data-hero-layout")).toBe("compact");
    fireEvent.click(screen.getByRole("button", { name: "שמירה" }));
    expect(mutate).toHaveBeenCalledWith({
      id: "s1",
      home_hero: { ...DEFAULT_HOME_HERO, layout: "split", look: "emerald", name: "show", next: false, phoneLayout: "compact" },
    });
  });

  it("takes changes back, and back to the default", () => {
    settings.home_hero = { layout: "cards", look: "onyx" };
    render(<HomeHeroSettings />);
    fireEvent.click(screen.getByRole("radio", { name: /רצועה דקה/ }));
    fireEvent.click(screen.getByRole("button", { name: "ביטול השינויים" }));
    expect(strip()?.getAttribute("data-hero-layout")).toBe("cards");
    fireEvent.click(screen.getByRole("button", { name: "חזרה לברירת המחדל" }));
    expect(strip()?.getAttribute("data-hero-layout")).toBe("classic");
  });

  it("puts a picture behind the strip, under a shade, from the synagogue's own storage", async () => {
    render(<HomeHeroSettings />);
    const file = new File(["x"], "shul.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("בחירת תמונה לרקע הרצועה"), { target: { files: [file] } });
    await waitFor(() => expect(strip()?.getAttribute("data-hero-look")).toBe("picture"));
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(/^hero\/c1\/[\w-]+\.jpg$/), file, expect.anything());
    fireEvent.change(screen.getByRole("combobox", { name: "גוון מעל התמונה" }), { target: { value: "light" } });
    fireEvent.click(screen.getByRole("button", { name: "שמירה" }));
    expect(mutate).toHaveBeenCalledWith({ id: "s1", home_hero: { ...DEFAULT_HOME_HERO, image: STORED, shade: "light" } });
  });

  it("refuses a file that is not a picture, or too big", async () => {
    render(<HomeHeroSettings />);
    fireEvent.change(screen.getByLabelText("בחירת תמונה לרקע הרצועה"), { target: { files: [new File(["x"], "a.pdf", { type: "application/pdf" })] } });
    const big = new File([new Uint8Array(5 * 1024 * 1024)], "big.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("בחירת תמונה לרקע הרצועה"), { target: { files: [big] } });
    await new Promise((r) => setTimeout(r, 20));
    expect(upload).not.toHaveBeenCalled();
    expect(strip()?.getAttribute("data-hero-look")).toBe("royal");
  });
});
