/**
 * "גרסת ניסוי": the site against the real database, reading only.
 *
 * A rebuild is tried on a branch, served on its own port, over the shul's own
 * boards - and the database is the one the live site and the screens use. So
 * in this mode every write to it is stopped before it leaves the browser: a
 * save, a delete, an upload, a function that changes something. Reading, and
 * signing in, go through; the editor, the preview and every board work as
 * they would, and nothing reaches a screen or a congregant.
 *
 * On only when VITE_DESIGN_SANDBOX=1 (an .env.local of the trial checkout,
 * never committed), and imported first in main.tsx: the Supabase client keeps
 * the fetch it found when it was made, so this must be in place before it is.
 */

/** Server functions that only read; every other one changes something and is stopped. */
const READ_FUNCTIONS = new Set([
  "communities_overview",
  "get_migration_history",
  "is_admin",
  "is_platform_admin",
  "list_approved_chavruta_requests",
  "list_users_with_roles",
  "admin_list_users",
  "my_communities",
  "sole_community",
  "tv_community",
]);

export const SANDBOX = import.meta.env.VITE_DESIGN_SANDBOX === "1";

/** Would this request change the database or its files? */
export function isWrite(url: string, method: string, databaseHost: string): boolean {
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.host !== databaseHost) return false;
  if (u.pathname.startsWith("/auth/v1/")) return false;
  const rpc = /^\/rest\/v1\/rpc\/([a-z_]+)/.exec(u.pathname);
  if (rpc) return !READ_FUNCTIONS.has(rpc[1]!);
  return u.pathname.startsWith("/rest/v1/") || u.pathname.startsWith("/storage/v1/");
}

function install() {
  const host = (() => {
    try {
      return new URL(import.meta.env.VITE_SUPABASE_URL).host;
    } catch {
      return "";
    }
  })();
  const real = window.fetch.bind(window);
  let lastNote = 0;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    if (isWrite(url, method, host)) {
      if (Date.now() - lastNote > 2500) {
        lastNote = Date.now();
        window.dispatchEvent(new CustomEvent("sandbox-blocked"));
      }
      return new Response(JSON.stringify({ message: "גרסת ניסוי: השינוי לא נשמר", code: "SANDBOX" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
    return real(input, init);
  };

  // Always in sight: this is not the live site, and nothing here is kept.
  const badge = () => {
    const el = document.createElement("div");
    el.setAttribute("data-testid", "sandbox-badge");
    el.textContent = "🧪 גרסת ניסוי - אפשר לנסות הכול, שום דבר לא נשמר";
    el.style.cssText =
      "position:fixed;bottom:10px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#7a1020;color:#fff;" +
      "font:600 13px system-ui,sans-serif;padding:6px 14px;border-radius:999px;box-shadow:0 2px 10px rgba(0,0,0,.35);pointer-events:none;direction:rtl";
    document.body.appendChild(el);
    window.addEventListener("sandbox-blocked", () => {
      el.textContent = "🧪 גרסת ניסוי - השינוי לא נשמר (רק ניסיון)";
      el.style.background = "#b45309";
      window.setTimeout(() => {
        el.textContent = "🧪 גרסת ניסוי - אפשר לנסות הכול, שום דבר לא נשמר";
        el.style.background = "#7a1020";
      }, 3500);
    });
  };
  if (document.body) badge();
  else window.addEventListener("DOMContentLoaded", badge);
}

if (SANDBOX && typeof window !== "undefined") install();
