package com.ticnutai.bsr3synagogue.tv;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

/**
 * Opens the board again when it is not on the screen.
 *
 * Everything else that watches this display watches it from the inside: the
 * copy on the device covers the server going away, the page watchdog covers a
 * main thread that has stopped answering, the nightly restart covers slow
 * build-up. All of them are JavaScript, and none of them can run once the
 * process itself is gone - which is the case that actually left a board dark.
 *
 * What happened, from the screen's own log: it reported for three days, and
 * then at 15:27 on shabbat it simply stopped. No error, no reboot, no outage.
 * Android had taken the process, and nothing was left running to notice. The
 * nightly alarm did fire the next morning, found no board, and returned - it
 * was written to leave opening the board to the boot receiver, and the device
 * had not booted. So the wall stayed dark for a day and a half, until a person
 * looked at it.
 *
 * An alarm is the one thing here that outlives the app: it is held by the
 * system, and firing it starts the process again whether or not anything of
 * the app is left. So every quarter of an hour it asks one question - is the
 * board on the screen - and if it is not, it opens it. When the board is fine
 * this costs a wakeup and a look at a list.
 *
 * Inexact on purpose (setInexactRepeating): the system is free to line it up
 * with other wakeups, which is kinder to a box that runs for months, and a few
 * minutes either way is nothing against a board that is already dark.
 *
 * It needs the same exemption the boot receiver needs - Android 10 and later
 * refuse a background activity start and drop it silently. That is the
 * "display over other apps" permission, granted once over ADB:
 *   node scripts/tv-control.mjs autostart
 *
 * One case this cannot cover, measured rather than assumed: a force-stop.
 * "Force stop" in Android's app settings, or `am force-stop`, cancels every
 * alarm the app holds and marks it stopped, and a stopped app is not sent
 * broadcasts - so the thing that would restart it has been taken away along
 * with it. Checked on the box: after a force-stop `dumpsys alarm` has no
 * KEEPALIVE entry at all and the package reads stopped=true. Nothing inside
 * an app can defend against that, and it is not what takes a board down on
 * its own - it takes a person in the settings screen. A reboot brings it
 * back through the boot receiver; so does opening the app once.
 *
 * What it does cover is the case that did happen: the system reclaiming the
 * process. That leaves the alarm registered and the app un-stopped, which is
 * the state this was written for.
 */
public class Keepalive extends BroadcastReceiver {

    private static final String TAG = "ShulHubTvKeepalive";
    private static final String ACTION = "com.ticnutai.bsr3synagogue.tv.KEEPALIVE";
    private static final long EVERY_MS = 15 * 60_000L;
    /** Asked for at the same moment the board is starting; give it room to say so. */
    private static final long FIRST_MS = 5 * 60_000L;

    /** Arms the repeating check. Safe to call often - the alarm replaces itself. */
    public static void schedule(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        try {
            alarms.setInexactRepeating(
                AlarmManager.RTC_WAKEUP,
                System.currentTimeMillis() + FIRST_MS,
                EVERY_MS,
                pending(context));
            Log.i(TAG, "Keepalive armed, every " + (EVERY_MS / 60_000) + " minutes");
        } catch (Exception e) {
            // A board that runs without this is the board as it was; it must
            // never be the reason the board does not start.
            Log.w(TAG, "Could not arm the keepalive: " + e.getMessage());
        }
    }

    private static PendingIntent pending(Context context) {
        Intent intent = new Intent(context, Keepalive.class).setAction(ACTION);
        return PendingIntent.getBroadcast(
            context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION.equals(intent.getAction())) return;
        // setInexactRepeating survives, but a device that dropped the alarm
        // (some boxes do, after an update) gets it back here.
        schedule(context);

        if (boardIsShowing()) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && !Settings.canDrawOverlays(context)) {
            // Say it rather than fail quietly: this is the one permission that
            // decides whether an unattended board can bring itself back.
            Log.w(TAG, "The board is not on the screen and 'display over other apps' is not granted, "
                + "so Android will block opening it. Grant it: node scripts/tv-control.mjs autostart");
        }

        try {
            Intent launch = new Intent(context, MainActivity.class);
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            context.startActivity(launch);
            Log.i(TAG, "Board was not on the screen; asked for it to open");
        } catch (Exception e) {
            Log.w(TAG, "Could not open the board: " + e.getMessage());
        }
    }

    /**
     * Is the board open?
     *
     * `boardCreatedAt` is set when the screen is created and cleared when it
     * is destroyed - a field in our own process. That is exactly what makes it
     * the right answer here: if the process was taken, the alarm starts a new
     * one and the field reads zero, which is the truth. If the board is up, it
     * is not zero and nothing happens.
     *
     * What it does not cover is a board that is running with something else in
     * front of it - a system dialog, the TV launcher. From the hall that looks
     * the same as dark, and it would need the foreground importance of our own
     * process to tell, which is not readable honestly from inside a broadcast.
     * Left out rather than guessed at: opening the board every quarter of an
     * hour over whatever an engineer put on the screen would be worse.
     */
    private boolean boardIsShowing() {
        return NightlyRestart.boardCreatedAt != 0;
    }
}
