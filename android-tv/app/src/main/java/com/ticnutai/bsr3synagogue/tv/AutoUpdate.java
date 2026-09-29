package com.ticnutai.bsr3synagogue.tv;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.os.Build;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Calendar;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * The board app updates itself, silently, at night.
 *
 * From Android 12 an app may install a newer version of itself without anyone
 * pressing anything: it asks for it (USER_ACTION_NOT_REQUIRED, and the
 * UPDATE_PACKAGES_WITHOUT_USER_ACTION permission), and it has once been
 * allowed to install apps. Three of the four boxes are Android 14. The fourth
 * (אהל אברהם, Android 8) cannot, and keeps the "press OK" line on the screen
 * (apkUpdate.ts, through NativeBridge).
 *
 * Every 20 minutes: every 3 hours ask the website for tv-version.json, fetch a
 * newer APK when there is one, and install it between 02:00 and 05:00 - the
 * board is off the wall for the few seconds Android takes, and nobody is
 * standing in front of it. "עדכון עכשיו" from the admin skips the wait
 * (installNow). If Android asks for a person anyway, nothing pops up at night:
 * the result is kept, and the board shows its OK line instead.
 */
final class AutoUpdate {

    private static final String VERSION_URL = UpdateFiles.ALLOWED_PREFIX + "tv-version.json";
    private static final long CHECK_EVERY_MS = 3L * 60 * 60 * 1000;
    private static final int QUIET_FROM = 2;
    private static final int QUIET_TO = 5;
    private static final String PREFS = "auto-update";

    private static boolean started;
    private static long lastCheck;
    private static ScheduledExecutorService executor;

    private AutoUpdate() {}

    /** Whether this Android lets an app update itself without a person (12+). */
    static boolean silentCapable() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S;
    }

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static synchronized void start(Context context) {
        if (started || !silentCapable()) return;
        started = true;
        Context app = context.getApplicationContext();
        executor = Executors.newSingleThreadScheduledExecutor();
        executor.scheduleWithFixedDelay(() -> tick(app, false), 2, 20, TimeUnit.MINUTES);
    }

    /** "עדכון עכשיו": check, download and install now, whatever the hour. */
    static void installNow(Context context) {
        Context app = context.getApplicationContext();
        new Thread(() -> tick(app, true)).start();
    }

    static long installedCode(Context c) throws Exception {
        PackageInfo p = c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? p.getLongVersionCode() : p.versionCode;
    }

    private static synchronized void tick(Context c, boolean now) {
        SharedPreferences p = prefs(c);
        try {
            long installed = installedCode(c);
            long ready = p.getLong("readyCode", 0);
            File apk = UpdateFiles.apkFile(c);
            // Already running what was fetched: clear it away.
            if (ready > 0 && ready <= installed) {
                //noinspection ResultOfMethodCallIgnored
                apk.delete();
                p.edit().remove("readyCode").remove("readyName").remove("needsUser").apply();
                ready = 0;
            }
            boolean have = ready > installed && apk.exists();
            long t = System.currentTimeMillis();
            if (!have && (now || t - lastCheck >= CHECK_EVERY_MS)) {
                lastCheck = t;
                JSONObject v = fetchJson(VERSION_URL);
                long code = v.optLong("versionCode", 0);
                String url = v.optString("apk", "");
                if (code > installed && UpdateFiles.allowed(url)) {
                    UpdateFiles.download(c, url, null);
                    p.edit().putLong("readyCode", code).putString("readyName", v.optString("versionName")).apply();
                    have = true;
                }
            }
            if (!have || !silentCapable() || !UpdateFiles.canInstall(c)) return;
            if (!now && !quietHours()) return;
            if (!now && p.getBoolean("needsUser", false)) return;
            installSilently(c, p.getLong("readyCode", 0));
        } catch (Exception e) {
            p.edit().putString("lastError", String.valueOf(e.getMessage())).apply();
        }
    }

    private static boolean quietHours() {
        int h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        return h >= QUIET_FROM && h < QUIET_TO;
    }

    private static void installSilently(Context c, long code) throws Exception {
        File apk = UpdateFiles.apkFile(c);
        PackageInstaller installer = c.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params =
            new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(c.getPackageName());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
        }
        int id = installer.createSession(params);
        try (PackageInstaller.Session session = installer.openSession(id)) {
            try (InputStream in = new FileInputStream(apk);
                 OutputStream out = session.openWrite("board.apk", 0, apk.length())) {
                byte[] buf = new byte[64 * 1024];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                session.fsync(out);
            }
            Intent result = new Intent(c, InstallResult.class);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT
                | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0);
            PendingIntent pending = PendingIntent.getBroadcast(c, id, result, flags);
            prefs(c).edit().putString("lastAttempt", code + "@" + System.currentTimeMillis()).apply();
            session.commit(pending.getIntentSender());
        }
    }

    private static JSONObject fetchJson(String url) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(url + "?t=" + System.currentTimeMillis()).openConnection();
        try {
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            conn.setUseCaches(false);
            if (conn.getResponseCode() != 200) throw new Exception("HTTP " + conn.getResponseCode());
            try (InputStream in = conn.getInputStream()) {
                byte[] all = new byte[64 * 1024];
                int len = 0, n;
                while ((n = in.read(all, len, all.length - len)) > 0) len += n;
                return new JSONObject(new String(all, 0, len, "UTF-8"));
            }
        } finally {
            conn.disconnect();
        }
    }

    /** What the board shows about it, through NativeBridge.info(). */
    static void describe(Context c, JSONObject into) throws Exception {
        SharedPreferences p = prefs(c);
        into.put("silent", silentCapable() && !p.getBoolean("needsUser", false));
        into.put("readyName", p.getString("readyName", ""));
        into.put("lastError", p.getString("lastError", ""));
        into.put("lastResult", p.getString("lastResult", ""));
    }
}
