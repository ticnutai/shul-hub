package com.ticnutai.bsr3synagogue.tv;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The updater as a Capacitor plugin (src/tv/apkUpdate.ts), for the board when
 * it runs from the copy inside the APK. The work is in UpdateFiles; the same
 * work is reachable from the website through NativeBridge.
 */
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdater extends Plugin {

    @PluginMethod
    public void info(PluginCall call) {
        try {
            call.resolve(JSObject.fromJSONObject(UpdateFiles.info(getContext())));
        } catch (Exception e) {
            call.reject("info failed", e);
        }
    }

    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url", "");
        if (!UpdateFiles.allowed(url)) {
            call.reject("url not allowed");
            return;
        }
        new Thread(() -> {
            try {
                long bytes = UpdateFiles.download(getContext(), url, percent -> {
                    JSObject ev = new JSObject();
                    ev.put("percent", percent);
                    notifyListeners("progress", ev);
                });
                JSObject ret = new JSObject();
                ret.put("bytes", bytes);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("download failed: " + e.getMessage(), e);
            }
        }).start();
    }

    @PluginMethod
    public void install(PluginCall call) {
        try {
            JSObject ret = new JSObject();
            ret.put("needsPermission", UpdateFiles.install(getContext()));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage(), e);
        }
    }
}
