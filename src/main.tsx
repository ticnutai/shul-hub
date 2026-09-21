import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { torahDB } from "./utils/torahDB";
import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { installStartupDiagnostics } from "./utils/startupDiagnostics";
import { installLayoutShiftTracker } from "./utils/renderDebug";

// Init IndexedDB early for fast cache access
torahDB.init();
installStartupDiagnostics();
installLayoutShiftTracker();

// A production PWA service worker may remain attached to localhost after a
// previous preview build and keep serving stale UI during development. Vite's
// disabled dev SW does not remove an older registration, so clean it once and
// reload before rendering the current source. This branch is removed from
// production builds and intentionally leaves localStorage/IndexedDB untouched.
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  const cleanupKey = "torah-dev-sw-cleanup-v1";
  void navigator.serviceWorker.getRegistrations().then(async registrations => {
    const hasStaleWorker = registrations.length > 0 || Boolean(navigator.serviceWorker.controller);
    if (!hasStaleWorker || sessionStorage.getItem(cleanupKey) === "done") return;

    sessionStorage.setItem(cleanupKey, "done");
    await Promise.all(registrations.map(registration => registration.unregister()));
    if ("caches" in window) {
      await Promise.all((await caches.keys()).map(cacheName => caches.delete(cacheName)));
    }
    window.location.reload();
  }).catch(() => {});
}

// A regular refresh may still be answered by the currently active PWA
// worker. Reload exactly once when a newer worker takes control so the page
// starts with its new HTML/JS shell. A first-time install needs no reload.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const hadControllerAtStartup = Boolean(navigator.serviceWorker.controller);
  let reloadingForNewWorker = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadControllerAtStartup || reloadingForNewWorker) return;
    reloadingForNewWorker = true;
    window.location.reload();
  });
}

// A deploy replaces every hashed chunk. A tab opened before it - or a page
// answered from an old service-worker cache - then asks for a file that is no
// longer on the server and dies with "Failed to fetch dynamically imported
// module": the blank error screen, which a plain refresh does not always
// clear because the old worker answers that refresh too.
//
// Recover by ourselves, at most once a minute so this can never loop: drop
// the caches, push the newest worker to take over, and reload into the build
// that is actually deployed.
if (import.meta.env.PROD) {
  const HEAL_KEY = "app-stale-chunk-heal";
  const healOnce = () => {
    // Offline, a chunk is missing because the network is gone, not because a
    // deploy replaced it - and reloading would only take the app away from
    // the reader. This matters in the installed app, which is used on buses.
    if (navigator.onLine === false) return;
    const last = Number(sessionStorage.getItem(HEAL_KEY) || 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(HEAL_KEY, String(Date.now()));
    void (async () => {
      try {
        if ("caches" in window) {
          await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
        }
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(
            registrations.map((r) => r.update().catch(() => r.unregister().catch(() => {}))),
          );
        }
      } catch {
        // Whatever failed here, the reload below is the part that matters.
      }
      window.location.reload();
    })();
  };
  window.addEventListener("vite:preloadError", healOnce);
  window.addEventListener("unhandledrejection", (event) => {
    const message = String((event.reason as Error)?.message ?? event.reason ?? "");
    if (/dynamically imported module|Importing a module script failed|Loading chunk/i.test(message)) {
      healOnce();
    }
  });
}

document.documentElement.dataset.appBuild = __APP_BUILD_ID__;

// Initialize Capacitor plugins on native platforms
if (Capacitor.isNativePlatform()) {
  // Capacitor 8 SystemBars is designed for Android's modern edge-to-edge
  // behavior and avoids the deprecated Window status-bar color APIs.
  SystemBars.setStyle({ style: SystemBarsStyle.Dark }).catch(() => {});
  SplashScreen.hide().catch(() => {});
}

const updateBottomSystemBarClass = () => {
  const insetValue = getComputedStyle(document.documentElement)
    .getPropertyValue('--safe-area-inset-bottom')
    .trim();
  const bottomInset = Number.parseFloat(insetValue) || 0;
  document.body.classList.toggle('has-bottom-system-bar', bottomInset > 0);
};

window.addEventListener('safeAreaUpdated', updateBottomSystemBarClass as EventListener);
window.addEventListener('resize', updateBottomSystemBarClass);
window.addEventListener('orientationchange', updateBottomSystemBarClass);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateBottomSystemBarClass, { once: true });
} else {
  updateBottomSystemBarClass();
}

createRoot(document.getElementById("root")!).render(<App />);
