/**
 * The reminders' settings, in one place: steps that stay in order, a look
 * chosen and seen in the small card beside it, a time with minutes of its own,
 * and the simulation on the board - played, jumped to a step, sent to a screen.
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_TV_CONFIG, type TvConfig } from "@/tv/config";
import { AlertsSettings } from "./AlertsSettings";
import type { AlertSimulation } from "./alertSimulation";

afterEach(cleanup);

let latest: TvConfig;
const SHMA = new Date("2026-10-14T06:33:00Z");
/** The simulation as the editor hands it over, its actions recorded. */
const sim = (over: Partial<AlertSimulation> = {}): AlertSimulation => ({
  times: [{ event: "sof_zman_shma", at: SHMA }],
  dayNote: "היום",
  event: "sof_zman_shma",
  at: SHMA,
  moment: null,
  playing: false,
  speed: 1,
  setEvent: vi.fn(),
  setSpeed: vi.fn(),
  play: vi.fn(),
  pause: vi.fn(),
  stop: vi.fn(),
  jump: vi.fn(),
  halt: vi.fn(),
  ...over,
});
function Harness({ start, simulation }: { start: TvConfig; simulation?: AlertSimulation }) {
  const [config, setConfig] = useState(start);
  latest = config;
  return <AlertsSettings config={config} countdown={config.countdown.enabled} edit={(_k, u) => setConfig((c) => u(c))} simulation={simulation} />;
}
const staged = (): TvConfig => ({ ...structuredClone(DEFAULT_TV_CONFIG), alerts: { ...DEFAULT_TV_CONFIG.alerts, mode: "staged" } });

describe("the reminders' settings", () => {
  it("keeps the steps in order when one is set past another, and 0 leaves a step out", () => {
    render(<Harness start={staged()} />);
    // The one stepper of the editor: arrows on the number, a minute at a time.
    const stepTo = (name: string, target: number) => {
      const box = screen.getByRole("spinbutton", { name });
      for (let i = 0; i < 200 && Number(box.getAttribute("aria-valuenow")) !== target; i++)
        fireEvent.keyDown(box, { key: Number(box.getAttribute("aria-valuenow")) < target ? "ArrowUp" : "ArrowDown" });
    };
    stepTo("2. ספירה במקום התפילות", 40);
    expect(latest.alerts.stages).toEqual({ highlight: 40, panel: 40, board: 10 });
    stepTo("3. ספירה על כל הלוח", 0);
    expect(latest.alerts.stages.board).toBe(0);
    // The step left out reads "כבוי" in its own box (a box one can also type into), and only there.
    const boxes = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    expect(boxes.filter((b) => b.value === "כבוי")).toHaveLength(1);
  });

  it("shows the pulsing card's minutes only in that mode", () => {
    render(<Harness start={staged()} />);
    expect(screen.queryByRole("spinbutton", { name: "דקות לתזכורת נוספת" })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /כרטיס שקופץ לרגע/ }));
    expect(latest.alerts.mode).toBe("pulse");
    expect(screen.getByRole("spinbutton", { name: "דקות לתזכורת נוספת" })).toBeTruthy();
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

  it("runs a simulation on the board: the steps on a line, each a jump; play, faster, and what the board shows", () => {
    const s = sim();
    const { rerender } = render(<Harness start={staged()} simulation={s} />);
    const box = within(screen.getByTestId("alert-simulation"));
    // The steps, a minute before the first to the time itself.
    expect(box.getAllByRole("button").map((b) => b.textContent)).toEqual(expect.arrayContaining([
      "30 דקות לפני: הזמן מסומן ברשימה", "20 דקות לפני: ספירה במקום התפילות", "10 דקות לפני: ספירה על כל הלוח", "הזמן עצמו",
    ]));
    fireEvent.click(box.getByRole("button", { name: "10 דקות לפני: ספירה על כל הלוח" }));
    expect(s.jump).toHaveBeenLastCalledWith(10);
    fireEvent.click(box.getByRole("button", { name: "הפעלת ההדמיה" }));
    expect(s.play).toHaveBeenCalled();
    fireEvent.click(box.getByRole("radio", { name: "פי 60" }));
    expect(s.setSpeed).toHaveBeenLastCalledWith(60);
    // Running: how long is left, and what is on the board then.
    rerender(<Harness start={staged()} simulation={sim({ moment: new Date(SHMA.getTime() - 9 * 60_000), playing: true })} />);
    expect(screen.getByTestId("simulation-readout").textContent).toBe("נשארו 9:00 · על הלוח: ספירה על כל הלוח");
    expect(screen.getByRole("button", { name: "השהיית ההדמיה" })).toBeTruthy();
  });

  it("gives a time minutes of its own, and the simulation runs up to it", () => {
    const s = sim();
    render(<Harness start={staged()} simulation={s} />);
    fireEvent.change(screen.getByRole("combobox", { name: "הדקות של" }), { target: { value: "sof_zman_shma" } });
    expect(s.setEvent).toHaveBeenLastCalledWith("sof_zman_shma");
    // Until it has its own, it says so and offers no minutes of its own.
    expect(screen.queryByTestId("alert-stages")).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "דקות משלו לזמן הזה" }));
    expect(latest.alerts.own.sof_zman_shma?.stages).toEqual({ highlight: 30, panel: 20, board: 10 });
    const box = screen.getByRole("spinbutton", { name: "3. ספירה על כל הלוח" });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    // Its own changed; every time's stayed.
    expect(latest.alerts.own.sof_zman_shma?.stages.board).toBe(9);
    expect(latest.alerts.stages.board).toBe(10);
    // Off again: back to every time's.
    fireEvent.click(screen.getByRole("switch", { name: "דקות משלו לזמן הזה" }));
    expect(latest.alerts.own).toEqual({});
  });

  it("sends the simulation to a connected screen chosen - and says which app shows only a note", () => {
    const send = vi.fn<(to: string) => void>();
    const screens = [
      { id: "a", name: "מסך בית הכנסת", online: true, shows: true },
      { id: "b", name: "מסך אהבת התורה", online: false, shows: false },
    ];
    render(<AlertsSettings config={staged()} countdown={false} edit={() => {}} simulation={sim()} screens={screens} onSend={send} />);
    const box = within(screen.getByTestId("alert-example-screen"));
    const select = box.getByRole("combobox", { name: "מסך מחובר להדמיה" }) as HTMLSelectElement;
    expect([...select.options].map((o) => o.text)).toEqual(["בחירת מסך", "מסך בית הכנסת", "מסך אהבת התורה (לא מחובר עכשיו)", "כל המסכים"]);
    expect((box.getByRole("button", { name: /שליחה למסך/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(select, { target: { value: "b" } });
    expect(box.getByText(/האפליקציה ישנה/)).toBeTruthy();
    expect(box.getByText(/לא מחובר עכשיו - ההדמיה תופיע כשיתחבר/)).toBeTruthy();
    fireEvent.change(select, { target: { value: "a" } });
    fireEvent.click(box.getByRole("button", { name: /שליחה למסך/ }));
    expect(send).toHaveBeenLastCalledWith("a");
  });

  it("keeps the count to the next minyan beside them", () => {
    render(<Harness start={staged()} />);
    fireEvent.click(screen.getByRole("switch", { name: "ספירה לתפילה הבאה" }));
    expect(latest.countdown.enabled).toBe(true);
  });
});
