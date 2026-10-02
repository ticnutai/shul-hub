/**
 * Choosing a synagogue from the remote.
 *
 * The board is one system serving several synagogues, and which one a screen
 * shows was decided once, by an administrator at a computer. This is the
 * gabbai's way to change it with the remote in his hand, so what is held
 * down here is the part he touches: that the arrows move, that OK moves the
 * screen, that Back leaves nothing changed, and that a closed menu does not
 * quietly take the arrows away from the board underneath.
 */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listCommunities = vi.fn();
const setDeviceCommunity = vi.fn();

vi.mock("./device", () => ({
  listCommunities: (...a: unknown[]) => listCommunities(...a),
  setDeviceCommunity: (...a: unknown[]) => setDeviceCommunity(...a),
}));

const { ScreenMenu } = await import("./ScreenMenu");

const MAIN = { id: "c9a6", slug: "main", name: "בית הכנסת אושר של יהודי", active: true };
const TORAH = { id: "4433", slug: "torah-veahavata", name: "תורה ואהבתה", active: false };

const THEMES = [
  { id: "royal", name: "מלכותי" },
  { id: "parchment", name: "קלף" },
] as never[];

function show(over: Partial<Parameters<typeof ScreenMenu>[0]> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    currentCommunity: TORAH.id,
    canSwitch: true,
    themes: THEMES,
    currentTheme: "royal",
    onTheme: vi.fn(),
    reload: vi.fn(),
    ...over,
  };
  return { props, ...render(<ScreenMenu {...(props as Parameters<typeof ScreenMenu>[0])} />) };
}

const press = (key: string, repeat = false) =>
  act(() => void window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, repeat })));

/** The clock the menu reads, moved on by hand: a second OK is a moment after the first. */
let shift = 0;
const realNow = Date.now.bind(Date);
const later = (ms: number) => {
  shift += ms;
};
/** Moving the screen: OK, which asks, and OK again a moment later, which moves. */
const okTwice = () => {
  press("Enter");
  later(700);
  press("Enter");
};

beforeEach(() => {
  shift = 0;
  vi.spyOn(Date, "now").mockImplementation(() => realNow() + shift);
  listCommunities.mockResolvedValue([MAIN, TORAH]);
  setDeviceCommunity.mockResolvedValue(MAIN);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("the synagogue menu on the screen", () => {
  it("lists every synagogue and marks the one this screen is showing", async () => {
    show();
    await screen.findByText(MAIN.name);
    expect(screen.getByText(TORAH.name)).toBeTruthy();
    expect(screen.getByText("המסך הזה")).toBeTruthy();
  });

  it("moves with the arrows and moves the screen with OK, confirmed", async () => {
    const { props } = show();
    await screen.findByText(MAIN.name);
    // It opens on this screen's synagogue (the second row); up is the first.
    press("ArrowUp");
    okTwice();
    await waitFor(() => expect(setDeviceCommunity).toHaveBeenCalledWith(MAIN.id));
    // The board is rebuilt from that synagogue's own data, so it starts again.
    await waitFor(() => expect(props.reload).toHaveBeenCalled());
  });

  it("OK on the synagogue it is already showing just closes", async () => {
    const { props } = show({ currentCommunity: MAIN.id });
    await screen.findByText(MAIN.name);
    press("Enter");
    expect(setDeviceCommunity).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it("Back leaves without changing anything", async () => {
    const { props } = show();
    await screen.findByText(MAIN.name);
    press("Escape");
    expect(props.onClose).toHaveBeenCalled();
    expect(setDeviceCommunity).not.toHaveBeenCalled();
  });

  it("keeps the theme, which used to be on these arrows and nowhere else", async () => {
    const { props } = show();
    await screen.findByText(MAIN.name);
    // It opens on this screen's synagogue, the second row; next is the theme.
    press("ArrowDown");
    press("Enter");
    expect(props.onTheme).toHaveBeenCalledWith("parchment");
  });

  it("moves the screen once, however many times the OK key repeats", async () => {
    show();
    await screen.findByText(MAIN.name);
    // A TV remote's OK repeats while held, and the flag the handler could see
    // never changed, so the move was sent twice - twice in the screen's log,
    // as the real box showed.
    press("ArrowUp");
    press("Enter");
    // Held down: the repeats are not a second press.
    press("Enter", true);
    press("Enter", true);
    expect(setDeviceCommunity).not.toHaveBeenCalled();
    later(700);
    press("Enter");
    press("Enter", true);
    press("Enter", true);
    await waitFor(() => expect(setDeviceCommunity).toHaveBeenCalledTimes(1));
  });

  it("can be left with the arrows alone, because Back never reaches the page", async () => {
    // Android hands Back to the app, and the installed APK has no plugin to
    // receive it, so a menu that could only be left with Back would be a
    // trap on a wall. Past the synagogues and the theme is "סגירה".
    const { props } = show();
    await screen.findByText(MAIN.name);
    expect(screen.getByText("סגירה")).toBeTruthy();
    // From this screen's synagogue: the theme, then the close.
    for (let i = 0; i < 2; i++) press("ArrowDown");
    press("Enter");
    expect(props.onClose).toHaveBeenCalled();
    expect(setDeviceCommunity).not.toHaveBeenCalled();
  });

  it("the arrows move within the whole list, not the part that loaded first", async () => {
    // The synagogues arrive after the menu opens, so for a moment the list is
    // the theme and the close. The arrows used to wrap inside those two: four
    // presses moved one place, and when the synagogues arrived that place was
    // a synagogue. Pressing OK then moved the screen to another shul instead
    // of changing the theme - which is how it was reported.
    show();
    await screen.findByText(MAIN.name);
    // Four rows: two synagogues, the theme, the close. From the second, three
    // downs wrap round to the first, which only holds if the whole list is
    // being counted.
    for (let i = 0; i < 3; i++) press("ArrowDown");
    okTwice();
    // Row 0 is a synagogue, and this screen is not on it.
    await waitFor(() => expect(setDeviceCommunity).toHaveBeenCalledWith(MAIN.id));
  });

  it("ignores keys until the list has arrived, so none lands on the wrong row", async () => {
    let release: (v: unknown) => void = () => {};
    listCommunities.mockReturnValue(new Promise((r) => { release = r; }));
    const { props } = show();
    // While it is still loading, nothing is worth pressing.
    press("ArrowDown");
    press("Enter");
    expect(setDeviceCommunity).not.toHaveBeenCalled();
    expect(props.onTheme).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
    // Once it is there, the keys work as normal.
    release([MAIN, TORAH]);
    await screen.findByText(MAIN.name);
    press("ArrowUp");
    okTwice();
    await waitFor(() => expect(setDeviceCommunity).toHaveBeenCalledWith(MAIN.id));
  });

  it("opens on the synagogue this screen shows, so a stray OK changes nothing", async () => {
    // אהל אברהם's screen was moved to another shul by the menu: it opened on
    // the first synagogue in the list, and an arrow and OK were enough.
    const { props } = show();
    await screen.findByText(MAIN.name);
    const active = document.querySelector(".tv-menu-row.is-active");
    expect(active?.textContent).toContain(TORAH.name);
    press("Enter");
    expect(setDeviceCommunity).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it("says so rather than failing silently when the list will not load", async () => {
    listCommunities.mockRejectedValue(new Error("offline"));
    show();
    expect(await screen.findByText(/רשימת בתי הכנסת לא נטענה/)).toBeTruthy();
  });

  it("does not take the arrows while it is closed", () => {
    const { props } = show({ open: false });
    press("ArrowDown");
    press("Enter");
    expect(props.onClose).not.toHaveBeenCalled();
    expect(setDeviceCommunity).not.toHaveBeenCalled();
    expect(screen.queryByTestId("screen-menu")).toBeNull();
  });

  it("in a browser it offers the theme and says where the choice belongs", async () => {
    const { props } = show({ canSwitch: false });
    expect(screen.queryByText(MAIN.name)).toBeNull();
    expect(screen.getByText(/בחירת בית כנסת נעשית מהמסך עצמו/)).toBeTruthy();
    // Without synagogues the rows are theme, then close.
    press("Enter");
    expect(props.onTheme).toHaveBeenCalledWith("parchment");
    expect(listCommunities).not.toHaveBeenCalled();
  });

  it("one OK on another synagogue only asks; an arrow, or time, lets it go", async () => {
    // תורה ואהבתה's screen was moved to another shul by one OK on the way down
    // to the theme (2.10.2026), and showed that shul's board from then on.
    const { props } = show();
    await screen.findByText(MAIN.name);
    press("ArrowUp");
    press("Enter");
    expect(setDeviceCommunity).not.toHaveBeenCalled();
    expect(screen.getByTestId("screen-menu-confirm").textContent).toContain(MAIN.name);
    // Going on down to the theme cancels it, and OK there is the theme.
    press("ArrowDown");
    expect(screen.queryByTestId("screen-menu-confirm")).toBeNull();
    press("ArrowDown");
    press("Enter");
    expect(props.onTheme).toHaveBeenCalledWith("parchment");
    expect(setDeviceCommunity).not.toHaveBeenCalled();
  });
});
