import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { devChatPlugin } from "./src/plugins/devChatPlugin";
import { cpSync } from "fs";
import pkg from "./package.json" with { type: "json" };

/**
 * The board page (index-tv.html) links its bundled fonts as ./fonts/fonts.css.
 * They live in public-tv/ for the APK; copy them next to the page here too.
 */
function tvBoardFonts(): Plugin {
  return {
    name: "tv-board-fonts",
    apply: "build",
    closeBundle() {
      cpSync(path.resolve(__dirname, "public-tv/fonts"), path.resolve(__dirname, "dist/fonts"), { recursive: true });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // The integration copy consumes only Shul Hub's root-level environment.
  // No .env file is copied from the pash source repository.
  envDir: ".",
  server: {
    host: "::",
    port: 4300,
    strictPort: true,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
  },
  // Vite 5 builds an imported .json into a JavaScript object literal, which
  // the engine then has to parse as code. `stringify` makes it
  // `JSON.parse("...")` instead, and the JSON parser is a great deal faster
  // at this than the JavaScript parser. Measured here on one 1.2 MB siddur
  // file: 5.0ms as a literal, 2.7ms through JSON.parse - and the machine that
  // matters is a television, not this one. There are 92 MB of these files.
  // (Vite 6 makes this the default for anything over 10 kB.)
  json: { stringify: true },
  plugins: [
    react(),
    tvBoardFonts(),
    mode === "development" && componentTagger(),
    mode === "development" && devChatPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        // Disable PWA/SW in `npm run dev` so localhost stays free of cached
        // assets and stale service workers. Use `npm run preview` to test the
        // real PWA build before deploy.
        enabled: false,
      },
      includeAssets: ['favicon.ico', 'robots.txt'],
      manifest: {
        name: 'בית כנסת בסר 3 - תורה וקהילה',
        short_name: 'בית כנסת בסר 3',
        description: 'זמני תפילות, קהילה וספריית תורה עם שאלות ופירושים',
        theme_color: '#1e3a5f',
        background_color: '#ffffff',
        display: 'standalone',
        dir: 'rtl',
        lang: 'he',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Activate a new application shell immediately and remove only
        // obsolete Workbox precaches. User settings in localStorage and
        // IndexedDB are deliberately left untouched.
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Precache the application shell only. The Torah text, the siddurim and
        // the Sefaria commentaries are all reached through dynamic import(), so
        // precaching them forced every install and every update to pull ~49 MB
        // before the app became usable — painful on mobile data and on a TV.
        // They are cached on first use by the runtimeCaching rule below instead,
        // which keeps offline reading working without the upfront download.
        globIgnores: [
          '**/assets/data-*.js', // chumash: bereishit .. devarim
          '**/assets/siddur_*.js', // siddur nusachim
          '**/assets/*_on_*.js', // Sefaria commentaries (Rashi_on_Genesis, ...)
          // Nevi'im and Ketuvim. These were meant to be covered by the rule
          // above and were not: their chunks are named after the book, so
          // "data-" never matched them, and 2.8 MB of scripture was pulled on
          // every install. Same treatment as the chumash - fetched when
          // somebody opens them, kept afterwards by the runtime rule below.
          '**/assets/i_samuel-*.js',
          '**/assets/ii_samuel-*.js',
          '**/assets/i_kings-*.js',
          '**/assets/ii_kings-*.js',
          '**/assets/joshua-*.js',
          '**/assets/judges-*.js',
          '**/assets/esther-*.js',
          '**/assets/tehillim-*.js',
          // The management screens. Every visitor was downloading 1.4 MB of
          // an editor they will never open; a gabbai who does open it is by
          // definition online, because it exists to write to the server.
          '**/assets/Admin-*.js',
          '**/assets/TvDesignPanel-*.js',
          '**/assets/TvDesignPanel-*.css',
          '**/assets/tvAdminData-*.js',
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        // Files that are not the app: an installer, the wall board and its
        // fonts. Without this the service worker answered them with the app
        // shell - tapping the phone's download link opened the app instead of
        // downloading anything.
        navigateFallbackDenylist: [/\.apk$/, /^\/index-tv\.html/, /^\/fonts\//],
        // NOTE: Google Fonts (fonts.googleapis.com / fonts.gstatic.com) are intentionally
        // NOT routed through Workbox. The browser HTTP cache + Google CDN already serve
        // them optimally; intercepting through the SW caused a visible network race on
        // every reload (the "Workbox: finished loading https://fonts.googleapis..."
        // messages) which produced a late font swap and re-render after first paint.
        runtimeCaching: [
          {
            // The Torah/siddur/commentary payloads are bundled into hashed .js
            // chunks at build time, so the previous /\.json$/ rule never matched
            // anything in production. Matching the emitted chunk names instead
            // means a sefer is downloaded once, on the first time it is opened,
            // and stays available offline afterwards. The content hash in the
            // filename makes CacheFirst safe: a new build is a new URL.
            urlPattern: /\/assets\/(data-|siddur_|[^/]*_on_)[^/]*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'torah-data-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
          // Supabase is intentionally not cached by the service worker. Live
          // announcements, prayer times and admin changes must reach mobile
          // clients immediately.
        ]
      }
    })
  ].filter(Boolean),
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      // The wall board is published with the site (index-tv.html), so the TV
      // app can load it from here and pick up every change without a new APK
      // (src/tv/remoteBoard.ts). Same bundle as the Capacitor build.
      input: {
        index: path.resolve(__dirname, "index.html"),
        "index-tv": path.resolve(__dirname, "index-tv.html"),
      },
      output: {
        manualChunks(id) {
          if (id.includes('/src/data/bereishit.json')) return 'data-bereishit';
          if (id.includes('/src/data/shemot.json')) return 'data-shemot';
          if (id.includes('/src/data/vayikra.json')) return 'data-vayikra';
          if (id.includes('/src/data/bamidbar.json')) return 'data-bamidbar';
          if (id.includes('/src/data/devarim.json')) return 'data-devarim';
          // Same "data-" prefix: left out of the install, cached on first open.
          if (id.includes('/src/data/haftarot.json')) return 'data-haftarot';
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@community": path.resolve(__dirname, "./src/community"),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD_ID__: JSON.stringify(process.env.VITE_PWA_BUILD_ID || pkg.version),
  },
}));
