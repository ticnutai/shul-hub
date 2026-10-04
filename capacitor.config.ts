import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ticnutai.bsr3synagogue',
  appName: 'בית כנסת בסר 3',
  // Live builds carry only the offline page (the app itself comes from the site).
  webDir: process.env.CAP_LIVE === '1' ? 'dist-live' : 'dist',
  // CAP_LIVE=1: the app shows the website itself, so every publish reaches the
  // phone without a new APK. No service worker in the app (src/lib/swPolicy.ts):
  // offline.html is shown when the site cannot be reached. The Play build is
  // made without it, as before. CAP_LIVE_URL points a test build elsewhere
  // (an emulator at the computer's own server: http://10.0.2.2:4302/).
  ...(process.env.CAP_LIVE === '1'
    ? {
        server: {
          url: process.env.CAP_LIVE_URL || 'https://shul-hub.lovable.app/',
          errorPath: 'offline.html',
          ...(process.env.CAP_LIVE_URL?.startsWith('http:') ? { cleartext: true } : {}),
        },
      }
    : {}),
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#1e3a5f',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    // Capacitor 8 SystemBars is the edge-to-edge replacement for the legacy
    // StatusBar plugin. It injects reliable safe-area variables on Android.
    SystemBars: {
      insetsHandling: 'css',
      style: 'DARK',
      hidden: false,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#1e3a5f',
  },
};

export default config;
