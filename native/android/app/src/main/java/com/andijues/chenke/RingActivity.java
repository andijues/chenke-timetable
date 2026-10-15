package com.andijues.chenke;

import android.app.Activity;
import android.content.*;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.view.*;
import android.widget.*;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import org.json.JSONObject;

public final class RingActivity extends Activity {
    private String id;
    private boolean registered;
    private final BroadcastReceiver closed = new BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent i) { finish(); }
    };
    // The legacy overload is used exclusively below API 33; newer versions require the flag.
    @android.annotation.SuppressLint("UnspecifiedRegisterReceiverFlag")
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true); }
        else getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        show(getIntent());
        IntentFilter filter = new IntentFilter(RingService.CLOSED);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(closed, filter, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(closed, filter);
        registered = true;
    }
    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); show(intent); }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private TextView text(String value, float size, boolean bold) {
        TextView v = new TextView(this); v.setText(value); v.setTextSize(size); v.setTextColor(0xff164b42);
        if (bold) v.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        v.setPadding(0, dp(8), 0, dp(8)); return v;
    }
    private void show(Intent intent) {
        id = intent.getStringExtra("id");
        try {
            JSONObject item = new AlarmStore(this).find(id == null ? "" : id);
            if (item == null) { finish(); return; }
            LinearLayout column = new LinearLayout(this); column.setOrientation(LinearLayout.VERTICAL);
            column.setGravity(Gravity.CENTER_VERTICAL); column.setPadding(dp(28), dp(32), dp(28), dp(32));
            column.setBackgroundColor(0xfff6f8f7);
            column.setOnApplyWindowInsetsListener((view, insets) -> {
                view.setPadding(dp(28) + insets.getSystemWindowInsetLeft(), dp(24) + insets.getSystemWindowInsetTop(),
                    dp(28) + insets.getSystemWindowInsetRight(), dp(24) + insets.getSystemWindowInsetBottom());
                return insets;
            });
            ScrollView scroll = new ScrollView(this); scroll.setFillViewport(true); scroll.addView(column); setContentView(scroll);
            column.addView(text("该起床啦", 32, true));
            column.addView(text(ZonedDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm")), 64, true));
            column.addView(text(item.optString("course"), 22, true));
            if (!item.optString("courseStart").isEmpty()) column.addView(text(item.optString("courseStart") + " 上课，留好出发时间。", 17, false));
            Button stop = new Button(this); stop.setText("关闭闹钟"); stop.setTextSize(18); stop.setMinHeight(dp(56));
            stop.setOnClickListener(v -> send(RingService.STOP)); column.addView(stop);
            if (item.optInt("snoozes") < 2) {
                Button snooze = new Button(this); snooze.setText("稍后 5 分钟"); snooze.setTextSize(18); snooze.setMinHeight(dp(56));
                snooze.setOnClickListener(v -> send(RingService.SNOOZE)); column.addView(snooze);
                column.addView(text("还可稍后提醒 " + (2 - item.optInt("snoozes")) + " 次 · 响铃最长 1 分钟", 14, false));
            }
        } catch (Exception e) { finish(); }
    }
    private void send(String action) {
        startService(new Intent(this, RingService.class).setAction(action).putExtra("id", id)); finish();
    }
    @Override protected void onDestroy() { if (registered) unregisterReceiver(closed); super.onDestroy(); }
}
