import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ticnutai.bsr3synagogue',
  appName: 'בית כנסת בסר 3',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#1e3a5f',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1e3a5f',
    },
    // Capacitor 8: SystemBars replaces StatusBar for edge-to-edge apps.
    // insetsHandling: "css" → auto-injects --safe-area-inset-* vars in WebView.
    SystemBars: {
      insetsHandling: 'css',
      style: 'DARK',
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
