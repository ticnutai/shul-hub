/**
 * The guard itself, against a component that really throws.
 *
 * The arithmetic of when to give up is tested next door; what is tested here
 * is the thing that was actually missing - that a throw no longer takes the
 * board off the wall, and that what replaces it is something a person in the
 * hall can read and a gabbai can act on.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BoardCrashGuard } from "./BoardCrashGuard";
import { CRASH_RECOVERY, setWatchdogReport } from "./watchdog";

function Boom(): JSX.Element {
  throw new Error("מנחה לא קיימת");
}

let logged: Array<{ level: string; message: string }>;

beforeEach(() => {
  logged = [];
  setWatchdogReport((level, _kind, message) => void logged.push({ level, message }));
  sessionStorage.clear();
  // React prints the caught error; the test is about what the wall shows.
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  setWatchdogReport(null);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("a board that throws while drawing", () => {
  it("shows the working board when nothing is wrong", () => {
    render(
      <BoardCrashGuard recover={false}>
        <div>זמני התפילות</div>
      </BoardCrashGuard>,
    );
    expect(screen.getByText("זמני התפילות")).toBeTruthy();
  });

  it("puts something legible on the wall instead of nothing", () => {
    render(
      <BoardCrashGuard recover={false}>
        <Boom />
      </BoardCrashGuard>,
    );
    // Before this existed, React unmounted the tree and the screen was blank.
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/מנחה לא קיימת/)).toBeTruthy();
  });

  it("says what happened, with the real message", () => {
    render(
      <BoardCrashGuard recover={false}>
        <Boom />
      </BoardCrashGuard>,
    );
    // Not "Script error." - that is all window.onerror gets from a chunk the
    // browser treats as cross-origin, and it names nothing.
    expect(logged.some((l) => l.level === "error" && l.message.includes("מנחה לא קיימת"))).toBe(true);
  });

  it("reloads itself on the wall, after a moment", () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    render(
      <BoardCrashGuard recover reload={reload}>
        <Boom />
      </BoardCrashGuard>,
    );
    expect(reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(CRASH_RECOVERY.delayMs + 10);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload under an admin who is reading the message", () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    render(
      <BoardCrashGuard recover={false} reload={reload}>
        <Boom />
      </BoardCrashGuard>,
    );
    vi.advanceTimersByTime(CRASH_RECOVERY.delayMs * 5);
    expect(reload).not.toHaveBeenCalled();
  });

  it("stops trying once the attempts are spent", () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    for (let i = 0; i < CRASH_RECOVERY.limit; i++) {
      render(
        <BoardCrashGuard recover reload={reload}>
          <Boom />
        </BoardCrashGuard>,
      );
      cleanup();
    }
    render(
      <BoardCrashGuard recover reload={reload}>
        <Boom />
      </BoardCrashGuard>,
    );
    vi.advanceTimersByTime(CRASH_RECOVERY.delayMs * 3);
    expect(screen.getByText("הלוח לא מצליח לעלות")).toBeTruthy();
    expect(logged.some((l) => l.message.includes("מפסיק לנסות"))).toBe(true);
  });
});
