import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {createState} from '../../src/core.mjs';

async function clockPhone(page,{unsupported=false,day=4,empty=false}={}){
  const state=createState('2026-10-14');state.settings.enabled=true;
  state.courses=empty?[]:[{id:'clock-course',name:'系统时钟晨课',day,start:'08:30',end:'10:10',weeks:[1,2,3],confirmed:true,color:'mint'}];
  await page.clock.install({time:new Date('2026-10-14T09:00:00+08:00')});
  await page.addInitScript(({state,unsupported})=>{
    window.__clockCalls=[];window.__clockLast=null;
    window.AndroidBridge={postMessage(raw){
      const m=JSON.parse(raw);window.__clockCalls.push(m);let data={};
      if(m.action==='loadState')data={state};
      if(m.action==='capabilities')data={platform:'android',supported:true,clockAvailable:!unsupported};
      if(m.action==='syncAlarms')data=m.payload.mode==='clock'?{mode:'clock-preview',scheduled:0,message:'计划已计算，请在时钟确认保存。',lastClockRequest:window.__clockLast}:{mode:'alarm',scheduled:m.payload.plans.length,message:'晨课后台计划已安排'};
      if(m.action==='openClockAlarm'||m.action==='testClockAlarm'){
        if(unsupported){queueMicrotask(()=>window.chenkeNativeResult({id:m.id,error:'当前兼容环境没有提供创建时钟闹钟的接口，请打开手机自带时钟手动添加。'}));return;}
        const plan=m.payload.plan;window.__clockLast={fireAt:plan?.fireAt??'2026-10-14T01:02:00Z',localDate:plan?.alarmDate??'2026-10-14',localTime:plan?.alarmTime??'09:02',test:m.action==='testClockAlarm'};
        data={mode:'clock-request',scheduled:0,opened:true,confirmed:false,lastClockRequest:window.__clockLast,message:'已打开时钟，请核对时间并保存。'};
      }
      queueMicrotask(()=>window.chenkeNativeResult({id:m.id,data}));
    }};
  },{state,unsupported});
  await page.goto('/');await page.getByRole('button',{name:'闹钟',exact:true}).click();
}

test('Android 默认交给时钟且修改课表不自动再次创建外部闹钟',async({page})=>{
  await clockPhone(page);
  await expect(page.locator('#android-alarm-mode')).toHaveValue('clock');
  await expect(page.getByRole('checkbox',{name:'按课表计算起床计划'})).toBeChecked();
  await page.getByRole('button',{name:'课表',exact:true}).click();
  await expect(page.locator('.wake-status')).toContainText('待交给手机时钟');
  await page.getByRole('button',{name:'闹钟',exact:true}).click();
  await expect(page.locator('.clock-next')).toContainText('07:00');
  await expect.poll(()=>page.evaluate(()=>window.__clockCalls.filter(m=>m.action==='syncAlarms').at(-1)?.payload.mode)).toBe('clock');
  expect(await page.evaluate(()=>window.__clockCalls.filter(m=>m.action==='openClockAlarm').length)).toBe(0);
  await page.getByRole('button',{name:'交给系统时钟',exact:true}).click();
  await expect(page.locator('.native-status')).toContainText('请在时钟中确认保存');
  await expect(page.locator('.native-status')).not.toContainText('已调度');
  await page.getByRole('button',{name:'课表',exact:true}).click();
  await expect(page.locator('.wake-status')).toContainText('请在时钟确认已保存');
  await page.getByRole('button',{name:'闹钟',exact:true}).click();
  expect(await page.evaluate(()=>window.__clockCalls.filter(m=>m.action==='openClockAlarm').at(-1).payload.plan.alarmTime)).toBe('07:00');
  await page.locator('#lead-input').fill('60');await page.locator('#lead-input').press('Tab');
  await expect(page.locator('.clock-next')).toContainText('07:30');
  await expect(page.locator('.clock-last')).toContainText('起床计划已变更');
  expect(await page.evaluate(()=>window.__clockCalls.filter(m=>m.action==='openClockAlarm').length)).toBe(1);
  await page.locator('#android-alarm-mode').selectOption('app');
  await expect.poll(()=>page.evaluate(()=>window.__clockCalls.filter(m=>m.action==='syncAlarms').at(-1)?.payload.mode)).toBe('app');
});

test('时钟不支持转接时给出恢复步骤，测试不索取晨课后台权限',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await clockPhone(page,{unsupported:true});
  await page.getByRole('button',{name:'测试时钟（1–2 分钟）'}).click();
  await expect(page.locator('.native-status')).toContainText('手机自带时钟手动添加');
  await expect(page.locator('.clock-feedback[role=alert]')).toContainText('手机自带时钟手动添加');
  await expect(page.locator('.clock-feedback[role=alert]')).toBeInViewport({ratio:1});
  expect(await page.evaluate(()=>window.__clockCalls.some(m=>['requestPermissions','testAlarm'].includes(m.action)))).toBe(false);
});

test('过远的课程日期不能误传成明天的时钟闹钟',async({page})=>{
  await clockPhone(page,{day:5});
  await expect(page.getByRole('button',{name:'交给系统时钟',exact:true})).toBeDisabled();
  await expect(page.locator('.clock-handoff')).toContainText('不能指定课程日期');
  expect(await page.evaluate(()=>window.__clockCalls.some(m=>m.action==='openClockAlarm'))).toBe(false);
});

test('空课表没有可交接的时钟计划但仍可手动测试',async({page})=>{
  await clockPhone(page,{empty:true});
  await expect(page.getByRole('button',{name:'交给系统时钟',exact:true})).toBeDisabled();
  await expect(page.locator('.clock-next')).toContainText('等待课程');
  await expect(page.getByRole('button',{name:'测试时钟（1–2 分钟）'})).toBeEnabled();
});

test('界面证据：系统时钟交接的桌面、手机和错误状态',async({browser})=>{
  mkdirSync('.impeccable/review',{recursive:true});
  for(const [name,width,height] of [['desktop',1280,1100],['phone',390,844],['user-500',500,900]]){
    const page=await browser.newPage({viewport:{width,height}});await clockPhone(page);
    await expect(page.getByRole('button',{name:'交给系统时钟',exact:true})).toBeEnabled();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`.impeccable/review/clock-${name}.png`,fullPage:true});
    if(name==='phone'){
      await page.getByRole('button',{name:'交给系统时钟',exact:true}).click();
      await page.screenshot({path:'.impeccable/review/clock-phone-request.png',fullPage:true});
      await page.getByRole('button',{name:'课表',exact:true}).click();
      await expect(page.locator('.wake-status')).toContainText('请在时钟确认已保存');
      await page.screenshot({path:'.impeccable/review/clock-phone-home.png',fullPage:true});
    }
    await page.close();
  }
  const page=await browser.newPage({viewport:{width:390,height:844}});await clockPhone(page,{unsupported:true});
  await page.getByRole('button',{name:'测试时钟（1–2 分钟）'}).click();
  await expect(page.locator('.native-status')).toContainText('没有提供');
  await page.screenshot({path:'.impeccable/review/clock-phone-error.png',fullPage:true});await page.close();
});
