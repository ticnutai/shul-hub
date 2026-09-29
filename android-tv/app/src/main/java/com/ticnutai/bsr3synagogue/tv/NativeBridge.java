package com.ticnutai.bsr3synagogue.tv;

import android.app.Activity;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

/**
 * The app, reachable from the board when the board comes from the website.
 *
 * Every box shows the board from https://shul-hub.lovable.app (remoteBoard.ts)
 * and on that origin Capacitor's plugins are not there: the self-updater was
 * written as one, so no box on a wall could ever update itself. A JavaScript
 * interface belongs to the WebView rather than to the page's origin, so it is
 * there whichever page is loaded - `window.ShulTvNative` in the board.
 *
 * It exposes the updater and nothing else, and downloads only from the
 * board's own website (UpdateFiles.allowed). Results of the download, which
 * takes a while, come back to the page as a `shul-apk` event.
 */
final class NativeBridge {

    static final String NAME = "ShulTvNative";

    private final Activity activity;
    private final WebView web;

    NativeBridge(Activity activity, WebView web) {
        this.activity = activity;
        this.web = web;
    }

    /** {versionCode, versionName, canInstall, downloaded} as JSON, or "" on failure. */
    @JavascriptInterface
    public String info() {
        try {
            return UpdateFiles.info(activity).toString();
        } catch (Exception e) {
            return "";
        }
    }

    /** Starts the download; progress and the result arrive as `shul-apk` events. */
    @JavascriptInterface
    public boolean download(String url) {
        if (!UpdateFiles.allowed(url)) return false;
        new Thread(() -> {
            try {
                long bytes = UpdateFiles.download(activity, url, percent -> emit("progress", "percent", percent));
                emit("done", "bytes", bytes);
            } catch (Exception e) {
                emit("error", "message", String.valueOf(e.getMessage()));
            }
        }).start();
        return true;
    }

    /** "permission" when the one-time permission screen opened, "installing", or "error". */
    @JavascriptInterface
    public String install() {
        try {
            return UpdateFiles.install(activity) ? "permission" : "installing";
        } catch (Exception e) {
            return "error";
        }
    }

    private void emit(String type, String key, Object value) {
        try {
            JSONObject detail = new JSONObject();
            detail.put("type", type);
            detail.put(key, value);
            String js = "window.dispatchEvent(new CustomEvent('shul-apk',{detail:" + detail + "}))";
            activity.runOnUiThread(() -> web.evaluateJavascript(js, null));
        } catch (Exception ignored) {
            // A page that is gone cannot be told; the next check starts again.
        }
    }
}
