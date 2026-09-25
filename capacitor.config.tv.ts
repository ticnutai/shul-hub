import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for the Android TV wall display.
 *
 * A separate appId from the congregant app on purpose: the two are installed on
 * different devices, are updated on different schedules, and a mistake in the
 * display must never be able to reach the phone app already published on Play.
 * The native project lives in `android-tv/` so `npx cap sync android` for the
 * phone build cannot overwrite the TV manifest.
 */
const config: CapacitorConfig = {
  appId: 'com.ticnutai.bsr3synagogue.tv',
  appName: 'לוח בית כנסת בסר 3',
  webDir: 'dist-tv',
  server: {
    // The board loads itself from the website when it can (src/tv/remoteBoard.ts),
    // so a publish reaches the wall without a new APK. Without this entry
    // Capacitor would open that page in the system browser instead.
    allowNavigation: ['shul-hub.lovable.app'],
  },
  android: {
    path: 'android-tv',
    allowMixedContent: false,
    backgroundColor: '#0b1628',
    // Opens the WebView to Chrome DevTools Protocol, which scripts/tv-control.mjs
    // uses to read the DOM, run JS, and capture console/network on the box.
    // Capacitor only turns this on for debug builds; the board ships as a
    // release build, so without this flag the page was a black box - on the
    // device, uiautomator saw no WebView text at all.
    //
    // The socket is reachable only through an authorised ADB session: Chromium
    // accepts connections from the shell/root UID only (devtools_auth.cc). ADB
    // already gives full control of the device, so this widens nothing - the
    // real production switch is turning Wireless debugging OFF on the TV,
    // which closes both. Build with TV_WEBVIEW_DEBUG=0 to leave it out.
    webContentsDebuggingEnabled: process.env.TV_WEBVIEW_DEBUG !== '0',
  },
  plugins: {
    SplashScreen: {
      // A display that reboots after a power cut should return to the board as
      // quickly as possible, so the splash is brief and hides itself.
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: '#0b1628',
      showSpinner: false,
    },
  },
};

export default config;
