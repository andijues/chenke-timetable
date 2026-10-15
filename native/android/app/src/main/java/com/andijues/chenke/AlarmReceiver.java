package com.andijues.chenke;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import org.json.JSONObject;

public final class AlarmReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        String id = intent.getStringExtra("id"); if (id == null) return;
        AlarmStore store = new AlarmStore(context);
        try {
            JSONObject item = store.find(id);
            // Ignore stale or duplicate PendingIntents after edits; allow a short delivery delay.
            long now = System.currentTimeMillis();
            if (item == null || item.getLong("at") > now + 2_000L || now - item.getLong("at") > 600_000L) return;
            context.startForegroundService(new Intent(context, RingService.class).setAction(RingService.RING).putExtra("id", id));
        } catch (Exception e) { store.error("系统未能启动响铃，请打开晨课重新测试。"); }
    }
}
