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
  android: {
    path: 'android-tv',
    allowMixedContent: false,
    backgroundColor: '#0b1628',
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
