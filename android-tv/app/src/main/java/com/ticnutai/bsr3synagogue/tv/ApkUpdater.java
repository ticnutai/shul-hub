package com.ticnutai.bsr3synagogue.tv;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Updates the board app from inside itself (src/tv/apkUpdate.ts).
 *
 * The page finds a newer version on the website, this downloads the APK and
 * opens Android's installer. Android always asks a person to confirm an
 * install (one press of OK on the remote) unless the device is managed, and
 * the first time it also asks to allow installs from this app - both are
 * system screens, so nothing is ever installed silently.
 *
 * Only APKs from the board's own website are accepted.
 */
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdater extends Plugin {

    private static final String ALLOWED_PREFIX = "https://shul-hub.lovable.app/";
    private static final String FILE_NAME = "update.apk";

    private File apkFile() {
        File dir = new File(getContext().getCacheDir(), "updates");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        return new File(dir, FILE_NAME);
    }

    private boolean canInstall() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O
            || getContext().getPackageManager().canRequestPackageInstalls();
    }

    @PluginMethod
    public void info(PluginCall call) {
        try {
            PackageInfo p = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            JSObject ret = new JSObject();
            ret.put("versionCode", Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? p.getLongVersionCode() : p.versionCode);
            ret.put("versionName", p.versionName);
            ret.put("canInstall", canInstall());
            ret.put("downloaded", apkFile().exists() && apkFile().length() > 0);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("info failed", e);
        }
    }

    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url", "");
        if (url == null || !url.startsWith(ALLOWED_PREFIX) || !url.contains(".apk")) {
            call.reject("url not allowed");
            return;
        }
        new Thread(() -> {
            File tmp = new File(apkFile().getParentFile(), FILE_NAME + ".part");
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
                            JSObject ev = new JSObject();
                            ev.put("percent", percent);
                            notifyListeners("progress", ev);
                        }
                    }
                }
                if (done < 1_000_000) throw new Exception("file too small");
                File dest = apkFile();
                //noinspection ResultOfMethodCallIgnored
                dest.delete();
                if (!tmp.renameTo(dest)) throw new Exception("rename failed");
                JSObject ret = new JSObject();
                ret.put("bytes", done);
                call.resolve(ret);
            } catch (Exception e) {
                //noinspection ResultOfMethodCallIgnored
                tmp.delete();
                call.reject("download failed: " + e.getMessage(), e);
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }

    @PluginMethod
    public void install(PluginCall call) {
        File apk = apkFile();
        if (!apk.exists()) {
            call.reject("nothing downloaded");
            return;
        }
        JSObject ret = new JSObject();
        if (!canInstall()) {
            // First time only: Android's own screen to allow installs from this app.
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName()));
            settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                getContext().startActivity(settings);
            } catch (Exception ignored) {
                // Some TV builds have no such screen; the installer then asks itself.
            }
            ret.put("needsPermission", true);
            call.resolve(ret);
            return;
        }
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        ret.put("needsPermission", false);
        call.resolve(ret);
    }
}
