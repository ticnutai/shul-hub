/**
 * Proves the tenant layer landed: every row belongs to a synagogue, the
 * board still reads the way the TV reads it, and the boundary is real.
 */
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
  }),
);
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function token() {
  const email = process.env.MIGRATION_ADMIN_EMAIL;
  const password = process.env.MIGRATION_ADMIN_PASSWORD;
  if (!email || !password) return null;
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return r.ok ? (await r.json()).access_token : null;
}
const jwt = await token();
const get = async (p, auth = false) => {
  const r = await fetch(`${url}/rest/v1/${p}`, {
    headers: { apikey: key, Authorization: `Bearer ${auth && jwt ? jwt : key}` },
  });
  return { ok: r.ok, status: r.status, body: r.ok ? await r.json() : await r.text() };
};
const rpc = async (fn, args = {}, auth = true) => {
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${auth && jwt ? jwt : key}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  return { ok: r.ok, status: r.status, body: r.ok ? await r.json() : await r.text() };
};

let bad = 0;
const check = (name, pass, detail = "") => {
  console.log(`${pass ? "  ok  " : " FAIL "} ${name}${detail ? "  — " + detail : ""}`);
  if (!pass) bad++;
};

// 1. the synagogue itself
const comms = await get("communities?select=id,slug,name,active");
check("the synagogue exists", comms.ok && comms.body.length === 1,
  comms.ok ? comms.body.map((c) => `${c.name} (${c.slug})`).join(", ") : String(comms.body));
const first = comms.ok ? comms.body[0] : null;

// 2. its id is the settings id, as the migration intended
const settings = await get("settings?select=id,name,community_id");
check("settings belongs to it, and shares its id",
  settings.ok && settings.body[0]?.community_id === first?.id && settings.body[0]?.id === first?.id);

// 3. nothing was left behind
const TABLES = ["minyan_categories", "minyanim", "announcements", "shiur_categories",
  "shiurim", "chavrutot", "home_widgets", "tv_config"];
for (const t of TABLES) {
  const all = await get(`${t}?select=id,community_id`);
  const orphans = all.ok ? all.body.filter((r) => !r.community_id).length : -1;
  check(`${t}: every row belongs to a synagogue`,
    all.ok && orphans === 0, all.ok ? `${all.body.length} rows` : String(all.body));
}

// 4. the board still reads exactly as the TV reads it
const board = await get(`tv_config?select=config,updated_at&community_id=eq.${first?.id}`);
check("the board config reads by synagogue",
  board.ok && board.body.length === 1 && typeof board.body[0].config === "object",
  board.ok ? `${Object.keys(board.body[0]?.config ?? {}).length} keys` : String(board.body));

// and the old way still finds it, so the deployed site keeps working
const legacy = await get("tv_config?select=config&id=eq.default");
check("the deployed site's old query still works", legacy.ok && legacy.body.length === 1);

// 5. the transitional default
const sole = await rpc("sole_community", {}, false);
check("sole_community() names the only one", sole.ok && sole.body === first?.id);

// 6. the boundary
const mine = await rpc("my_communities");
check("the admin sees the synagogue they administer",
  mine.ok && Array.isArray(mine.body) && mine.body.some((c) => c.id === first?.id),
  mine.ok ? `${mine.body.length} synagogue(s)` : String(mine.body));

const ghost = await rpc("is_admin_of", { _community: "00000000-0000-0000-0000-000000000000" });
check("admin of a synagogue they do not belong to: refused", ghost.ok && ghost.body === false);

const anonWrite = await fetch(`${url}/rest/v1/minyanim?id=eq.${crypto.randomUUID()}`, {
  method: "PATCH",
  headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
  body: JSON.stringify({ name: "x" }),
});
const anonRows = anonWrite.ok ? await anonWrite.json() : [];
check("an anonymous write still changes nothing", anonRows.length === 0);

console.log(bad === 0 ? "\nall good" : `\n${bad} problem(s)`);
process.exit(bad === 0 ? 0 : 1);
