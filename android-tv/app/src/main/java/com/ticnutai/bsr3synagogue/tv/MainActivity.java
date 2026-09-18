package com.ticnutai.bsr3synagogue.tv;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;

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

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

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
}
