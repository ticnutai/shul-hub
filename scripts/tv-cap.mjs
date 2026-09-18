#!/usr/bin/env node
/**
 * Runs a Capacitor command against the Android TV configuration.
 *
 * The Capacitor CLI resolves `capacitor.config.ts` by a hard-coded name and
 * offers no override (see @capacitor/cli/dist/config.js), so the only way to
 * drive a second native project from one repository is to put the TV config in
 * place for the duration of the command.
 *
 * The swap is the risky part: if it were left half-applied, the next phone
 * build would silently emit an APK carrying the TV appId. The restore therefore
 * runs from a `finally` and from the signal handlers, and the original file is
 * kept in memory rather than on disk so a crashed run cannot leave a stray
 * backup that looks like the real config.
 *
 * Usage: node scripts/tv-cap.mjs <add|sync|copy|open> [...args]
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LIVE = resolve(root, "capacitor.config.ts");
const TV = resolve(root, "capacitor.config.tv.ts");

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: node scripts/tv-cap.mjs <add|sync|copy|open> [...args]");
  process.exit(1);
}

if (!existsSync(TV)) {
  console.error(`missing ${TV}`);
  process.exit(1);
}

const original = existsSync(LIVE) ? readFileSync(LIVE, "utf8") : null;
let restored = false;

function restore() {
  if (restored) return;
  restored = true;
  if (original !== null) writeFileSync(LIVE, original);
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    restore();
    process.exit(130);
  });
}
process.on("uncaughtException", (err) => {
  restore();
  throw err;
});

let status = 1;
try {
  writeFileSync(LIVE, readFileSync(TV, "utf8"));

  const result = spawnSync("npx", ["cap", ...args], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  status = result.status ?? 1;
} finally {
  restore();
}

process.exit(status);
