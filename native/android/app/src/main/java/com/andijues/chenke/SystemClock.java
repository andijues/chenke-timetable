package com.andijues.chenke;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ResolveInfo;
import android.provider.AlarmClock;
import org.json.JSONArray;
import org.json.JSONObject;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;

/** Hands one dated plan to a public Clock UI. Opening an Activity is not a save receipt. */
public final class SystemClock {
    private final Context context;
    public SystemClock(Context context) { this.context=context; }
    private Intent alarmIntent() { return new Intent(AlarmClock.ACTION_SET_ALARM); }
    private SharedPreferences prefs() { return context.getSharedPreferences("clock_handoff",Context.MODE_PRIVATE); }
    public JSONObject capabilities() throws Exception {
        ResolveInfo handler=context.getPackageManager().resolveActivity(alarmIntent(),0);
        return new JSONObject().put("clockAvailable",handler!=null)
            .put("clockApp",handler==null?"":handler.loadLabel(context.getPackageManager()).toString());
    }
    public JSONObject preview(JSONArray plans) throws Exception {
        long earliest=Long.MAX_VALUE;JSONObject first=null;
        for(int i=0;i<plans.length();i++){
            JSONObject plan=plans.getJSONObject(i);long at=AlarmTime.parse(plan.getString("fireAt"));
            AlarmTime.validate(plan.getString("id"),at,java.lang.System.currentTimeMillis());
            if(at<earliest){earliest=at;first=plan;}
        }
        JSONObject result=capabilities().put("mode","clock-preview").put("scheduled",0).put("failed",false)
            .put("message","起床计划已计算。请点“交给系统时钟”，在打开的时钟里确认时间并保存。");
        if(first==null)result.put("message","当前没有待交接的起床计划。请启用计划并确认课程；也可以先测试系统时钟。");
        else try {ClockTime.requireNextOccurrence(earliest,java.lang.System.currentTimeMillis(),ZoneId.systemDefault());}
        catch(IllegalArgumentException error){result.put("message",error.getMessage());}
        String saved=prefs().getString("lastRequest","");
        if(!saved.isEmpty())result.put("lastClockRequest",new JSONObject(saved));
        return result;
    }
    public JSONObject open(Activity activity,JSONObject plan,boolean test) throws Exception {
        if(!test&&plan==null)throw new IllegalArgumentException("没有可交接的起床计划，请先确认晨课并启用计划。");
        long now=java.lang.System.currentTimeMillis();
        long at=test?ClockTime.testAt(now):AlarmTime.parse(plan.getString("fireAt"));
        if(!test)AlarmTime.validate(plan.getString("id"),at,now);
        ZonedDateTime local=ClockTime.requireNextOccurrence(at,now,ZoneId.systemDefault());
        String course=test?"响铃测试":plan.optString("course","起床");
        if(course.length()>100)throw new IllegalArgumentException("课程名称过长，请修改后重试。");
        String label="晨课 "+local.toLocalDate()+" "+course;
        Intent intent=alarmIntent().putExtra(AlarmClock.EXTRA_HOUR,local.getHour())
            .putExtra(AlarmClock.EXTRA_MINUTES,local.getMinute()).putExtra(AlarmClock.EXTRA_MESSAGE,label)
            .putExtra(AlarmClock.EXTRA_SKIP_UI,false);
        try { activity.startActivity(intent); }
        catch(ActivityNotFoundException error){throw new IllegalStateException("当前系统或兼容环境没有提供创建时钟闹钟的接口。请打开手机自带“时钟”，按显示的起床时间手动添加。");}
        catch(SecurityException error){throw new IllegalStateException("系统拒绝了时钟调用。请打开手机自带“时钟”手动添加；当前兼容环境可能不支持转接。");}
        JSONObject request=new JSONObject().put("fireAt",Instant.ofEpochMilli(at).toString())
            .put("localTime",String.format(java.util.Locale.ROOT,"%02d:%02d",local.getHour(),local.getMinute()))
            .put("localDate",local.toLocalDate().toString()).put("course",course).put("test",test)
            .put("requestedAt",Instant.ofEpochMilli(now).toString());
        prefs().edit().putString("lastRequest",request.toString()).apply();
        return new JSONObject().put("mode","clock-request").put("opened",true).put("confirmed",false)
            .put("scheduled",0).put("failed",false).put("lastClockRequest",request)
            .put("message","已打开时钟，请核对 "+request.getString("localTime")+" 并保存。晨课无法读取时钟是否保存成功；请确认时钟列表中出现该闹钟。");
    }
    public JSONObject show(Activity activity) throws Exception {
        try {activity.startActivity(new Intent(AlarmClock.ACTION_SHOW_ALARMS));}
        catch(ActivityNotFoundException|SecurityException error){throw new IllegalStateException("当前环境不支持打开闹钟列表，请从桌面打开手机自带“时钟”。");}
        return new JSONObject().put("message","请在时钟列表里检查时间、重复和启用状态。");
    }
}
