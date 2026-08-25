import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { torahDB } from "./utils/torahDB";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
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

// Initialize Capacitor plugins on native platforms
if (Capacitor.isNativePlatform()) {
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  StatusBar.setBackgroundColor({ color: '#1e3a5f' }).catch(() => {});
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
