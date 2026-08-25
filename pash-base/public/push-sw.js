/// <reference lib="webworker" />
/* ─── Push Notification Service Worker ──────────────────────
 * Runs in the background even when the browser tab is closed.
 * Receives push events from the server and shows notifications.
 * ────────────────────────────────────────────────────────── */

// Skip the wait queue on install so the activate handler (and its self-heal
// scope check) runs immediately on every update — otherwise a buggy version
// stuck in WAITING never gets a chance to unregister itself.
self.addEventListener("install", () => {
  self.skipWaiting();
});

// Allow the page to force-activate if needed.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "חומשי תורה", body: event.data.text() };
  }

  const title = payload.title || "חמישה חומשי תורה";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192x192.png",
    badge: "/icon-192x192.png",
    dir: "rtl",
    lang: "he",
    tag: payload.tag || "torah-push",
    renotify: true,
    vibrate: [200, 100, 200, 100, 200], // vibration pattern for sound/haptic
    requireInteraction: true, // stay visible until user interacts
    data: {
      url: payload.url || "/",
      reminderId: payload.reminderId,
      type: payload.type, // "daily" | "omer"
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if found
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open new tab
      return self.clients.openWindow(url);
    })
  );
});

// Activate handler: self-heal if we're registered at the wrong scope, then claim.
//
// HISTORY: Previously this SW was registered with `{ scope: "/" }`, the same
// scope as VitePWA's `sw.js`. Two SWs at the same scope made the browser
// ping-pong the controller; combined with `clients.claim()` here AND VitePWA's
// `registerType:'autoUpdate'`, every controllerchange triggered an automatic
// `window.location.reload()` — producing the production reload loop.
//
// We now register at `{ scope: "/push/" }`, but any user who installed the old
// version still has this SW sitting at scope `/`. The page-side cleanup may
// never run if it's stuck in the loop. So we let the SW self-destruct here:
// when we activate, if our scope is the origin root we unregister ourselves
// instead of claiming clients. After that, `sw.js` is the sole controller and
// the loop ends.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const scopeUrl = new URL(self.registration.scope);
        if (scopeUrl.pathname === "/") {
          // Wrong scope — bail out and remove ourselves so we never become controller.
          await self.registration.unregister();
          return;
        }
      } catch {
        /* ignore */
      }
      // Correct scope: take control of any /push/ clients (none in practice).
      await self.clients.claim();
    })()
  );
});
