// End-to-end proof that a database edit reaches a subscriber.
//
// Subscribing alone proves nothing: Supabase Realtime accepts a binding for any
// table name, including one that does not exist. The only trustworthy check is
// to write and then observe the event arrive.
//
// The write is deliberately a no-op on the data: the row's own `name` is
// written back to itself, so the values are unchanged while Postgres still
// emits an UPDATE.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs.readFileSync(file, "utf8").split(/\r?\n/)
      .filter((l) => l && !l.trimStart().startsWith("#") && l.includes("="))
      .map((l) => {
        const at = l.indexOf("=");
        return [l.slice(0, at).trim(), l.slice(at + 1).trim().replace(/^['"]|['"]$/g, "")];
      }),
  );
}
function reg(name) {
  try {
    const o = execFileSync("reg.exe", ["query", "HKCU\\Environment", "/v", name],
      { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    return o.match(new RegExp(`${name}\\s+REG_(?:SZ|EXPAND_SZ)\\s+(.+)$`, "m"))?.[1]?.trim();
  } catch { return undefined; }
}

const env = { ...readEnvFile(path.join(root, ".env")), ...process.env };
const projectRef = env.VITE_SUPABASE_PROJECT_ID || env.SUPABASE_PROJECT_ID;
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Same guard as direct-run.mjs: this writes, so never touch another project.
if (projectRef !== "bfiayuuhjtyccqobsjvl") {
  console.error(`Refusing unexpected project: ${projectRef || "missing"}`);
  process.exit(1);
}
const email = env.ADMIN_EMAIL || reg("ADMIN_EMAIL") || env.MIGRATION_ADMIN_EMAIL || reg("MIGRATION_ADMIN_EMAIL");
const password = env.ADMIN_PASSWORD || reg("ADMIN_PASSWORD") || env.MIGRATION_ADMIN_PASSWORD || reg("MIGRATION_ADMIN_PASSWORD");

async function login() {
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const b = await r.json();
  if (!r.ok) throw new Error(b.error_description || b.msg || "login failed");
  return b.access_token;
}

const token = await login();
console.log("admin login: ok");

// Read the row we will rewrite to itself.
const row = await (await fetch(`${url}/rest/v1/settings?select=id,name&limit=1`, {
  headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
})).json();
if (!row[0]) throw new Error("no settings row");
const { id, name } = row[0];
console.log(`target row: settings.id=${id}`);

const supabase = createClient(url, anonKey);
const channel = supabase.channel(`verify-e2e-${Date.now()}`);

const received = new Promise((resolve) => {
  const timer = setTimeout(() => resolve(null), 15_000);
  channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "settings" }, (payload) => {
    clearTimeout(timer);
    resolve(payload);
  });
});

await new Promise((resolve, reject) => {
  channel.subscribe((status, err) => {
    if (status === "SUBSCRIBED") resolve();
    else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error(err?.message || status));
  });
});
console.log("subscribed to settings changes");

// No-op write: same value back into the same column.
const patch = await fetch(`${url}/rest/v1/settings?id=eq.${id}`, {
  method: "PATCH",
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  },
  body: JSON.stringify({ name }),
});
console.log(`write issued: HTTP ${patch.status}${patch.ok ? "" : " — " + (await patch.text()).slice(0, 120)}`);

const event = await received;
await supabase.removeChannel(channel);

if (event) {
  console.log(`\nEVENT RECEIVED: ${event.eventType} on ${event.table}`);
  console.log(`payload carried full row: ${event.new && Object.keys(event.new).length > 3 ? "yes (REPLICA IDENTITY FULL works)" : "no"}`);
  console.log("\nRESULT: realtime sync is working end to end.");
  process.exit(0);
} else {
  console.log("\nRESULT: no event arrived within 15s — realtime is NOT delivering.");
  process.exit(1);
}
