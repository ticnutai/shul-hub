package com.ticnutai.bsr3synagogue.tv;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;

/**
 * Android's answer to a silent self-update (AutoUpdate).
 *
 * On success the app has already been replaced and BootReceiver
 * (MY_PACKAGE_REPLACED) brings the board back. If Android wants a person to
 * confirm after all, nothing is opened here - at 03:00 a system dialog would
 * sit over the board until morning. It is remembered instead, and the board
 * shows its "press OK" line (apkUpdate.ts) the next time it looks.
 */
public class InstallResult extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, -999);
        String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
        AutoUpdate.prefs(context).edit()
            .putBoolean("needsUser", status == PackageInstaller.STATUS_PENDING_USER_ACTION)
            .putString("lastResult", status + (message != null ? ": " + message : ""))
            .apply();
    }
}
