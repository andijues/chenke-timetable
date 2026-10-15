package com.andijues.chenke;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.HashSet;
import java.util.Set;

/** Own-app ledger only. Device-protected storage lets reboot recovery work before unlock. */
public final class AlarmStore {
    public static final String CHANNEL = "chenke_wake_v1";
    private static final Object LOCK = new Object();
    private final Context context;
    private final SharedPreferences prefs;
    private final AlarmManager alarms;

    public AlarmStore(Context context) {
        this.context = context.getApplicationContext().createDeviceProtectedStorageContext();
        prefs = this.context.getSharedPreferences("wake", Context.MODE_PRIVATE);
        alarms = this.context.getSystemService(AlarmManager.class);
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        NotificationChannel channel = new NotificationChannel(CHANNEL, "起床闹钟", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("课程首课起床闹钟，声音使用系统闹钟音量");
        channel.setSound(null, null); // RingService owns looping alarm audio; avoid duplicate sound.
        channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(channel);
    }
    public boolean exactAllowed() { return Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms(); }
    public boolean notificationsAllowed() {
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        NotificationChannel channel = nm.getNotificationChannel(CHANNEL);
        return nm.areNotificationsEnabled() && channel != null && channel.getImportance() >= NotificationManager.IMPORTANCE_DEFAULT;
    }
    public boolean fullScreenAllowed() {
        return Build.VERSION.SDK_INT < 34 || context.getSystemService(NotificationManager.class).canUseFullScreenIntent();
    }
    public JSONObject capabilities() throws Exception {
        String message = !notificationsAllowed() ? "请允许晨课通知，才能显示关闭和稍后提醒按钮。"
            : !exactAllowed() ? "请允许“闹钟和提醒”，才能按首课时间准确响铃。"
            : !fullScreenAllowed() ? "准确闹钟权限已开启；锁屏全屏显示尚未允许，可在闹钟页检查权限。"
            : "Android 系统准确闹钟可用。请先测试退出应用后的锁屏响铃。";
        if (!lastError().isEmpty()) message += " 上次记录：" + lastError();
        return new JSONObject().put("platform", "android").put("supported", true).put("mode", "pending")
            .put("exactAllowed", exactAllowed()).put("notificationsAllowed", notificationsAllowed())
            .put("fullScreenAllowed", fullScreenAllowed()).put("message", message);
    }
    private JSONArray ledger() throws Exception { return new JSONArray(prefs.getString("ledger", "[]")); }
    private void persist(JSONArray ledger) {
        if (!prefs.edit().putString("ledger", ledger.toString()).commit())
            throw new IllegalStateException("闹钟记录保存失败，请重试");
    }
    private PendingIntent alarmIntent(String id) {
        Intent intent = new Intent(context, AlarmReceiver.class).setAction("com.andijues.chenke.FIRE")
            .setData(Uri.parse("chenke://wake/" + Uri.encode(id))).putExtra("id", id);
        return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    private void schedule(JSONObject item) throws Exception {
        PendingIntent show = PendingIntent.getActivity(context, 0,
            new Intent(context, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        alarms.setAlarmClock(new AlarmManager.AlarmClockInfo(item.getLong("at"), show), alarmIntent(item.getString("id")));
    }
    private void cancel(String id) { alarms.cancel(alarmIntent(id)); }
    public void cancelAllOwned() throws Exception {
        synchronized(LOCK){
            JSONArray old=ledger();
            for(int i=0;i<old.length();i++)cancel(old.getJSONObject(i).getString("id"));
            persist(new JSONArray());
            context.stopService(new Intent(context,RingService.class));
        }
    }
    private JSONObject status(int count) throws Exception {
        return new JSONObject().put("mode", count == 0 ? "idle" : "alarm").put("scheduled", count).put("failed", false)
            .put("message", count == 0 ? "当前没有待响铃计划，本应用旧计划已取消。"
                : "已交给 Android 系统安排。使用闹钟音量；请通过锁屏测试确认本机行为。"
                    + (fullScreenAllowed() ? "" : " 锁屏全屏显示尚未允许，响铃时请从通知操作。"));
    }
    public JSONObject synchronize(JSONArray plans) throws Exception {
        synchronized (LOCK) {
            if (plans.length() > 28) throw new IllegalArgumentException("起床计划超过 28 个");
            long now = System.currentTimeMillis(); JSONArray desired = new JSONArray(); Set<String> ids = new HashSet<>();
            for (int i = 0; i < plans.length(); i++) {
                JSONObject p = plans.getJSONObject(i); String id = p.getString("id"); long at = AlarmTime.parse(p.getString("fireAt"));
                AlarmTime.validate(id, at, now);
                if (!ids.add(id)) throw new IllegalArgumentException("起床日期重复");
                desired.put(new JSONObject().put("id", id).put("at", at).put("course", p.optString("course"))
                    .put("courseStart", p.optString("courseStart")).put("snoozes", 0));
            }
            // Retain the user's one-minute test and a manually snoozed alarm on page resume.
            JSONArray old = ledger();
            for (int i = 0; i < old.length(); i++) {
                JSONObject p = old.getJSONObject(i);
                if (p.optBoolean("test") || p.optInt("snoozes") > 0) {
                    if (AlarmTime.isFuture(p.getLong("at"), now) && (p.optBoolean("test") || plans.length() > 0)) {
                        for (int j = desired.length() - 1; j >= 0; j--) if (desired.getJSONObject(j).getString("id").equals(p.getString("id"))) desired.remove(j);
                        desired.put(p);
                    }
                }
            }
            if (desired.length() > 0 && (!exactAllowed() || !notificationsAllowed())) {
                // Keep the desired ledger for permission-grant recovery, but never claim success.
                for (int i = 0; i < old.length(); i++) cancel(old.getJSONObject(i).getString("id"));
                persist(desired);
                return new JSONObject().put("mode", "error").put("scheduled", 0).put("failed", true)
                    .put("message", "尚未安排：请点“检查权限并更新”，允许通知和“闹钟和提醒”。");
            }
            // Write first: after a crash/reboot a receiver can reconcile the intended plans.
            persist(desired);
            Set<String> keep = new HashSet<>();
            for (int i = 0; i < desired.length(); i++) keep.add(desired.getJSONObject(i).getString("id"));
            for (int i = 0; i < old.length(); i++) if (!keep.contains(old.getJSONObject(i).getString("id"))) cancel(old.getJSONObject(i).getString("id"));
            try {
                for (int i = 0; i < desired.length(); i++) schedule(desired.getJSONObject(i));
            } catch (Exception e) {
                for (int i = 0; i < desired.length(); i++) cancel(desired.getJSONObject(i).getString("id"));
                throw e;
            }
            return status(plans.length());
        }
    }
    public JSONObject test() throws Exception {
        synchronized (LOCK) {
            if (!exactAllowed() || !notificationsAllowed()) throw new IllegalStateException("请先允许通知与“闹钟和提醒”，再测试。");
            JSONArray items = ledger();
            for (int i = items.length() - 1; i >= 0; i--) if (items.getJSONObject(i).optBoolean("test")) {
                cancel(items.getJSONObject(i).getString("id")); items.remove(i);
            }
            JSONObject item = new JSONObject().put("id", "chenke-test").put("at", System.currentTimeMillis() + 60_000L)
                .put("course", "一分钟锁屏测试").put("courseStart", "").put("snoozes", 0).put("test", true);
            items.put(item); persist(items); schedule(item);
            return new JSONObject().put("message", "已设置 1 分钟后的系统闹钟，请退出应用并锁屏。");
        }
    }
    public JSONObject find(String id) throws Exception {
        synchronized (LOCK) { JSONArray items = ledger(); for (int i = 0; i < items.length(); i++) {
            JSONObject p = items.getJSONObject(i); if (id.equals(p.optString("id"))) return p;
        } return null; }
    }
    public void finish(String id, boolean snooze) throws Exception {
        synchronized (LOCK) {
            JSONArray items = ledger();
            for (int i = items.length() - 1; i >= 0; i--) {
                JSONObject p = items.getJSONObject(i); if (!id.equals(p.optString("id"))) continue;
                cancel(id);
                if (snooze && p.optInt("snoozes") < 2) {
                    p.put("at", System.currentTimeMillis() + 300_000L).put("snoozes", p.optInt("snoozes") + 1);
                    persist(items); schedule(p); return;
                }
                items.remove(i);
            }
            persist(items);
        }
    }
    public void restore() throws Exception {
        synchronized (LOCK) {
            JSONArray old = ledger(), future = new JSONArray(); long now = System.currentTimeMillis();
            for (int i = 0; i < old.length(); i++) {
                JSONObject p = old.getJSONObject(i);
                if (AlarmTime.isFuture(p.getLong("at"), now)) future.put(p);
                else cancel(p.getString("id"));
            }
            persist(future);
            if (exactAllowed() && notificationsAllowed()) for (int i = 0; i < future.length(); i++) schedule(future.getJSONObject(i));
        }
    }
    public void error(String message) { prefs.edit().putString("lastError", message).apply(); }
    public String lastError() { return prefs.getString("lastError", ""); }
}
