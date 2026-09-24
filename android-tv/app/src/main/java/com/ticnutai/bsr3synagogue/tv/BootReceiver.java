package com.ticnutai.bsr3synagogue.tv;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

/**
 * Brings the board back up after the TV is powered on.
 *
 * A wall display is unattended: after a power cut the screen would otherwise
 * return to the TV's home launcher and stay there until somebody climbs up and
 * opens the app. Starting from a boot broadcast restores the board on its own.
 *
 * Coverage is broad because Android TV boxes are inconsistent about which boot
 * broadcast they send:
 *
 *  - BOOT_COMPLETED         the standard one
 *  - LOCKED_BOOT_COMPLETED  fires earlier on devices with direct boot
 *  - QUICKBOOT_POWERON      sent by several manufacturers instead of the above
 *
 * Duplicates are harmless: MainActivity is `singleTask`, so a second start
 * brings the existing instance forward rather than creating another.
 *
 * THE CATCH, found on the real device (MECOOL box, Android 14): receiving the
 * broadcast is not enough. Android 10+ forbids a background app from opening an
 * activity and drops the request without telling the app - startActivity()
 * returns normally and nothing appears. The system log shows
 * "Background activity launch blocked ... BAL_BLOCK". The documented way out
 * for a kiosk is the "display over other apps" permission, which a TV can only
 * grant over ADB (`node scripts/tv-control.mjs autostart`). Without it this
 * receiver still runs, and says so in the log instead of claiming success.
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "ShulHubTvBoot";
    private static final String QUICKBOOT = "android.intent.action.QUICKBOOT_POWERON";
    private static final String QUICKBOOT_HTC = "com.htc.intent.action.QUICKBOOT_POWERON";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? null : intent.getAction();
        if (action == null) return;

        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)
            && !Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action)
            && !QUICKBOOT.equals(action)
            && !QUICKBOOT_HTC.equals(action)) {
            return;
        }

        // Alarms do not survive a reboot; arm tonight's restart again.
        NightlyRestart.schedule(context);

        boolean mayStartFromBackground =
            Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || Settings.canDrawOverlays(context);

        if (!mayStartFromBackground) {
            // Say it plainly: the system is about to drop this silently.
            Log.w(TAG, "Boot (" + action + ") received, but 'display over other apps' is not granted, "
                + "so Android will block opening the board. Grant it: node scripts/tv-control.mjs autostart");
        }

        try {
            Intent launch = new Intent(context, MainActivity.class);
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            launch.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
            context.startActivity(launch);
            // Worded as a request, not a result: a blocked start is not reported
            // back to the app, so success cannot be observed from here.
            Log.i(TAG, "Requested board start after " + action
                + (mayStartFromBackground ? " (overlay permission granted)" : " (likely blocked)"));
        } catch (Exception e) {
            // A refused start must not crash the receiver, or the system may
            // report the app as misbehaving on every boot.
            Log.w(TAG, "Could not start board after boot: " + e.getMessage());
        }
    }
}
