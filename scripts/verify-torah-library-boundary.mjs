import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const allowedSupabaseHost = "bfiayuuhjtyccqobsjvl.supabase.co";
const forbiddenSupabaseHost = "mocukhvfqqzkekphifsr.supabase.co";
const featureRoot = path.join(root, "src", "features", "torah-library");
const manifestPath = path.join(root, "public", "torah-data", "content-manifest.json");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(resolved) : [resolved];
  });
}

const env = fs.readFileSync(path.join(root, ".env"), "utf8");
if (!env.includes(allowedSupabaseHost)) {
  throw new Error(`Shul Hub .env is not connected to ${allowedSupabaseHost}`);
}
if (env.includes(forbiddenSupabaseHost)) {
  throw new Error("The pash Supabase project was found in the Shul Hub environment");
}

for (const file of walk(featureRoot)) {
  const contents = fs.readFileSync(file, "utf8");
  if (contents.includes(forbiddenSupabaseHost) || contents.includes("@/integrations/supabase")) {
    throw new Error(`Supabase boundary violation in ${path.relative(root, file)}`);
  }
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (
  manifest.sourceSupabaseImported !== false ||
  manifest.importMode !== "read-only allowlisted JSON copy"
) {
  throw new Error("Torah library manifest does not guarantee read-only, data-only import mode");
}

console.log(`Supabase boundary verified: ${allowedSupabaseHost}`);
console.log(`Forbidden source account absent: ${forbiddenSupabaseHost}`);
console.log(`Read-only content files verified: ${manifest.files.length}`);
