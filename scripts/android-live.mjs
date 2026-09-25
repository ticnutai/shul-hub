// Prepares the "live" phone app: it shows https://shul-hub.lovable.app itself,
// so every publish reaches the phone without a new APK. Only the offline page
// is packaged. Then: cd android && gradlew assembleDebugParallel
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";

rmSync("dist-live", { recursive: true, force: true });
mkdirSync("dist-live");
cpSync("public/offline.html", "dist-live/offline.html");
cpSync("public/offline.html", "dist-live/index.html");
execSync("npx cap sync android", { stdio: "inherit", env: { ...process.env, CAP_LIVE: "1" } });
