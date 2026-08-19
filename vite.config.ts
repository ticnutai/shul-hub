// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

function localMigrationCredentials(): Plugin {
  return {
    name: "local-migration-credentials",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__dev/migration-credentials", (request, response, next) => {
        if (request.method !== "POST") return next();
        const remoteAddress = request.socket.remoteAddress ?? "";
        if (!/^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(remoteAddress)) {
          response.statusCode = 403;
          response.end("Local access only");
          return;
        }
        const origin = request.headers.origin;
        if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          response.statusCode = 403;
          response.end("Invalid origin");
          return;
        }

        let body = "";
        request.on("data", (chunk) => {
          body += chunk;
          if (body.length > 16_384) request.destroy();
        });
        request.on("end", () => {
          try {
            const parsed = JSON.parse(body) as { email?: string; password?: string };
            const email = parsed.email?.trim() ?? "";
            const password = parsed.password ?? "";
            if (!email || !password || /[\r\n]/.test(email) || /[\r\n]/.test(password)) {
              response.statusCode = 400;
              response.end("Invalid credentials");
              return;
            }
            fs.writeFileSync(
              path.resolve(process.cwd(), ".env.migrations.local"),
              `ADMIN_EMAIL=${email}\nADMIN_PASSWORD=${password}\n`,
              { encoding: "utf8", mode: 0o600 },
            );
            response.statusCode = 204;
            response.end();
          } catch {
            response.statusCode = 400;
            response.end("Invalid request");
          }
        });
      });
    },
  };
}

export default defineConfig({
  vite: {
    plugins: [localMigrationCredentials()],
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
