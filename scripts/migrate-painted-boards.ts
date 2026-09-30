/**
 * Moves the boards that show a painting onto the ready design that replaces it.
 *
 *   npx vite-node scripts/migrate-painted-boards.ts            (a dry run: prints what would change)
 *   npx vite-node scripts/migrate-painted-boards.ts --apply    (writes, after saving a backup)
 *
 * Signs in as the migration administrator (.env.migrations.local). Before
 * writing, every board's stored config is saved whole to
 * backups/painted-boards-<time>.json; to undo, write those back.
 * A board whose row changed since it was read is left alone.
 */
import fs from "node:fs";
import { normalizeTvConfig } from "../src/tv/config";
import { migratePainted } from "../src/tv/paintedMigration";

const readEnv = (file: string) =>
  Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
      }),
  );

const env = readEnv(".env");
const local = readEnv(".env.migrations.local");
const URL_ = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const apply = process.argv.includes("--apply");

const login = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: KEY, "Content-Type": "application/json" },
  body: JSON.stringify({
    email: local.MIGRATION_ADMIN_EMAIL,
    password: local.MIGRATION_ADMIN_PASSWORD || process.env.MIGRATION_ADMIN_PASSWORD,
  }),
});
const token = (await login.json()).access_token;
if (!token) throw new Error("administrator sign-in failed");
const H = { apikey: KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const get = async (q: string) => {
  const r = await fetch(`${URL_}/rest/v1/${q}`, { headers: H });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
};

type Row = { community_id: string; updated_at: string; config: Record<string, unknown> };
const rows: Row[] = await get("tv_config?select=community_id,updated_at,config");
const names: Record<string, string> = Object.fromEntries(
  (await get("communities?select=id,name")).map((c: { id: string; name: string }) => [c.id, c.name]),
);

const painted = rows.filter((r) => r.config?.screenLayout === "illustrated");
if (!painted.length) {
  console.log("no painted boards - nothing to do");
  process.exit(0);
}

const plans = painted.map((r) => {
  const before = normalizeTvConfig(r.config);
  const after = migratePainted(before);
  return { row: r, before, after, moved: after !== before };
});
for (const p of plans) {
  const n = names[p.row.community_id] ?? p.row.community_id;
  if (!p.moved) console.log(`${n}: painting "${p.before.illustration}" has no design - left as it is`);
  else
    console.log(
      `${n}: "${p.before.illustration}" -> layout ${p.after.screenLayout}, background ${p.after.backgroundImage}, ` +
        `frames ${p.after.frameStyle.image ?? p.after.frame.shape}, text scale ${p.after.textScale}, hidden ${JSON.stringify(p.after.hidden)}`,
    );
}
if (!apply) {
  console.log("\ndry run - pass --apply to write");
  process.exit(0);
}

fs.mkdirSync("backups", { recursive: true });
const backup = `backups/painted-boards-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
fs.writeFileSync(backup, JSON.stringify(painted, null, 2));
console.log(`\nbackup: ${backup}`);

for (const p of plans.filter((x) => x.moved)) {
  const n = names[p.row.community_id] ?? p.row.community_id;
  const q = `tv_config?community_id=eq.${p.row.community_id}&updated_at=eq.${encodeURIComponent(p.row.updated_at)}`;
  const r = await fetch(`${URL_}/rest/v1/${q}`, {
    method: "PATCH",
    headers: { ...H, Prefer: "return=representation" },
    // Stamped like a save from the admin, which checks it before writing over a board.
    body: JSON.stringify({ config: p.after, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error(`${n}: ${r.status} ${await r.text()}`);
  const written = (await r.json()) as unknown[];
  console.log(written.length ? `${n}: moved` : `${n}: changed since it was read - left alone`);
}
