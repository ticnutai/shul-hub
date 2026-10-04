package com.ticnutai.bsr3synagogue;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own part (ShulAlarmPlugin): before the bridge starts.
        registerPlugin(ShulAlarmPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
