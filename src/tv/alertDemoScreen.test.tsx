/**
 * The reminder's example on the screen itself: a "message" carrying it moves
 * the board's clock to the moment sent, with the editor's reminders, and
 * marks it as an example - and a plain message stays a plain message.
 */
import { act, cleanup, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { zmanimFor } from "@community/lib/minyan-time";
import { DEFAULT_TV_CONFIG } from "./config";
import { alertDemoPayload } from "./alertDemo";
import type { BoardData } from "./useBoardData";
import type { TvCommand } from "./useDeviceLink";

const data: BoardData = {
  settings: null, minyanim: [], categories: [], announcements: [], shiurim: [], overrides: [],
  stale: false, anyLoaded: true, sync: { status: "live", lastSyncedAt: null },
};
let onCommand: (c: TvCommand, link: unknown) => void = () => {};
const link = { log: vi.fn(), reportNow: vi.fn() };
vi.mock("./useDeviceLink", () => ({
  useDeviceLink: (o: { onCommand: typeof onCommand }) => {
    onCommand = o.onCommand;
    return { status: { approved: true, online: true, name: "מסך בית הכנסת" }, link: { current: link }, config: structuredClone(DEFAULT_TV_CONFIG), configUpdatedAt: null };
  },
}));
vi.mock("./useBoardData", async (orig) => ({ ...(await orig<typeof import("./useBoardData")>()), useBoardData: () => data }));
vi.mock("./watchdog", async (orig) => ({ ...(await orig<typeof import("./watchdog")>()), setWatchdogReport: () => {}, watchMainThread: () => () => {}, scheduleNightlyRefresh: () => () => {} }));

vi.stubGlobal("__APP_VERSION__", "בדיקה");
const { TvApp } = await import("./TvApp");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  vi.setSystemTime(new Date("2026-10-14T03:00:00Z")); // a Wednesday, early morning
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function send(payload: Record<string, unknown>) {
  act(() => onCommand({ id: Math.random(), device_id: null, command: "message", payload, created_at: new Date().toISOString() } as TvCommand, link));
}

describe("the reminder's example on the screen", () => {
  it("shows the board a few minutes before the time, with the editor's reminders, marked as an example - then back", () => {
    const { container } = render(<QueryClientProvider client={new QueryClient()}><TvApp /></QueryClientProvider>);
    // The default board's reminders are a pulsing card; the example sends the steps.
    const shma = zmanimFor(new Date(), null).sof_zman_shma!;
    // Some hours on: the board's clock is set to it, whatever the real time.
    const at = new Date(shma.getTime() - (10 * 60 - 5) * 1000);
    const alerts = { ...DEFAULT_TV_CONFIG.alerts, mode: "staged" as const, events: ["sof_zman_shma" as const], stages: { highlight: 30, panel: 20, board: 10 } };
    send(alertDemoPayload(alerts, at, 1, 20));
    expect(container.querySelector(".tv-demo-tag")?.textContent).toBe("דוגמת תזכורת · לא אמיתית");
    expect(container.querySelector(".tv-alert-card")?.textContent).toContain("סוף זמן קריאת שמע");
    // Not the older app's text.
    expect(container.textContent).not.toContain("צריך לעדכן");
    // The count runs: a second later, a second less.
    const before = container.querySelector(".tv-alert-countdown")?.textContent;
    act(() => { vi.advanceTimersByTime(1000); });
    expect(container.querySelector(".tv-alert-countdown")?.textContent).not.toBe(before);
    // After its 20 seconds, the board as it was.
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(container.querySelector(".tv-demo-tag")).toBeNull();
    expect(container.querySelector(".tv-alert-card")).toBeNull();
  });

  it("runs at the speed chosen: a second on the wall, a minute on the board", () => {
    const { container } = render(<QueryClientProvider client={new QueryClient()}><TvApp /></QueryClientProvider>);
    const shma = zmanimFor(new Date(), null).sof_zman_shma!;
    const alerts = { ...DEFAULT_TV_CONFIG.alerts, mode: "staged" as const, events: ["sof_zman_shma" as const], stages: { highlight: 30, panel: 20, board: 10 } };
    send(alertDemoPayload(alerts, new Date(shma.getTime() - 9 * 60_000), 60, 10));
    const count = () => container.querySelector(".tv-alert-countdown")?.textContent;
    expect(count()).toBe("9:00");
    act(() => { vi.advanceTimersByTime(1000); });
    expect(count()).toBe("8:00");
  });

  it("leaves a plain message as it was", () => {
    const { container } = render(<QueryClientProvider client={new QueryClient()}><TvApp /></QueryClientProvider>);
    send({ text: "שלום לכולם", seconds: 30 });
    expect(container.querySelector(".tv-notice-text")?.textContent).toBe("שלום לכולם");
    expect(container.querySelector(".tv-demo-tag")).toBeNull();
  });
});
