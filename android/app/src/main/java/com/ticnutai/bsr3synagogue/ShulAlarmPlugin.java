package com.ticnutai.bsr3synagogue;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.HashSet;
import java.util.Set;

import org.json.JSONArray;

/**
 * The app's own part for what ordinary notifications cannot do
 * (src/community/lib/shulAlarm.ts): minyanim that ring like an alarm clock,
 * and new notices while the app is closed.
 */
@CapacitorPlugin(name = "ShulAlarm")
public class ShulAlarmPlugin extends Plugin {

    @PluginMethod
    public void schedule(PluginCall call) {
        JSArray alarms = call.getArray("alarms", new JSArray());
        AlarmScheduler.replace(getContext(), alarms);
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("exact", AlarmScheduler.canExact(getContext()));
        r.put("fullScreen", canFullScreen(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void openExactSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            open(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, packageUri()));
        }
        call.resolve();
    }

    @PluginMethod
    public void openFullScreenSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 34) {
            open(new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, packageUri()));
        }
        call.resolve();
    }

    @PluginMethod
    public void configureNotices(PluginCall call) {
        Context ctx = getContext();
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        SharedPreferences.Editor e = AlarmScheduler.prefs(ctx).edit()
                .putBoolean("notices_enabled", enabled)
                .putString("notices_url", call.getString("url", ""))
                .putString("notices_key", call.getString("key", ""))
                .putString("notices_community", call.getString("communityId", ""));
        JSArray quiet = call.getArray("quiet", new JSArray());
        e.putString("notices_quiet", quiet.toString());
        // What the app has already shown is not told again from the background.
        Set<String> seen = new HashSet<>(AlarmScheduler.prefs(ctx).getStringSet("notices_seen", new HashSet<>()));
        try {
            JSONArray ids = call.getArray("seen", new JSArray());
            for (int i = 0; i < ids.length(); i++) seen.add(ids.getString(i));
            e.putBoolean("notices_primed", true);
        } catch (Exception ignored) {
            // nothing new
        }
        e.putStringSet("notices_seen", seen).apply();
        NoticesWorker.ensure(ctx, enabled);
        call.resolve();
    }

    /**
     * Looks for new notices now, not in a quarter of an hour. `forget` drops
     * notices from what the phone has seen, so a test can see one told again
     * without anything new written to the synagogue.
     */
    @PluginMethod
    public void checkNow(PluginCall call) {
        Context ctx = getContext();
        Set<String> seen = new HashSet<>(AlarmScheduler.prefs(ctx).getStringSet("notices_seen", new HashSet<>()));
        try {
            JSONArray forget = call.getArray("forget", new JSArray());
            for (int i = 0; i < forget.length(); i++) seen.remove(forget.getString(i));
        } catch (Exception ignored) {
            // nothing to forget
        }
        AlarmScheduler.prefs(ctx).edit().putStringSet("notices_seen", seen).commit();
        NoticesWorker.runOnce(ctx);
        call.resolve();
    }

    /** Rings now, as a minyan would - for the "לנסות" button. */
    @PluginMethod
    public void test(PluginCall call) {
        AlarmReceiver.ring(getContext(), 309_999, call.getString("title", ""), call.getString("body", ""));
        call.resolve();
    }

    static boolean canFullScreen(Context ctx) {
        if (Build.VERSION.SDK_INT < 34) return true;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        return nm != null && nm.canUseFullScreenIntent();
    }

    private Uri packageUri() {
        return Uri.parse("package:" + getContext().getPackageName());
    }

    private void open(Intent intent) {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
        } catch (Exception ex) {
            Intent app = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri());
            app.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(app);
        }
    }
}
