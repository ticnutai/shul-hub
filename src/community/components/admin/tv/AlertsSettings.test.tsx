/**
 * The reminders' settings, in one place: steps that stay in order, a look
 * chosen and seen in the small card beside it, and the examples on the board.
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_TV_CONFIG, type TvConfig } from "@/tv/config";
import { AlertsSettings, type AlertExample } from "./AlertsSettings";

afterEach(cleanup);

let latest: TvConfig;
const example = vi.fn<(what: AlertExample) => void>();
function Harness({ start }: { start: TvConfig }) {
  const [config, setConfig] = useState(start);
  latest = config;
  return <AlertsSettings config={config} countdown={config.countdown.enabled} edit={(_k, u) => setConfig((c) => u(c))} onExample={example} />;
}
const staged = (): TvConfig => ({ ...structuredClone(DEFAULT_TV_CONFIG), alerts: { ...DEFAULT_TV_CONFIG.alerts, mode: "staged" } });

describe("the reminders' settings", () => {
  it("keeps the steps in order when one is set past another, and 0 leaves a step out", () => {
    render(<Harness start={staged()} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "2. ספירה במקום התפילות" }), { target: { value: "40" } });
    expect(latest.alerts.stages).toEqual({ highlight: 40, panel: 40, board: 10 });
    fireEvent.change(screen.getByRole("spinbutton", { name: "3. ספירה על כל הלוח" }), { target: { value: "0" } });
    expect(latest.alerts.stages.board).toBe(0);
    expect(screen.getAllByText("כבוי")).toHaveLength(1);
  });

  it("shows the pulsing card's minutes only in that mode", () => {
    render(<Harness start={staged()} />);
    expect(screen.queryByLabelText("דקות להתראה נוספת")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /כרטיס שקופץ לרגע/ }));
    expect(latest.alerts.mode).toBe("pulse");
    expect(screen.getByLabelText("דקות להתראה נוספת")).toBeTruthy();
    expect(screen.queryByTestId("alert-stages")).toBeNull();
  });

  it("changes the look, and the small card beside it shows it", () => {
    render(<Harness start={staged()} />);
    const preview = screen.getByTestId("alert-look-preview");
    fireEvent.click(screen.getByRole("radio", { name: "אדום דחוף" }));
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "צורה" })).getByRole("radio", { name: "קשת" }));
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "מיקום הכרטיס על הלוח" })).getByRole("radio", { name: "למטה" }));
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "סמל" })).getByRole("radio", { name: "נר" }));
    expect(latest.alerts.look).toMatchObject({ style: "crimson", shape: "arch", position: "bottom", icon: "candle" });
    expect(preview.querySelector<HTMLElement>(".tv-root")!.style.getPropertyValue("--al-bg")).toBe("#4a0e17");
    expect(preview.querySelector(".tv-alert-backdrop")!.getAttribute("data-position")).toBe("bottom");
    expect(preview.querySelector(".tv-alert-icon")!.textContent).toBe("🕯️");
    // Own colours: three pickers; and back to the usual look.
    fireEvent.click(screen.getByRole("radio", { name: "צבעים שלי" }));
    expect(screen.getByRole("button", { name: "רקע התזכורת" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "חזרה למראה הרגיל" }));
    expect(latest.alerts.look).toEqual(DEFAULT_TV_CONFIG.alerts.look);
  });

  it("shows examples on the board, of the step chosen", () => {
    render(<Harness start={staged()} />);
    fireEvent.click(screen.getByRole("button", { name: /דוגמה על הלוח/ }));
    fireEvent.click(screen.getByRole("button", { name: "דוגמה: במקום התפילות" }));
    expect(example.mock.calls.map((c) => c[0])).toEqual(["board", "panel"]);
  });

  it("keeps the count to the next minyan beside them", () => {
    render(<Harness start={staged()} />);
    fireEvent.click(screen.getByRole("switch", { name: "ספירה לתפילה הבאה" }));
    expect(latest.countdown.enabled).toBe(true);
  });
});
