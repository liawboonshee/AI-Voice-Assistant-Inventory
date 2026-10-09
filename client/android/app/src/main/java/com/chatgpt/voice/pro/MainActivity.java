package com.chatgpt.voice.pro;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(InventoryBackupPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
