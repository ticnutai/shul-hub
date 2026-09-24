package com.ticnutai.bsr3synagogue.tv;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import android.util.Log;

import java.util.Calendar;

/**
 * Starts the board afresh once a night, at 03:45.
 *
 * Signage that runs for months is restarted every night while nobody is
 * looking; slow build-up (memory a WebView never gives back, a renderer that
 * gets heavier by the week) is not something any single check catches. A
 * device reboot is reserved for system apps, so the board does what an app
 * can: it closes its screen and opens a new one - a new activity, a new
 * WebView, the page loaded from scratch.
 *
 * The page also reloads itself at 03:30 (src/tv/watchdog.ts), so a board
 * whose alarm never fires still gets a fresh page; this one also replaces the
 * WebView, which a page reload cannot.
 *
 * Inexact on purpose: setWindow needs no "exact alarm" permission, and ten
 * minutes either way at 04:00 makes no difference to anyone.
 */
public class NightlyRestart extends BroadcastReceiver {
    private static final String TAG = "ShulHubTvNightly";
    private static final String ACTION = "com.ticnutai.bsr3synagogue.tv.NIGHTLY_RESTART";
    private static final int HOUR = 3;
    private static final int MINUTE = 45;
    private static final long WINDOW_MS = 10 * 60_000L;
    /** A board that came up within the hour is fresh already (power cut, or last night's restart ran late). */
    private static final long MIN_UPTIME_MS = 60 * 60_000L;

    /** Set by MainActivity: when the current screen was created, 0 when there is none. */
    static volatile long boardCreatedAt = 0;

    /** Arms the next 03:45. Safe to call often: the same PendingIntent replaces itself. */
    public static void schedule(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;

        Calendar next = Calendar.getInstance();
        next.set(Calendar.HOUR_OF_DAY, HOUR);
        next.set(Calendar.MINUTE, MINUTE);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        if (next.getTimeInMillis() <= System.currentTimeMillis()) next.add(Calendar.DAY_OF_YEAR, 1);

        Intent intent = new Intent(context, NightlyRestart.class).setAction(ACTION);
        PendingIntent pending = PendingIntent.getBroadcast(
            context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        try {
            alarms.setWindow(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), WINDOW_MS, pending);
            Log.i(TAG, "Next nightly restart around " + next.getTime());
        } catch (Exception e) {
            // Never let the schedule take the board down with it.
            Log.w(TAG, "Could not schedule the nightly restart: " + e.getMessage());
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION.equals(intent.getAction())) return;
        schedule(context); // tomorrow, whatever happens next

        long created = boardCreatedAt;
        if (created == 0) {
            // The board is not open (somebody closed it, or this woke a dead
            // process). Opening it at night is the boot receiver's job, not this one's.
            Log.i(TAG, "Nightly restart skipped: the board is not running");
            return;
        }
        if (SystemClock.elapsedRealtime() - created < MIN_UPTIME_MS) {
            Log.i(TAG, "Nightly restart skipped: the board started less than an hour ago");
            return;
        }
        try {
            Intent launch = new Intent(context, MainActivity.class);
            // Clear the task: the old screen and its WebView are destroyed, and a new one is created.
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            context.startActivity(launch);
            Log.i(TAG, "Nightly restart requested");
        } catch (Exception e) {
            Log.w(TAG, "Nightly restart failed: " + e.getMessage());
        }
    }
}
