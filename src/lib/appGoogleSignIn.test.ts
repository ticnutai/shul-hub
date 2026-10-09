// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const setSession = vi.fn(async (_tokens: { access_token: string; refresh_token: string }) => ({ error: null as null | { message: string } }));
const open = vi.fn(async (_o: { url: string }) => {});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { setSession: (t: never) => setSession(t) } } }));
vi.mock("@capacitor/browser", () => ({ Browser: { open: (o: never) => open(o), close: async () => {} } }));
vi.mock("@capacitor/app", () => ({ App: { getInfo: async () => ({ id: "com.ticnutai.bsr3synagogue" }) } }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }));

import { getAuthPersistence } from "./authPreferences";
import { handleAppAuthLink, startAppGoogleSignIn } from "./appGoogleSignIn";

/** The state the app sent with the sign-in, read from the address it opened. */
const sentState = () => new URL(open.mock.calls.at(-1)![0].url).searchParams.get("state")!;

describe("Google sign-in in the app", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setSession.mockClear();
    open.mockClear();
  });

  it("opens the site's sign-in in the phone's browser, to come back by the bridge page to this app", async () => {
    await startAppGoogleSignIn(true);
    const url = new URL(open.mock.calls[0][0].url);
    expect(url.origin + url.pathname).toBe("https://shul-hub.lovable.app/~oauth/initiate");
    expect(url.searchParams.get("provider")).toBe("google");
    expect(url.searchParams.get("redirect_uri")).toBe("https://shul-hub.lovable.app/app-auth-callback.html?app=com.ticnutai.bsr3synagogue");
  });

  it("keeps the session that comes back, remembered when asked", async () => {
    await startAppGoogleSignIn(true);
    const res = await handleAppAuthLink(`com.ticnutai.bsr3synagogue://auth-callback#access_token=a&refresh_token=r&state=${sentState()}`);
    expect(res).toEqual({ ok: true });
    expect(setSession).toHaveBeenCalledWith({ access_token: "a", refresh_token: "r" });
    expect(getAuthPersistence()).toBe(true);
  });

  it("refuses an answer to a sign-in it did not start", async () => {
    await startAppGoogleSignIn(true);
    const res = await handleAppAuthLink("com.ticnutai.bsr3synagogue://auth-callback#access_token=a&refresh_token=r&state=someone-else");
    expect(res?.ok).toBe(false);
    expect(setSession).not.toHaveBeenCalled();
  });

  it("says why, when the sign-in failed", async () => {
    await startAppGoogleSignIn(false);
    const res = await handleAppAuthLink(`com.ticnutai.bsr3synagogue://auth-callback#error=invalid_request&error_description=not+enabled&state=${sentState()}`);
    expect(res).toEqual({ ok: false, error: "not enabled" });
    expect(setSession).not.toHaveBeenCalled();
  });

  it("leaves other links alone", async () => {
    expect(await handleAppAuthLink("com.ticnutai.bsr3synagogue://somewhere-else")).toBeNull();
  });
});
