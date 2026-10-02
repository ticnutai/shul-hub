/**
 * The board a screen draws, from the board the gabbai saved.
 *
 * One function, used by the screen itself (TvApp) and by the admin's picture
 * of that screen ("מה מוצג עכשיו על המסך"). They were two: the screen applied
 * the settings for its kind of screen and the look of the day, the admin's
 * copy applied neither - so at אהל אברהם, whose TV has its own skin, theme,
 * layout and no logo, the admin showed a dark board with two logos while the
 * wall showed a light-blue one without. Nothing was out of date; the admin
 * was drawing a different board.
 */
import { applyDayLook } from "./dayLooks";
import { configForDevice, type TvConfig } from "./config";
import type { DeviceClass } from "./devices";
import { allThemes } from "./themes";
import type { Settings } from "@community/lib/data";

export function boardConfig(
  saved: TvConfig,
  {
    deviceClass,
    themeOverride,
    now,
    settings,
    slideId,
  }: {
    deviceClass: DeviceClass;
    /** A theme chosen from the remote on this screen. */
    themeOverride?: string | null;
    /**
     * The slide up now. An occasion's own screen wears the occasion's design;
     * without it, only a design that dresses the whole board is applied -
     * which is what the slides are built from.
     */
    slideId?: string | null;
    now: Date;
    settings: Settings | null | undefined;
  },
): TvConfig {
  // When Shabbat and Yom Tov end is the synagogue's setting, shared with the
  // website; the board's own old number is only a fallback.
  const withEnd =
    typeof settings?.shabbat_end_minutes === "number"
      ? { ...saved, shabbat: { ...saved.shabbat, endMinutesAfterSunset: settings.shabbat_end_minutes } }
      : saved;
  // This kind of screen's own settings...
  const forScreen = configForDevice(withEnd, deviceClass);
  // ...and over them a theme chosen from this screen's remote: the most
  // particular choice there is - this box, now. Applied before the TV's own
  // settings it was overwritten by them, so on a TV with a theme of its own
  // (אהל אברהם) choosing a theme from the remote changed nothing.
  // A remote choice the admin has since deleted is simply ignored.
  const chosen =
    themeOverride && allThemes(saved.customThemes).some((t) => t.id === themeOverride)
      ? { ...forScreen, theme: themeOverride, themeOverrides: {} }
      : forScreen;
  // Then Shabbat's, a festival's or Friday's look, when the day has one.
  return applyDayLook(chosen, now, settings, slideId);
}
