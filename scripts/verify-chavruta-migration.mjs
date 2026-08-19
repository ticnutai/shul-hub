import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const at = line.indexOf("=");
        return [line.slice(0, at), line.slice(at + 1).replace(/^['"]|['"]$/g, "")];
      }),
  );
}

const env = {
  ...readEnv(path.join(root, ".env")),
  ...readEnv(path.join(root, ".env.migrations.local")),
  ...process.env,
};
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const email = env.ADMIN_EMAIL;
const password = env.ADMIN_PASSWORD;
if (!url || !key || !email || !password) throw new Error("Missing verification configuration");

const id = crypto.randomUUID();
const anonHeaders = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};
let adminHeaders;

async function json(response) {
  return response.json().catch(() => null);
}

try {
  const insert = await fetch(`${url}/rest/v1/chavruta_requests`, {
    method: "POST",
    headers: { ...anonHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({
      id,
      name: "בדיקת מערכת",
      phone: "0500000000",
      email: "qa@example.invalid",
      topic: "בדיקת חברותא",
      status: "pending",
      share_contact: false,
    }),
  });
  if (!insert.ok) throw new Error(`Guest insert failed (${insert.status})`);

  const publicSelect = await fetch(`${url}/rest/v1/chavruta_requests?id=eq.${id}`, {
    headers: anonHeaders,
  });
  if (publicSelect.ok) throw new Error("Anonymous direct SELECT was unexpectedly allowed");

  const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const session = await json(login);
  if (!login.ok || !session?.access_token) throw new Error("Admin login failed");
  adminHeaders = {
    apikey: key,
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };

  const adminRead = await fetch(`${url}/rest/v1/chavruta_requests?id=eq.${id}`, {
    headers: adminHeaders,
  });
  const rows = await json(adminRead);
  if (!adminRead.ok || rows?.[0]?.status !== "pending")
    throw new Error("Admin could not read pending request");

  const approve = await fetch(`${url}/rest/v1/chavruta_requests?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...adminHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({ status: "approved" }),
  });
  if (!approve.ok) throw new Error(`Admin approval failed (${approve.status})`);

  const list = await fetch(`${url}/rest/v1/rpc/list_approved_chavruta_requests`, {
    method: "POST",
    headers: anonHeaders,
    body: "{}",
  });
  const approved = await json(list);
  const testRow = approved?.find((row) => row.id === id);
  if (!list.ok || !testRow) throw new Error("Approved request is missing from public RPC");
  if (testRow.phone !== "" || testRow.email !== "")
    throw new Error("Contact details were not masked");

  console.log("Guest insert: passed");
  console.log("Anonymous direct SELECT denial: passed");
  console.log("Admin read and approval: passed");
  console.log("Public RPC contact masking: passed");
} finally {
  if (adminHeaders) {
    const remove = await fetch(`${url}/rest/v1/chavruta_requests?id=eq.${id}`, {
      method: "DELETE",
      headers: { ...adminHeaders, Prefer: "return=minimal" },
    });
    if (!remove.ok) throw new Error(`Test cleanup failed (${remove.status})`);
    const verify = await fetch(`${url}/rest/v1/chavruta_requests?id=eq.${id}`, {
      headers: adminHeaders,
    });
    const remaining = await json(verify);
    if (!verify.ok || remaining?.length !== 0)
      throw new Error("Test record still exists after cleanup");
    console.log("Test data cleanup: passed");
  }
}
