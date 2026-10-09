/**
 * Google sign-in inside the Android app.
 *
 * Google does not let anyone sign in inside an app's own window, and the
 * app's pages are not served from the site, where Lovable's sign-in lives
 * ("/~oauth/initiate"). So the app opens the phone's browser at the site's
 * sign-in; Lovable sends the browser back to public/app-auth-callback.html
 * with the tokens after "#", and that page hands them to the app by its own
 * link (<package>://auth-callback#...), received here.
 */
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { setAuthPersistence } from "@/lib/authPreferences";

export const SITE_ORIGIN = "https://shul-hub.lovable.app";
const STATE_KEY = "app_google_signin_state";
const REMEMBER_KEY = "app_google_signin_remember";

export const isNativeApp = () => Capacitor.isNativePlatform();

/** The app's own link name: the package of this build (the store app or a trial build beside it). */
async function appScheme(): Promise<string> {
  const info = await CapacitorApp.getInfo();
  return info.id;
}

function newState(): string {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Opens Google sign-in in the phone's browser; the answer comes back through handleAppAuthLink. */
export async function startAppGoogleSignIn(remember: boolean): Promise<void> {
  const state = newState();
  localStorage.setItem(STATE_KEY, state);
  localStorage.setItem(REMEMBER_KEY, remember ? "true" : "false");
  const callback = `${SITE_ORIGIN}/app-auth-callback.html?app=${encodeURIComponent(await appScheme())}`;
  const params = new URLSearchParams({ provider: "google", redirect_uri: callback, state });
  await Browser.open({ url: `${SITE_ORIGIN}/~oauth/initiate?${params.toString()}` });
}

export type AppAuthResult = { ok: true } | { ok: false; error: string } | null;

/** The app opened by its sign-in link: the tokens are checked against the state it sent, and kept. */
export async function handleAppAuthLink(url: string): Promise<AppAuthResult> {
  if (!/^[a-z0-9.]+:\/\/auth-callback/i.test(url)) return null;
  void Browser.close().catch(() => {});
  const params = new URLSearchParams(url.split("#")[1] ?? "");
  const expected = localStorage.getItem(STATE_KEY);
  localStorage.removeItem(STATE_KEY);
  if (!expected || params.get("state") !== expected) return { ok: false, error: "ההתחברות לא הושלמה (פג תוקף). נסו שוב." };
  if (params.get("error")) return { ok: false, error: params.get("error_description") || "ההתחברות עם גוגל לא הצליחה" };
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return { ok: false, error: "לא התקבלו פרטי התחברות מגוגל" };
  setAuthPersistence(localStorage.getItem(REMEMBER_KEY) !== "false");
  localStorage.removeItem(REMEMBER_KEY);
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  return error ? { ok: false, error: error.message } : { ok: true };
}
