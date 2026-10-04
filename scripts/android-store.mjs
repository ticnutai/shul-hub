// The app for Google Play: the site packed inside it (it opens and reads
// without network, as before), without what does not belong in a store app -
// the TV board (its page and the files that install it), the downloadable
// apps, and the website's service worker. Then signed with the store's upload
// key (android/app/signing.properties, kept out of git):
//   npm run build && node scripts/android-store.mjs && cd android && gradlew bundleRelease
import { cpSync, existsSync, readdirSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

if (!existsSync("dist/index.html")) throw new Error("build the site first: npm run build");
if (!existsSync("android/app/signing.properties")) throw new Error("android/app/signing.properties (the upload key) is missing");

const OUT = "dist-store";
const LEAVE_OUT = [
  /\.apk$/i,
  /^tv-version\.json$/,
  /^index-tv\.html$/,
  /^index-tv-[\w-]+\.(js|css)$/,
  // The app has no service worker (src/lib/swPolicy.ts).
  /^sw\.js$/,
  /^workbox-[\w-]+\.js$/,
  /^push-sw\.js$/,
  // Internal to the project, never for anyone's phone.
  /^pending-migrations\.json$/,
];

rmSync(OUT, { recursive: true, force: true });
cpSync("dist", OUT, {
  recursive: true,
  filter: (src) => !LEAVE_OUT.some((re) => re.test(path.basename(src))),
});

const left = (dir) => readdirSync(dir, { recursive: true }).map(String);
const stray = left(OUT).filter((f) => LEAVE_OUT.some((re) => re.test(path.basename(f))));
if (stray.length) throw new Error(`left in by mistake: ${stray.join(", ")}`);
console.log(`${OUT}: ${left(OUT).length} files, without the TV board and the apps`);

execSync("npx cap sync android", { stdio: "inherit", env: { ...process.env, CAP_LIVE: "", CAP_STORE: "1" } });
