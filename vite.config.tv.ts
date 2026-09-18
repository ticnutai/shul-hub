import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { renameSync, existsSync } from "fs";
import pkg from "./package.json" with { type: "json" };

/**
 * Build configuration for the synagogue wall display (Android TV).
 *
 * Separate from `vite.config.ts` on purpose:
 *
 * - Different entry (`index-tv.html`) pulling in only `src/tv`, so none of the
 *   Torah/siddur payload — the bulk of the main bundle — is reachable here.
 * - No PWA plugin. The display ships as a Capacitor app with its assets already
 *   on the device, so a service worker would add an update path with nothing to
 *   update and one more thing to go wrong on an unattended screen.
 * - Relative base, required for the `file://` origin Capacitor serves from.
 */

/**
 * Capacitor looks for `index.html` in `webDir`. Rolling the multi-page entry
 * back to that name here keeps the build a single command.
 */
function renameEntryForCapacitor(outDir: string): Plugin {
  return {
    name: "tv-rename-entry",
    apply: "build",
    closeBundle() {
      const built = path.resolve(__dirname, outDir, "index-tv.html");
      const target = path.resolve(__dirname, outDir, "index.html");
      if (existsSync(built)) renameSync(built, target);
    },
  };
}

const OUT_DIR = "dist-tv";

export default defineConfig({
  envDir: ".",
  base: "./",
  plugins: [react(), renameEntryForCapacitor(OUT_DIR)],
  server: {
    host: "::",
    port: 4310,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@community": path.resolve(__dirname, "./src/community"),
    },
  },
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "index-tv.html"),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD_ID__: JSON.stringify(process.env.VITE_PWA_BUILD_ID || pkg.version),
  },
});
