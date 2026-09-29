package com.ticnutai.bsr3synagogue.tv;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Downloading and installing a newer board app - the work itself, in one place.
 *
 * Two doors lead here. The Capacitor plugin (ApkUpdater), which the board can
 * reach when it runs from the copy inside the APK; and NativeBridge, which it
 * can reach when it runs from the website - which is how every box runs it,
 * and where Capacitor's plugins do not apply. Before NativeBridge the updater
 * was therefore never reachable on a wall, and a box kept the APK it was
 * first given (אהל אברהם, 2026-09-29).
 *
 * Android always asks a person to confirm an install (one press of OK on the
 * remote) unless the device is managed, and the first time also asks to allow
 * installs from this app. Only APKs from the board's own website are fetched.
 */
final class UpdateFiles {

    static final String ALLOWED_PREFIX = "https://shul-hub.lovable.app/";
    private static final String FILE_NAME = "update.apk";

    interface Progress {
        void percent(int percent);
    }

    private UpdateFiles() {}

    static File apkFile(Context c) {
        File dir = new File(c.getCacheDir(), "updates");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        return new File(dir, FILE_NAME);
    }

    static boolean canInstall(Context c) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || c.getPackageManager().canRequestPackageInstalls();
    }

    static boolean allowed(String url) {
        return url != null && url.startsWith(ALLOWED_PREFIX) && url.contains(".apk");
    }

    static JSONObject info(Context c) throws Exception {
        PackageInfo p = c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
        JSONObject ret = new JSONObject();
        ret.put("versionCode", Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? p.getLongVersionCode() : p.versionCode);
        ret.put("versionName", p.versionName);
        ret.put("canInstall", canInstall(c));
        File apk = apkFile(c);
        ret.put("downloaded", apk.exists() && apk.length() > 0);
        return ret;
    }

    /** Blocking; call from a background thread. Returns the bytes downloaded. */
    static long download(Context c, String url, Progress progress) throws Exception {
        if (!allowed(url)) throw new Exception("url not allowed");
        File tmp = new File(apkFile(c).getParentFile(), FILE_NAME + ".part");
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setConnectTimeout(20000);
            conn.setReadTimeout(60000);
            conn.setInstanceFollowRedirects(true);
            if (conn.getResponseCode() != 200) throw new Exception("HTTP " + conn.getResponseCode());
            long total = conn.getContentLengthLong();
            long done = 0;
            int lastPercent = -1;
            try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(tmp)) {
                byte[] buf = new byte[64 * 1024];
                int n;
                while ((n = in.read(buf)) > 0) {
                    out.write(buf, 0, n);
                    done += n;
                    int percent = total > 0 ? (int) (done * 100 / total) : -1;
                    if (percent != lastPercent && percent % 5 == 0) {
                        lastPercent = percent;
                        if (progress != null) progress.percent(percent);
                    }
                }
            }
            if (done < 1_000_000) throw new Exception("file too small");
            File dest = apkFile(c);
            //noinspection ResultOfMethodCallIgnored
            dest.delete();
            if (!tmp.renameTo(dest)) throw new Exception("rename failed");
            return done;
        } catch (Exception e) {
            //noinspection ResultOfMethodCallIgnored
            tmp.delete();
            throw e;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    /**
     * Opens Android's installer for the downloaded APK. Returns true when the
     * one-time permission screen was opened instead (the next OK installs).
     */
    static boolean install(Context c) throws Exception {
        File apk = apkFile(c);
        if (!apk.exists()) throw new Exception("nothing downloaded");
        if (!canInstall(c)) {
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + c.getPackageName()));
            settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                c.startActivity(settings);
            } catch (Exception ignored) {
                // Some TV builds have no such screen; the installer then asks itself.
            }
            return true;
        }
        Uri uri = FileProvider.getUriForFile(c, c.getPackageName() + ".fileprovider", apk);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        c.startActivity(intent);
        return false;
    }
}
