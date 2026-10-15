import {test,expect} from '@playwright/test';
import {createState} from '../../src/core.mjs';

test('Android 自动识别原生桥接，权限不足不误报成功，授权后支持测试和更新',async({page})=>{
  const state=createState('2026-10-14');state.settings.enabled=true;
  state.settings.androidAlarmMode='app';
  state.courses=[{id:'android-course',name:'安卓晨课',day:4,start:'08:30',end:'10:10',weeks:[1,2,3],confirmed:true,color:'mint'}];
  await page.clock.install({time:new Date('2026-10-14T09:00:00+08:00')});
  await page.addInitScript(state=>{
    window.__androidAllowed=false;window.__androidCalls=[];
    window.AndroidBridge={postMessage(raw){
      const m=JSON.parse(raw);window.__androidCalls.push(m);let data={};
      if(m.action==='loadState')data={state};
      if(m.action==='capabilities'||m.action==='requestPermissions')data={platform:'android',supported:true,exactAllowed:window.__androidAllowed,notificationsAllowed:window.__androidAllowed,message:'请允许准确闹钟'};
      if(m.action==='syncAlarms')data=window.__androidAllowed?{mode:'alarm',scheduled:m.payload.plans.length,message:'Android 已接受起床计划'}:{mode:'error',scheduled:0,failed:true,message:'尚未安排，请允许准确闹钟'};
      if(m.action==='testAlarm')data={message:'已设置 1 分钟后的系统闹钟，请锁屏'};
      queueMicrotask(()=>window.chenkeNativeResult({id:m.id,data}));
    }};
  },state);
  await page.goto('/');await page.getByRole('button',{name:'闹钟',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-platform','android');
  await expect(page.locator('.native-status')).toContainText('尚未安排');
  await page.getByRole('button',{name:'测试 1 分钟后响铃'}).click();
  expect(await page.evaluate(()=>window.__androidCalls.filter(m=>m.action==='testAlarm').length)).toBe(0);
  await page.evaluate(()=>window.__androidAllowed=true);
  await page.getByRole('button',{name:'检查权限并更新'}).click();
  await expect(page.locator('.native-status')).toContainText('Android 已接受');
  expect(await page.evaluate(()=>window.__androidCalls.filter(m=>m.action==='syncAlarms').at(-1).payload.plans[0].alarmTime)).toBe('07:00');
  await page.getByRole('button',{name:'测试 1 分钟后响铃'}).click();await expect(page.locator('#toast')).toContainText('已设置 1 分钟');
  await page.locator('#alarm-enabled').uncheck();
  await expect.poll(()=>page.evaluate(()=>window.__androidCalls.filter(m=>m.action==='syncAlarms').at(-1).payload.plans.length)).toBe(0);
});

test('鸿蒙返回前台重新核对同一计划，并呈现权限撤销与恢复',async({page})=>{
  const state=createState('2026-10-14');state.settings.enabled=true;
  state.courses=[{id:'native-morning',name:'晨课测试',location:'演示教室',day:4,start:'08:30',end:'10:10',weeks:[1,2,3,4,5],color:'mint',confirmed:true,source:'test'}];
  await page.clock.install({time:new Date('2026-10-14T09:00:00+08:00')});
  await page.addInitScript(state=>{
    window.__chenkePlatform='harmony';window.__testNativeCalls=[];window.__testNotificationsEnabled=true;
    window.HarmonyBridge={postMessage(raw){
      const message=JSON.parse(raw);window.__testNativeCalls.push(message);
      const result={id:message.id,data:{}};
      if(message.action==='capabilities')result.data={platform:'harmony',supported:true,mode:'pending'};
      if(message.action==='loadState')result.data={state};
      if(message.action==='syncAlarms'){
        if(!window.__testNotificationsEnabled){delete result.data;result.error='通知权限未开启，请重新允许晨课通知。';}
        else result.data={mode:'system-reminder',scheduled:message.payload.plans.length,message:'系统已接受测试代理计划。'};
      }
      queueMicrotask(()=>window.chenkeNativeResult(result));
    }};
  },state);
  await page.goto('/');await page.getByRole('button',{name:'闹钟',exact:true}).click();
  await expect(page.locator('.native-status')).toContainText('系统已接受');
  const initial=await page.evaluate(()=>window.__testNativeCalls.filter(c=>c.action==='syncAlarms'));
  expect(initial.length).toBeGreaterThan(0);expect(initial.at(-1).payload.plans[0].alarmTime).toBe('07:00');
  await page.evaluate(()=>{window.__testNotificationsEnabled=false;window.chenkeNativeResume();});
  await expect(page.locator('.native-status')).toContainText('通知权限未开启');
  const resumed=await page.evaluate(()=>window.__testNativeCalls.filter(c=>c.action==='syncAlarms'));
  expect(resumed.length).toBe(initial.length+1);expect(resumed.at(-1).payload.plans).toEqual(initial.at(-1).payload.plans);
  await page.evaluate(()=>{window.__testNotificationsEnabled=true;window.chenkeNativeResume();});
  await expect(page.locator('.native-status')).toContainText('系统已接受');
});
