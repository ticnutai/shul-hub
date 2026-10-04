package com.ticnutai.bsr3synagogue;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.TimeUnit;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * New notices from the gabbai while the app is closed: about every quarter of
 * an hour (as often as Android allows) the phone asks the synagogue's site
 * for the notices marked for notification, and tells the ones it has not
 * seen. Never on Shabbat or Yom Tov (the windows the app hands it), and only
 * the public notices - the same anyone sees on the site.
 */
public class NoticesWorker extends Worker {
    private static final String WORK = "shul-notices";
    // The same channel the app makes (notify.ts CHANNELS.notice), with the phone's own sound.
    static final String CHANNEL = "shul_notices_v2";

    public NoticesWorker(@NonNull Context ctx, @NonNull WorkerParameters params) {
        super(ctx, params);
    }

    /** Turns the quarter-hourly look on or off. */
    static void ensure(Context ctx, boolean enabled) {
        WorkManager wm = WorkManager.getInstance(ctx);
        if (!enabled) {
            wm.cancelUniqueWork(WORK);
            return;
        }
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(NoticesWorker.class, 15, TimeUnit.MINUTES)
                .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build();
        wm.enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP, req);
    }

    /** One look now (ShulAlarmPlugin.checkNow). */
    static void runOnce(Context ctx) {
        WorkManager.getInstance(ctx).enqueue(new OneTimeWorkRequest.Builder(NoticesWorker.class)
                .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build());
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        SharedPreferences p = AlarmScheduler.prefs(ctx);
        if (!p.getBoolean("notices_enabled", false)) return Result.success();
        if (inQuiet(p.getString("notices_quiet", "[]"))) return Result.success();
        String base = p.getString("notices_url", "");
        String key = p.getString("notices_key", "");
        String community = p.getString("notices_community", "");
        if (base.isEmpty() || key.isEmpty() || community.isEmpty()) return Result.success();

        try {
            String url = base + "/rest/v1/announcements?select=id,title,body"
                    + "&community_id=eq." + URLEncoder.encode(community, "UTF-8")
                    + "&notification_enabled=eq.true&order=created_at.desc&limit=20";
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(15000);
            c.setReadTimeout(15000);
            c.setRequestProperty("apikey", key);
            c.setRequestProperty("Authorization", "Bearer " + key);
            if (c.getResponseCode() != 200) return Result.retry();
            StringBuilder sb = new StringBuilder();
            try (BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = r.readLine()) != null) sb.append(line);
            }
            JSONArray rows = new JSONArray(sb.toString());

            Set<String> seen = new HashSet<>(p.getStringSet("notices_seen", new HashSet<>()));
            boolean first = !p.getBoolean("notices_primed", false);
            Set<String> now = new HashSet<>(seen);
            for (int i = rows.length() - 1; i >= 0; i--) {
                JSONObject row = rows.getJSONObject(i);
                String id = row.optString("id");
                now.add(id);
                // The first look on this phone only learns what is there: no flood of old notices.
                if (!first && !seen.contains(id)) tell(ctx, id, row.optString("title"), row.optString("body"));
            }
            p.edit().putStringSet("notices_seen", now).putBoolean("notices_primed", true).apply();
            return Result.success();
        } catch (Exception e) {
            return Result.retry();
        }
    }

    private static boolean inQuiet(String json) {
        long now = System.currentTimeMillis();
        try {
            JSONArray w = new JSONArray(json);
            for (int i = 0; i < w.length(); i++) {
                JSONObject o = w.getJSONObject(i);
                if (now >= o.optLong("start") && now < o.optLong("end")) return true;
            }
        } catch (Exception ignored) {
            // no windows: never quiet
        }
        return false;
    }

    private static void tell(Context ctx, String id, String title, String body) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, ctx.getString(R.string.shul_notices_channel), NotificationManager.IMPORTANCE_HIGH);
            ch.enableVibration(true);
            nm.createNotificationChannel(ch);
        }
        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        PendingIntent tap = PendingIntent.getActivity(ctx, id.hashCode(), open != null ? open : new Intent(),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String text = body == null ? "" : body;
        nm.notify(id.hashCode(), new NotificationCompat.Builder(ctx, CHANNEL)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(tap)
                .setAutoCancel(true)
                .build());
    }
}
