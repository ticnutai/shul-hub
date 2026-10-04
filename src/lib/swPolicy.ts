import { Capacitor } from "@capacitor/core";

/**
 * Where the website's service worker belongs: a browser on a phone or a
 * tablet, and nowhere else.
 *
 * There it is worth having - the site opens without network, can sit on the
 * home screen like an app (an iPhone has no other app), and shows a phone's
 * notifications. In the installed app it only does harm: it can keep serving
 * the previous version after a new one is out. On a computer it gives little
 * and has caused the same confusion, so a computer goes without one too, and
 * one left there from before is removed (main.tsx).
 */
export function isPhoneBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua)) return true;
  // iPadOS asks for the desktop site and calls itself a Mac - with a touch screen.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function wantsServiceWorker(): boolean {
  return !Capacitor.isNativePlatform() && isPhoneBrowser();
}
