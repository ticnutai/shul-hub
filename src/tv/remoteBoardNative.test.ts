import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * On the box, the APK's copy of the board runs at https://localhost and the
 * website sends no CORS header, so the WebView's own fetch of the board page
 * always fails. The probe has to go through Android (CapacitorHttp) there.
 */
const native = vi.hoisted(() => ({ isNative: true, get: vi.fn() }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => native.isNative },
  CapacitorHttp: { get: native.get },
}));

import { BOARD_MARKER, REMOTE_BOARD_URL, fetchRemoteBoard } from "./remoteBoard";

describe("the probe on the box", () => {
  beforeEach(() => {
    native.isNative = true;
    native.get.mockReset();
  });

  it("goes through Android, not the WebView's fetch", async () => {
    native.get.mockResolvedValue({ status: 200, data: `<meta ${BOARD_MARKER} content="1">` });
    const webFetch = vi.fn();
    vi.stubGlobal("fetch", webFetch);
    expect(await fetchRemoteBoard()).toContain(BOARD_MARKER);
    expect(native.get).toHaveBeenCalledOnce();
    expect(native.get.mock.calls[0][0].url.startsWith(`${REMOTE_BOARD_URL}?probe=`)).toBe(true);
    expect(webFetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("still refuses a page that is not the board, and an error", async () => {
    native.get.mockResolvedValueOnce({ status: 200, data: "<html>captive portal</html>" });
    expect(await fetchRemoteBoard()).toBeNull();
    native.get.mockResolvedValueOnce({ status: 503, data: `<meta ${BOARD_MARKER}>` });
    expect(await fetchRemoteBoard()).toBeNull();
    native.get.mockRejectedValueOnce(new Error("no network"));
    expect(await fetchRemoteBoard()).toBeNull();
  });

  it("in a browser, keeps using fetch", async () => {
    native.isNative = false;
    const webFetch = vi.fn().mockResolvedValue({ ok: true, text: async () => `<meta ${BOARD_MARKER}>` });
    vi.stubGlobal("fetch", webFetch);
    expect(await fetchRemoteBoard()).toContain(BOARD_MARKER);
    expect(native.get).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
