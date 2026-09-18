package com.ticnutai.bsr3synagogue.tv;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Brings the board back up after the TV is powered on.
 *
 * A wall display is unattended: after a power cut the screen would otherwise
 * return to the TV's home launcher and stay there until somebody climbs up and
 * opens the app. Starting from BOOT_COMPLETED restores the board on its own.
 *
 * Coverage is intentionally broad because Android TV boxes are inconsistent
 * about which boot broadcast they send:
 *
 *  - BOOT_COMPLETED         the standard one
 *  - LOCKED_BOOT_COMPLETED  fires earlier on devices with direct boot
 *  - QUICKBOOT_POWERON      sent by several manufacturers instead of the above
 *
 * Duplicates are harmless: MainActivity is `singleTask`, so a second start
 * brings the existing instance forward rather than creating another.
 *
 * This is best effort. Android restricts background activity starts, and some
 * devices refuse them from a boot receiver; many TV boxes also have their own
 * "auto start" setting that has to be enabled for the app. If the board does
 * not come back on its own, that device setting is the place to look.
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

        try {
            Intent launch = new Intent(context, MainActivity.class);
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            launch.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
            context.startActivity(launch);
            Log.i(TAG, "Display restarted after " + action);
        } catch (Exception e) {
            // A refused background start must not crash the receiver, or the
            // system may report the app as misbehaving on every boot.
            Log.w(TAG, "Could not start display after boot: " + e.getMessage());
        }
    }
}
