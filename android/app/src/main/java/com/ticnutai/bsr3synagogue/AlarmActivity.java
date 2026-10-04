package com.ticnutai.bsr3synagogue;

import android.app.Activity;
import android.app.KeyguardManager;
import android.app.NotificationManager;
import android.content.Context;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * The whole screen of a ringing minyan, over the lock screen: its name and
 * time, "עצירה" and "עוד 5 דקות". Closing it in any way stops the ring.
 */
public class AlarmActivity extends Activity {
    private int id;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) km.requestDismissKeyguard(this, null);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        id = getIntent().getIntExtra("id", 1);
        final String title = getIntent().getStringExtra("title");
        final String body = getIntent().getStringExtra("body");

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        root.setBackgroundColor(Color.rgb(18, 36, 63));
        int pad = dp(28);
        root.setPadding(pad, pad, pad, pad);

        TextView bell = text("\uD83D\uDD14", 64, Color.WHITE);
        TextView name = text(title == null ? "" : title, 34, Color.rgb(240, 214, 140));
        TextView more = text(body == null ? "" : body, 20, Color.WHITE);
        root.addView(bell);
        root.addView(name);
        root.addView(more);

        Button stop = button(getString(R.string.shul_alarm_stop), Color.rgb(240, 214, 140), Color.rgb(18, 36, 63));
        stop.setOnClickListener(v -> close());
        Button snooze = button(getString(R.string.shul_alarm_snooze), Color.TRANSPARENT, Color.WHITE);
        snooze.setOnClickListener(v -> {
            AlarmScheduler.scheduleOne(this, id, System.currentTimeMillis() + 5 * 60 * 1000, title, body);
            close();
        });
        root.addView(stop);
        root.addView(snooze);
        setContentView(root);
    }

    private void close() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(id);
        finish();
    }

    @Override
    public void onBackPressed() {
        close();
    }

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    private TextView text(String s, int sp, int color) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color);
        t.setGravity(Gravity.CENTER);
        t.setPadding(0, dp(8), 0, dp(8));
        return t;
    }

    private Button button(String s, int bg, int fg) {
        Button b = new Button(this);
        b.setText(s);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        b.setTextColor(fg);
        b.setBackgroundColor(bg);
        b.setAllCaps(false);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(64));
        lp.topMargin = dp(20);
        b.setLayoutParams(lp);
        return b;
    }
}
