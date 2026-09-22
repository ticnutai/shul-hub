/**
 * Uniqueness on a shared table must name the synagogue.
 *
 * This is the third time the same mistake has been found, and each time it
 * looked like something else:
 *
 *   user_roles UNIQUE (user_id, role)      one person could not administer
 *                                          two synagogues
 *   minyan_categories.system_key UNIQUE    the second synagogue could not
 *                                          have a weekday tab, so its board
 *                                          read "no minyanim today"
 *   shiur_categories.name, home_widgets.key  the same, not yet reached
 *
 * None of them was a data problem. Each was a rule written when the answer
 * to "which synagogue?" was "the synagogue", still being enforced after that
 * stopped being true. They surface as a duplicate-key error on the day a
 * second community is set up, far from the line that caused them.
 *
 * So: read the migrations, find every unique key on a table that belongs to
 * one synagogue, and require that it either includes community_id or is
 * listed below with a reason. A test cannot know which uniqueness is
 * intended - but it can insist that somebody decided.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/** The tables a synagogue owns rows in. Same list as the tenant layer. */
const TENANT_TABLES = [
  "settings", "minyan_categories", "minyanim", "announcements",
  "shiur_categories", "shiurim", "chavrutot", "chavruta_requests",
  "admin_messages", "home_widgets", "app_themes", "tv_config", "tv_devices",
  "user_roles",
];

/**
 * Unique keys that are global on purpose, each with the reason.
 *
 * Adding a line here is a decision about what may exist twice in the world.
 */
const DELIBERATE: Record<string, string> = {
  tv_devices_pairing_code_key:
    "a pairing code is typed by an admin before the screen belongs to any synagogue, " +
    "so it has to identify one screen across all of them",
  user_roles_platform_key:
    "a platform administrator is not a member of any one synagogue - that is what the role means",
};

const root = path.resolve(__dirname, "../../..");
const dir = path.join(root, "supabase", "migrations");

const migrations = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => ({ file: f, sql: fs.readFileSync(path.join(dir, f), "utf8") }));

const allSql = migrations.map((m) => m.sql).join("\n");

interface Key {
  name: string;
  table: string;
  columns: string;
  where: string;
}

/** Every unique key the migrations declare on a tenant table. */
function declaredKeys(): Key[] {
  const found: Key[] = [];

  for (const { file, sql } of migrations) {
    // CREATE UNIQUE INDEX [IF NOT EXISTS] <name> ON public.<table> (<cols>)
    for (const m of sql.matchAll(
      /CREATE\s+UNIQUE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+ON\s+public\.(\w+)\s*\(([^)]*)\)/gi,
    )) {
      found.push({ name: m[1], table: m[2], columns: m[3], where: file });
    }

    // ALTER TABLE public.<table> ADD CONSTRAINT <name> UNIQUE (<cols>)
    for (const m of sql.matchAll(
      /ALTER\s+TABLE\s+(?:ONLY\s+)?public\.(\w+)[\s\S]{0,80}?ADD\s+CONSTRAINT\s+(\w+)\s+UNIQUE\s*\(([^)]*)\)/gi,
    )) {
      found.push({ name: m[2], table: m[1], columns: m[3], where: file });
    }

    // Inside CREATE TABLE: column-level UNIQUE, and table-level UNIQUE (...).
    for (const m of sql.matchAll(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.(\w+)\s*\(([\s\S]*?)\n\)/gi,
    )) {
      const table = m[1];
      for (const line of m[2].split("\n")) {
        const body = line.split("--")[0];
        if (!/\bUNIQUE\b/i.test(body)) continue;

        const named = body.match(/CONSTRAINT\s+(\w+)\s+UNIQUE\s*\(([^)]*)\)/i);
        if (named) {
          found.push({ name: named[1], table, columns: named[2], where: file });
          continue;
        }
        const tableLevel = body.match(/^\s*UNIQUE\s*\(([^)]*)\)/i);
        if (tableLevel) {
          const cols = tableLevel[1].split(",").map((c) => c.trim());
          // Postgres names it <table>_<col>_..._key
          found.push({
            name: `${table}_${cols.join("_")}_key`,
            table,
            columns: tableLevel[1],
            where: file,
          });
          continue;
        }
        const column = body.match(/^\s*(\w+)\s+/);
        if (column) {
          found.push({
            name: `${table}_${column[1]}_key`,
            table,
            columns: column[1],
            where: file,
          });
        }
      }
    }
  }

  return found.filter((k) => TENANT_TABLES.includes(k.table));
}

/** Was this key later taken off? */
function dropped(name: string): boolean {
  return (
    new RegExp(`DROP\\s+CONSTRAINT\\s+(?:IF\\s+EXISTS\\s+)?${name}\\b`, "i").test(allSql) ||
    new RegExp(`DROP\\s+INDEX\\s+(?:IF\\s+EXISTS\\s+)?(?:public\\.)?${name}\\b`, "i").test(allSql)
  );
}

describe("uniqueness on a synagogue's tables", () => {
  const keys = declaredKeys();

  it("finds the migrations to check", () => {
    expect(migrations.length).toBeGreaterThan(20);
    expect(keys.length).toBeGreaterThan(3);
  });

  it("every unique key names the synagogue, or says why it does not", () => {
    const global = keys
      .filter((k) => !/\bcommunity_id\b/.test(k.columns))
      .filter((k) => !dropped(k.name))
      .filter((k) => !(k.name in DELIBERATE))
      .map((k) => `${k.where}: ${k.table} UNIQUE (${k.columns.trim()}) as ${k.name}`);

    expect(
      global,
      "these say something may exist only once in the world, across every synagogue",
    ).toEqual([]);
  });

  it("the keys that bit us are gone", () => {
    for (const name of [
      "minyan_categories_system_key_key",
      "shiur_categories_name_key",
      "home_widgets_key_key",
      "user_roles_user_id_role_key",
    ]) {
      expect(dropped(name), `${name} is still in force`).toBe(true);
    }
  });

  it("and were replaced by per-synagogue ones", () => {
    for (const name of [
      "minyan_categories_community_system_key",
      "shiur_categories_community_name_key",
      "home_widgets_community_key",
      "user_roles_member_key",
    ]) {
      expect(
        new RegExp(`CREATE\\s+UNIQUE\\s+INDEX[\\s\\S]{0,40}?${name}\\b`, "i").test(allSql),
        `${name} was never created`,
      ).toBe(true);
    }
  });

  it("every reason on the deliberate list belongs to a key that exists", () => {
    for (const name of Object.keys(DELIBERATE)) {
      expect(
        new RegExp(`\\b${name}\\b`).test(allSql),
        `${name} is excused but no longer declared anywhere`,
      ).toBe(true);
    }
  });
});
