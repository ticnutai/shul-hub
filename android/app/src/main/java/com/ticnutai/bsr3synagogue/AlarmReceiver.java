package com.ticnutai.bsr3synagogue;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;

/**
 * A minyan's alarm going off: a notification on the alarm channel that keeps
 * ringing until it is looked at (insistent), opening on the whole screen -
 * even locked - with "עצירה" and "עוד 5 דקות" (AlarmActivity). It stops by
 * itself after two minutes, so a phone left in a drawer does not ring all day.
 */
public class AlarmReceiver extends BroadcastReceiver {
    static final String CHANNEL = "shul_alarm";
    private static final long RING_FOR_MS = 2 * 60 * 1000;

    @Override
    public void onReceive(Context ctx, Intent intent) {
        ring(ctx, intent.getIntExtra("id", 1), intent.getStringExtra("title"), intent.getStringExtra("body"));
    }

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(
                CHANNEL, ctx.getString(R.string.shul_alarm_channel), NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription(ctx.getString(R.string.shul_alarm_channel_description));
        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (sound == null) sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        ch.setSound(sound, new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[] {0, 800, 600, 800, 600, 800});
        ch.setBypassDnd(false);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    static void ring(Context ctx, int id, String title, String body) {
        ensureChannel(ctx);
        Intent full = new Intent(ctx, AlarmActivity.class)
                .putExtra("id", id)
                .putExtra("title", title)
                .putExtra("body", body)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION);
        PendingIntent screen = PendingIntent.getActivity(
                ctx, id, full, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title == null ? "" : title)
                .setContentText(body == null ? "" : body)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setContentIntent(screen)
                .setFullScreenIntent(screen, true)
                .setAutoCancel(true)
                .setTimeoutAfter(RING_FOR_MS);
        Notification n = b.build();
        n.flags |= Notification.FLAG_INSISTENT;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(id, n);
    }
}
