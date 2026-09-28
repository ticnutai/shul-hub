package com.ticnutai.bsr3synagogue.tv;

import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

/**
 * Host activity for the synagogue wall display.
 *
 * Unlike the congregant app this screen is an appliance: nobody is present to
 * wake it, dismiss a system bar, or restart it. The two window flags below are
 * what make it behave like signage rather than like an app that happens to be
 * open.
 */
public class MainActivity extends BridgeActivity {

    private long createdAt;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The board updates itself from the website (ApkUpdater, src/tv/apkUpdate.ts).
        registerPlugin(ApkUpdater.class);
        super.onCreate(savedInstanceState);

        // A fresh screen every night (see NightlyRestart).
        createdAt = SystemClock.elapsedRealtime();
        NightlyRestart.boardCreatedAt = createdAt;
        NightlyRestart.schedule(this);
        // And the check that opens the board again if it ever stops being on
        // the screen (Keepalive).
        Keepalive.schedule(this);

        // The board is useless once the panel sleeps, and a TV with no input
        // events sleeps on its own schedule. The web layer also requests a
        // screen wake lock; this covers the case where that API is missing on
        // an older Android TV WebView.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Hide the system bars. They serve no purpose without a remote in use
        // and, being static and bright, are the most likely thing on screen to
        // burn into a panel left on for months.
        // Android draws its own focus highlight over a focused view once the
        // device is in key-navigation mode, which a TV always is after the first
        // remote press. On the board it showed as a frame around the whole
        // screen. The page has nothing focusable, so the highlight is pure noise.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && getBridge() != null) {
            getBridge().getWebView().setDefaultFocusHighlightEnabled(false);
        }

        View decor = getWindow().getDecorView();
        decor.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );
    }

    /**
     * Back, handed to the board rather than swallowed.
     *
     * The board is served from the website, not from the copy inside this
     * APK, and on that origin Capacitor's plugin bridge does not apply: every
     * call answers '"App" plugin is not implemented on android' - measured on
     * a box on 28.9. So the app's own Back listener was never registered, and
     * pressing Back on the remote did nothing at all. A menu that says "press
     * Back to close" and does not close is a trap on a wall nobody can reach.
     *
     * This needs no plugin. The key press is offered to the page as an
     * ordinary event, and the page says whether it used it: a menu that is
     * open closes, and if nothing wanted it the app behaves as it did before.
     * Asking the page is asynchronous, so the press cannot be answered on the
     * spot - the answer comes back and, if the page did not want it, Back is
     * carried out then.
     */
    @Override
    public void onBackPressed() {
        WebView web = getBridge() != null ? getBridge().getWebView() : null;
        if (web == null) {
            super.onBackPressed();
            return;
        }
        web.evaluateJavascript(
            "(function(){try{var e=new KeyboardEvent('keydown',{key:'GoBack',bubbles:true,cancelable:true});"
                + "window.dispatchEvent(e);return e.defaultPrevented?'1':'0';}catch(err){return '0';}})()",
            value -> {
                // `super` cannot be reached from inside a lambda, so the
                // ordinary behaviour is kept in a method of its own.
                if (!"\"1\"".equals(value) && !"1".equals(value)) defaultBack();
            });
    }

    /** What Back did before the page was given the chance to want it. */
    private void defaultBack() {
        super.onBackPressed();
    }

    @Override
    public void onDestroy() {
        // During the nightly restart the new screen is created before the old
        // one is destroyed; only clear the mark if it is still ours.
        if (NightlyRestart.boardCreatedAt == createdAt) NightlyRestart.boardCreatedAt = 0;
        super.onDestroy();
    }
}
