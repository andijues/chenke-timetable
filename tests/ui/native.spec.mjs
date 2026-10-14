import {test,expect} from '@playwright/test';
import {createState} from '../../src/core.mjs';

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
