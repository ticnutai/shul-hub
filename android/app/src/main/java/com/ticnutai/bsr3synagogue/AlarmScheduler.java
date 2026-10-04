package com.ticnutai.bsr3synagogue;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * The minyanim that ring like an alarm clock: kept on the phone (so they
 * come back after a restart) and handed to Android's alarm clock, which wakes
 * the phone on the minute - or, when the member has not allowed exact
 * alarms, as close to it as Android lets.
 */
public final class AlarmScheduler {
    static final String PREFS = "shul_alarm";
    private static final String KEY_ALARMS = "alarms";
    private static final String KEY_IDS = "scheduled_ids";

    private AlarmScheduler() {}

    static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Whether Android lets this app ring on the minute (always, before Android 12). */
    static boolean canExact(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        return am != null && am.canScheduleExactAlarms();
    }

    /** Replaces every planned alarm with these ([{id, at, title, body}]). */
    static void replace(Context ctx, JSONArray alarms) {
        cancelScheduled(ctx);
        prefs(ctx).edit().putString(KEY_ALARMS, alarms.toString()).apply();
        scheduleStored(ctx);
    }

    /** Hands the stored alarms still to come to Android (after a restart, too). */
    static void scheduleStored(Context ctx) {
        JSONArray all;
        try {
            all = new JSONArray(prefs(ctx).getString(KEY_ALARMS, "[]"));
        } catch (Exception e) {
            all = new JSONArray();
        }
        long now = System.currentTimeMillis();
        JSONArray ids = new JSONArray();
        for (int i = 0; i < all.length(); i++) {
            JSONObject a = all.optJSONObject(i);
            if (a == null) continue;
            long at = a.optLong("at", 0);
            if (at <= now) continue;
            int id = a.optInt("id", 0);
            scheduleOne(ctx, id, at, a.optString("title", ""), a.optString("body", ""));
            ids.put(id);
        }
        prefs(ctx).edit().putString(KEY_IDS, ids.toString()).apply();
    }

    static void scheduleOne(Context ctx, int id, long at, String title, String body) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent fire = firePending(ctx, id, title, body);
        if (canExact(ctx)) {
            Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
            PendingIntent show = PendingIntent.getActivity(
                    ctx, id, open != null ? open : new Intent(),
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, show), fire);
        } else {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fire);
        }
    }

    private static PendingIntent firePending(Context ctx, int id, String title, String body) {
        Intent intent = new Intent(ctx, AlarmReceiver.class);
        intent.putExtra("id", id);
        intent.putExtra("title", title);
        intent.putExtra("body", body);
        return PendingIntent.getBroadcast(ctx, id, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void cancelScheduled(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        try {
            JSONArray ids = new JSONArray(prefs(ctx).getString(KEY_IDS, "[]"));
            for (int i = 0; i < ids.length(); i++) {
                am.cancel(firePending(ctx, ids.optInt(i), "", ""));
            }
        } catch (Exception ignored) {
            // nothing stored: nothing to cancel
        }
        prefs(ctx).edit().remove(KEY_IDS).apply();
    }
}
