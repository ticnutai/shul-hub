import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { devChatPlugin } from "./src/plugins/devChatPlugin";
import pkg from "./package.json" with { type: "json" };

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // The integration copy consumes only Shul Hub's root-level environment.
  // No .env file is copied from the pash source repository.
  envDir: "..",
  server: {
    host: "::",
    port: 4300,
    strictPort: true,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
  },
  plugins: [
    react(),
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
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['**/assets/data-*.js'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        // NOTE: Google Fonts (fonts.googleapis.com / fonts.gstatic.com) are intentionally
        // NOT routed through Workbox. The browser HTTP cache + Google CDN already serve
        // them optimally; intercepting through the SW caused a visible network race on
        // every reload (the "Workbox: finished loading https://fonts.googleapis..."
        // messages) which produced a late font swap and re-render after first paint.
        runtimeCaching: [
          {
            urlPattern: /\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'torah-data-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24
              }
            }
          }
        ]
      }
    })
  ].filter(Boolean),
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/data/bereishit.json')) return 'data-bereishit';
          if (id.includes('/src/data/shemot.json')) return 'data-shemot';
          if (id.includes('/src/data/vayikra.json')) return 'data-vayikra';
          if (id.includes('/src/data/bamidbar.json')) return 'data-bamidbar';
          if (id.includes('/src/data/devarim.json')) return 'data-devarim';
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
}));
