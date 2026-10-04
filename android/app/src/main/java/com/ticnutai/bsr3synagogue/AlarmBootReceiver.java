package com.ticnutai.bsr3synagogue;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * After a restart, an app update, or the member allowing exact alarms:
 * Android has forgotten the alarms (or may now ring them on the minute), so
 * they are handed to it again from what the phone kept.
 */
public class AlarmBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        AlarmScheduler.scheduleStored(ctx);
    }
}
