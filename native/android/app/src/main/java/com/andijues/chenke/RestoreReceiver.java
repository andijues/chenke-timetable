package com.andijues.chenke;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import java.util.Set;
import java.util.HashSet;
import java.util.Arrays;

public final class RestoreReceiver extends BroadcastReceiver {
    private static final Set<String> ACTIONS = new HashSet<>(Arrays.asList(Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_LOCKED_BOOT_COMPLETED,
        Intent.ACTION_MY_PACKAGE_REPLACED, Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED,
        "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED"));
    @Override public void onReceive(Context context, Intent intent) {
        if (intent.getAction() == null || !ACTIONS.contains(intent.getAction())) return;
        PendingResult pending = goAsync();
        new Thread(() -> {
            AlarmStore store = new AlarmStore(context);
            try { store.restore(); } catch (Exception e) { store.error("重启后恢复闹钟失败，请打开晨课检查权限并更新。"); }
            finally { pending.finish(); }
        }, "chenke-restore").start();
        // Reboot recovery only re-registers future alarms, never starts media playback at boot.
    }
}
