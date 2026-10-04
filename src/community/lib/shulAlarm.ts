import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * The app's own part for what Android's ordinary notifications cannot do
 * (android/app/.../ShulAlarmPlugin.java), from app version 1.11:
 *   - a minyan that rings like an alarm clock, on the whole screen, even
 *     locked - for whoever chooses it;
 *   - new notices from the gabbai while the app is closed: the phone looks
 *     every quarter of an hour, never on Shabbat or Yom Tov.
 * An older app has no such part; everything here is then simply not offered.
 */
export interface ShulAlarmPlugin {
  schedule(options: { alarms: Array<{ id: number; at: number; title: string; body: string }> }): Promise<void>;
  status(): Promise<{ exact: boolean; fullScreen: boolean }>;
  openExactSettings(): Promise<void>;
  openFullScreenSettings(): Promise<void>;
  configureNotices(options: {
    enabled: boolean;
    url: string;
    key: string;
    communityId: string;
    seen: string[];
    quiet: Array<{ start: number; end: number }>;
  }): Promise<void>;
  test(options: { title: string; body: string }): Promise<void>;
  /** Looks for new notices now; `forget` makes the phone tell those again (testing). */
  checkNow(options?: { forget?: string[] }): Promise<void>;
}

export const ShulAlarm = registerPlugin<ShulAlarmPlugin>("ShulAlarm");

export const hasShulAlarm = (): boolean => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("ShulAlarm");
