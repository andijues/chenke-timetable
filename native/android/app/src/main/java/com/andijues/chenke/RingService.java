package com.andijues.chenke;

import android.app.*;
import android.content.*;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.*;
import org.json.JSONObject;

/** Started by a user-requested exact alarm. No WebView timer or push service is involved. */
public final class RingService extends Service {
    public static final String RING = "com.andijues.chenke.RING";
    public static final String STOP = "com.andijues.chenke.STOP";
    public static final String SNOOZE = "com.andijues.chenke.SNOOZE";
    public static final String CLOSED = "com.andijues.chenke.CLOSED";
    private static final int NOTIFICATION = 7;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private MediaPlayer player;
    private PowerManager.WakeLock wakeLock;
    private Vibrator vibrator;
    private String activeId;
    private final Runnable timeout = () -> finishAlarm(false);

    @Override public IBinder onBind(Intent intent) { return null; }
    static PendingIntent screen(Context context, String id) {
        Intent open = new Intent(context, RingActivity.class).setData(Uri.parse("chenke://ring/" + Uri.encode(id)))
            .putExtra("id", id).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        Bundle options = null;
        if (Build.VERSION.SDK_INT >= 35) {
            ActivityOptions o = ActivityOptions.makeBasic();
            o.setPendingIntentCreatorBackgroundActivityStartMode(ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED);
            options = o.toBundle();
        }
        return PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE, options);
    }
    private PendingIntent action(String action, String id) {
        return PendingIntent.getService(this, 0, new Intent(this, RingService.class).setAction(action)
            .setData(Uri.parse("chenke://action/" + Uri.encode(id) + "/" + action)).putExtra("id", id),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) { stopSelf(); return START_NOT_STICKY; }
        String id = intent.getStringExtra("id");
        if (STOP.equals(intent.getAction()) || SNOOZE.equals(intent.getAction())) {
            if (id != null && (activeId == null || id.equals(activeId))) {
                activeId = id; finishAlarm(SNOOZE.equals(intent.getAction()));
            }
            return START_NOT_STICKY;
        }
        if (!RING.equals(intent.getAction()) || id == null) { stopSelf(); return START_NOT_STICKY; }
        if (id.equals(activeId)) return START_NOT_STICKY;
        AlarmStore store = new AlarmStore(this);
        try {
            JSONObject item = store.find(id); if (item == null) { stopSelf(); return START_NOT_STICKY; }
            if (activeId != null) { String previous = activeId; release(); store.finish(previous, false); }
            activeId = id;
            Notification.Builder builder = new Notification.Builder(this, AlarmStore.CHANNEL)
                .setSmallIcon(com.andijues.chenke.R.drawable.ic_alarm).setContentTitle("该起床啦")
                .setContentText(item.optString("course") + (item.optString("courseStart").isEmpty() ? "" : " · " + item.optString("courseStart") + " 上课"))
                .setCategory(Notification.CATEGORY_ALARM).setOngoing(true)
                .setVisibility(Notification.VISIBILITY_PUBLIC).setContentIntent(screen(this, id))
                .addAction(new Notification.Action.Builder(null, "关闭", action(STOP, id)).build());
            if (item.optInt("snoozes") < 2)
                builder.addAction(new Notification.Action.Builder(null, "稍后 5 分钟", action(SNOOZE, id)).build());
            if (store.fullScreenAllowed()) builder.setFullScreenIntent(screen(this, id), true);
            if (Build.VERSION.SDK_INT >= 29)
                startForeground(NOTIFICATION, builder.build(), android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            else startForeground(NOTIFICATION, builder.build());
            PowerManager power = getSystemService(PowerManager.class);
            wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "chenke:alarm");
            wakeLock.acquire(90_000L);
            vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator())
                vibrator.vibrate(VibrationEffect.createWaveform(new long[]{0, 600, 400, 600, 1400}, 0),
                    new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build());
            playAlarm(store);
            handler.removeCallbacks(timeout); handler.postDelayed(timeout, 60_000L);
        } catch (Exception e) {
            store.error("响铃启动失败，请重新打开晨课做锁屏测试。");
            finishAlarm(false);
        }
        return START_NOT_STICKY;
    }
    private void playAlarm(AlarmStore store) {
        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (sound == null) sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        try {
            player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            player.setDataSource(this, sound); player.setLooping(true);
            player.setOnErrorListener((mp, what, extra) -> { store.error("系统闹钟铃声播放失败，请检查手机铃声设置。"); return true; });
            player.prepare(); player.start(); store.error("");
        } catch (Exception e) { store.error("系统闹钟铃声无法播放，请检查铃声与闹钟音量。"); }
    }
    private void finishAlarm(boolean snooze) {
        String id = activeId;
        if (id != null) {
            try { new AlarmStore(this).finish(id, snooze); }
            catch (Exception e) { new AlarmStore(this).error("稍后提醒设置失败，请打开晨课检查权限。"); }
        }
        release();
        sendBroadcast(new Intent(CLOSED).setPackage(getPackageName()));
        stopForeground(STOP_FOREGROUND_REMOVE); stopSelf();
    }
    private void release() {
        handler.removeCallbacks(timeout);
        if (player != null) { try { player.stop(); } catch (Exception ignored) {} player.release(); player = null; }
        if (vibrator != null) { vibrator.cancel(); vibrator = null; }
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null; activeId = null;
    }
    @Override public void onDestroy() { release(); super.onDestroy(); }
}
