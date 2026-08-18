import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.trimStart().startsWith("#") && line.includes("="))
      .map((line) => {
        const at = line.indexOf("=");
        return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, "")];
      }),
  );
}

function readWindowsUserEnv(name) {
  if (process.platform !== "win32") return undefined;
  try {
    const output = execFileSync("reg.exe", ["query", "HKCU\\Environment", "/v", name], {
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output.match(new RegExp(`${name}\\s+REG_(?:SZ|EXPAND_SZ)\\s+(.+)$`, "m"))?.[1]?.trim();
  } catch {
    return undefined;
  }
}

const env = { ...readEnvFile(path.join(root, ".env")), ...readEnvFile(path.join(root, ".env.migrations.local")), ...process.env };
const projectRef = env.VITE_SUPABASE_PROJECT_ID || env.SUPABASE_PROJECT_ID;
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;
const adminEmail =
  env.ADMIN_EMAIL ||
  readWindowsUserEnv("ADMIN_EMAIL") ||
  env.MIGRATION_ADMIN_EMAIL ||
  readWindowsUserEnv("MIGRATION_ADMIN_EMAIL");
const adminPassword =
  env.ADMIN_PASSWORD ||
  readWindowsUserEnv("ADMIN_PASSWORD") ||
  env.MIGRATION_ADMIN_PASSWORD ||
  readWindowsUserEnv("MIGRATION_ADMIN_PASSWORD");

function requireConfig() {
  if (projectRef !== "bfiayuuhjtyccqobsjvl") throw new Error(`Refusing unexpected project: ${projectRef || "missing"}`);
  if (!supabaseUrl || !anonKey) throw new Error("Supabase project settings are missing");
  if (!adminEmail || !adminPassword) throw new Error("Migration admin credentials are not configured");
}

function splitSql(sql) {
  const statements = [];
  let current = "";
  let single = false;
  let double = false;
  let lineComment = false;
  let blockComment = false;
  let dollarTag = null;
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];
    if (lineComment) {
      current += char;
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      current += char;
      if (char === "*" && next === "/") { current += next; index += 1; blockComment = false; }
      continue;
    }
    if (!single && !double && !dollarTag && char === "-" && next === "-") { lineComment = true; current += `${char}${next}`; index += 1; continue; }
    if (!single && !double && !dollarTag && char === "/" && next === "*") { blockComment = true; current += `${char}${next}`; index += 1; continue; }
    if (!single && !double) {
      if (dollarTag) {
        if (sql.startsWith(dollarTag, index)) { current += dollarTag; index += dollarTag.length - 1; dollarTag = null; continue; }
      } else if (char === "$") {
        const match = sql.slice(index).match(/^\$[A-Za-z0-9_]*\$/);
        if (match) { dollarTag = match[0]; current += dollarTag; index += dollarTag.length - 1; continue; }
      }
    }
    if (!double && !dollarTag && char === "'" && !(single && next === "'")) single = !single;
    else if (single && char === "'" && next === "'") { current += `${char}${next}`; index += 1; continue; }
    if (!single && !dollarTag && char === '"') double = !double;
    if (char === ";" && !single && !double && !dollarTag) {
      if (current.trim()) statements.push(current.trim());
      current = "";
    } else current += char;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

async function loginAdmin() {
  requireConfig();
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw new Error(body.error_description || body.msg || "Admin login failed");
  return body.access_token;
}

async function execute(name, sql) {
  const accessToken = await loginAdmin();
  const statements = splitSql(sql).filter((statement) => !/^\s*(BEGIN|COMMIT|ROLLBACK)\b/i.test(statement));
  console.log(`Target project: ${projectRef}`);
  console.log(`Running migration: ${name} (${statements.length} statements)`);
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_admin_migration`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_name: name, p_statements: statements }),
    signal: AbortSignal.timeout(120_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `Supabase returned HTTP ${response.status}`);
  if (!body.success) throw new Error(body.error || "Migration RPC returned failure");
  console.log("Migration completed successfully");
}

function migrationFile(relativePath) {
  const full = path.resolve(root, relativePath);
  const migrationsRoot = path.resolve(root, "supabase", "migrations") + path.sep;
  if (!full.startsWith(migrationsRoot)) throw new Error("Migration file must be inside supabase/migrations");
  if (!fs.existsSync(full)) throw new Error(`Migration file not found: ${relativePath}`);
  return full;
}

async function main() {
  const [command, value] = process.argv.slice(2);
  if (command !== "file" || !value) throw new Error("Usage: node scripts/direct-run.mjs file <supabase/migrations/file.sql>");
  const full = migrationFile(value);
  await execute(path.basename(full, ".sql"), fs.readFileSync(full, "utf8"));
}

main().catch((error) => {
  console.error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
