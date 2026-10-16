import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {createState} from '../../src/core.mjs';

async function clockPhone(page,{unsupported=false,day=4,empty=false,confirmed=true,paused=false,lead=90,time='2026-10-14T09:00:00+08:00'}={}){
  const state=createState('2026-10-14');state.settings.enabled=true;
  state.settings.leadMinutes=lead;if(paused)state.settings.alarmSkippedDates=['2026-10-15'];
  state.courses=empty?[]:[{id:'clock-course',name:'系统时钟晨课',day,start:'08:30',end:'10:10',weeks:[1,2,3],confirmed,color:'mint'}];
  await page.clock.install({time:new Date(time)});
  await page.addInitScript(({state,unsupported})=>{
    window.__clockCalls=[];window.__clockLast=JSON.parse(localStorage.getItem('mock-clock-receipt')??'null');window.__clockSends=0;window.__mockClockAlarms=[];
    window.AndroidBridge={postMessage(raw){
      const m=JSON.parse(raw);window.__clockCalls.push(m);let data={};
      if(m.action==='loadState')data={state:JSON.parse(localStorage.getItem('mock-native-state')??'null')??state};
      if(m.action==='saveState')localStorage.setItem('mock-native-state',JSON.stringify(m.payload.state));
      if(m.action==='capabilities')data={platform:'android',supported:true,clockAvailable:!unsupported,lastClockRequest:window.__clockLast};
      if(m.action==='syncAlarms')data=m.payload.mode==='clock'?{mode:'clock-preview',scheduled:0,message:'按明天首课自动安排',lastClockRequest:window.__clockLast}:{mode:'alarm',scheduled:m.payload.plans.length,message:'晨课后台计划已安排'};
      if(m.action==='showClockAlarms')data={message:'已打开时钟列表，可手动删除'};
      if(m.action==='openClockAlarm'||m.action==='testClockAlarm'){
        if(unsupported){queueMicrotask(()=>window.chenkeNativeResult({id:m.id,error:'当前兼容环境没有提供创建时钟闹钟的接口。'}));return;}
        const plan=m.payload.plan,test=m.action==='testClockAlarm';
        if(!test&&!m.payload.force&&window.__clockLast?.date===plan.date&&window.__clockLast.fireAt!==plan.fireAt){
          data={mode:'clock-changed',scheduled:0,lastClockRequest:window.__clockLast,message:'起床计划已变更，请先删除旧闹钟再重新发送。'};
        }else{
          const request={date:plan?.date??'2026-10-14',fireAt:plan?.fireAt??'2026-10-14T01:02:00Z',localDate:plan?.alarmDate??'2026-10-14',localTime:plan?.alarmTime??'09:02',course:plan?.course??'测试',test,skipUiRequested:true};
          window.__clockSends++;window.__mockClockAlarms.push(request);
          if(!test){window.__clockLast=request;localStorage.setItem('mock-clock-receipt',JSON.stringify(request));}
          data={mode:'clock-request',scheduled:0,opened:true,confirmed:false,lastClockRequest:request,message:'已发送免确认时钟请求，支持的时钟直接处理。'};
        }
      }
      queueMicrotask(()=>window.chenkeNativeResult({id:m.id,data}));
    }};
  },{state,unsupported});
  await page.goto('/');await page.getByRole('button',{name:'闹钟',exact:true}).click();
}

test('Android 前台自动请求明日一次性时钟，不再要求点交接或保存',async({page})=>{
  await clockPhone(page);
  await expect(page.locator('#android-alarm-mode')).toHaveValue('clock');
  await expect(page.getByRole('switch',{name:/自动安排明天/})).toBeChecked();
  await expect.poll(()=>page.evaluate(()=>window.__clockSends)).toBe(1);
  expect(await page.evaluate(()=>window.__clockCalls.find(m=>m.action==='openClockAlarm').payload)).toMatchObject({automatic:true,plan:{date:'2026-10-15',alarmTime:'07:00'}});
  await expect(page.locator('.native-status')).toContainText('免确认');await expect(page.locator('.native-status')).not.toContainText('已调度');
  await page.getByRole('button',{name:'课表',exact:true}).click();await expect(page.locator('.wake-status')).toContainText('已发送免确认');
  await page.evaluate(()=>window.chenkeNativeResume());await page.clock.runFor(200);
  expect(await page.evaluate(()=>window.__clockSends)).toBe(1);
  await page.reload();await expect.poll(()=>page.evaluate(()=>window.__clockCalls.some(m=>m.action==='loadState'))).toBe(true);
  expect(await page.evaluate(()=>window.__clockSends)).toBe(0);
});

test('手动删掉时钟后不补回同一条，用户可主动重新发送',async({page})=>{
  await clockPhone(page);await expect.poll(()=>page.evaluate(()=>window.__clockSends)).toBe(1);
  await page.getByRole('button',{name:'查看或删除闹钟'}).click();await page.evaluate(()=>{window.__mockClockAlarms=[];window.chenkeNativeResume();});await page.clock.runFor(200);
  expect(await page.evaluate(()=>window.__clockSends)).toBe(1);
  await page.getByRole('button',{name:'重新发送',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__clockSends)).toBe(2);
  expect(await page.evaluate(()=>window.__clockCalls.filter(m=>m.action==='openClockAlarm').at(-1).payload.force)).toBe(true);
});

test('提前量改变不留下两个自动闹钟，提示处理旧时钟记录',async({page})=>{
  await clockPhone(page);await expect.poll(()=>page.evaluate(()=>window.__clockSends)).toBe(1);
  await page.locator('#lead-input').fill('60');await page.locator('#lead-input').press('Tab');
  await expect(page.locator('.clock-next')).toContainText('07:30');
  await expect(page.locator('.clock-last')).toContainText('先删除');
  expect(await page.evaluate(()=>window.__clockSends)).toBe(1);
  await page.getByRole('button',{name:'重新发送',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__clockSends)).toBe(2);
  await page.locator('#android-alarm-mode').selectOption('app');
  await expect.poll(()=>page.evaluate(()=>window.__clockCalls.filter(m=>m.action==='syncAlarms').at(-1)?.payload.mode)).toBe('app');
});

test('时钟接口不存在时不自动调用，测试失败显示真实错误',async({page})=>{
  await page.setViewportSize({width:390,height:844});await clockPhone(page,{unsupported:true});
  await expect(page.locator('.clock-handoff')).toContainText('没有提供系统时钟接口');
  expect(await page.evaluate(()=>window.__clockCalls.some(m=>m.action==='openClockAlarm'))).toBe(false);
  await page.getByRole('button',{name:'测试时钟（1–2 分钟）'}).click();await expect(page.locator('.clock-feedback[role=alert]')).toContainText('没有提供创建时钟');
  expect(await page.evaluate(()=>window.__clockCalls.some(m=>['requestPermissions','testAlarm'].includes(m.action)))).toBe(false);
});

test('凌晨或仅有后天课不误发成今天或明天，空课表仍可测试时钟',async({browser})=>{
  for(const options of [{time:'2026-10-14T05:00:00+08:00'},{day:5},{empty:true}]){
    const page=await browser.newPage();await clockPhone(page,options);
    await expect(page.getByRole('button',{name:'重新发送',exact:true})).toBeDisabled();
    expect(await page.evaluate(()=>window.__clockCalls.some(m=>m.action==='openClockAlarm'))).toBe(false);
    await expect(page.getByRole('button',{name:'测试时钟（1–2 分钟）'})).toBeEnabled();await page.close();
  }
});

test('明天暂停只阻止自动发送，不删除课程并说明外部时钟需管理',async({page})=>{
  await clockPhone(page);await page.getByRole('button',{name:'明天暂停自动发送'}).click();
  await expect(page.locator('.clock-next')).toContainText('暂停');
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('chenke.state.v1')));
  expect(state.courses).toHaveLength(1);expect(state.settings.alarmSkippedDates).toEqual(['2026-10-15']);
  await expect(page.locator('#toast')).toContainText('已发送的闹钟请在系统时钟中管理');
});

test('关闭、暂停、切换或清空后持续提供已有时钟闹钟的管理入口',async({browser})=>{
  mkdirSync('.impeccable/review',{recursive:true});
  for(const action of ['off','pause','switch','clear']){
    const page=await browser.newPage({viewport:{width:390,height:844}});await clockPhone(page);
    await expect.poll(()=>page.evaluate(()=>window.__clockSends)).toBe(1);
    if(action==='off')await page.getByRole('switch').uncheck();
    if(action==='pause')await page.getByRole('button',{name:'明天暂停自动发送'}).click();
    if(action==='switch')await page.locator('#android-alarm-mode').selectOption('app');
    if(action==='clear'){
      await page.getByRole('button',{name:'设置',exact:true}).click();
      await page.getByRole('tab',{name:'数据备份',exact:true}).click();
      page.once('dialog',async dialog=>{expect(dialog.message()).toContain('已经交给系统时钟的闹钟须到时钟中删除');await dialog.accept();});
      await page.getByRole('button',{name:'清空课表',exact:true}).click();
    }
    await page.getByRole('button',{name:'课表',exact:true}).click();
    const notice=page.getByRole('complementary',{name:'系统时钟旧闹钟'});
    await expect(notice).toContainText('2026-10-15 07:00');await expect(notice).toContainText('可能仍会响');
    if(action==='off')await expect(page.locator('.wake-status')).toHaveText('自动安排未开启');
    if(action==='pause')await expect(page.locator('.wake-status')).toHaveText('明天已暂停自动发送');
    await page.reload();await expect(notice).toBeVisible();
    await page.getByRole('button',{name:'去系统时钟管理',exact:true}).click();
    expect(await page.evaluate(()=>window.__clockCalls.some(m=>m.action==='showClockAlarms'))).toBe(true);
    await page.screenshot({path:`.impeccable/review/clock-notice-${action}.png`,fullPage:true});await page.close();
  }
});

test('首页依次说明无课、待确认、暂停、过期和日期尚不安全的状态',async({browser})=>{
  mkdirSync('.impeccable/review',{recursive:true});
  for(const [name,options,text] of [['rest',{day:5},'明天上午无课，不发送'],['review',{confirmed:false},'晨课待确认，暂不发送'],['paused',{paused:true},'明天已暂停自动发送'],['expired',{lead:1440},'起床时间已过或太接近，暂不发送'],['deferred',{time:'2026-10-14T05:00:00+08:00'},'等今天该钟点过后再发送']]){
    const page=await browser.newPage({viewport:{width:390,height:844}});await clockPhone(page,options);await page.getByRole('button',{name:'课表',exact:true}).click();
    await expect(page.locator('.wake-status')).toHaveText(text);expect(await page.evaluate(()=>window.__clockSends)).toBe(0);
    await page.screenshot({path:`.impeccable/review/clock-state-${name}.png`,fullPage:true});await page.close();
  }
});

test('手机提前量输入和分钟单位保持水平且不挤出视口',async({browser})=>{
  for(const width of [320,390,500]){
    const page=await browser.newPage({viewport:{width,height:844}});await clockPhone(page);
    await page.locator('#lead-input').fill('500');await page.locator('#lead-input').press('Tab');
    const sizes=await page.locator('.lead-exact').evaluate(el=>{
      const input=el.querySelector('input').getBoundingClientRect(),unit=el.querySelector('span').getBoundingClientRect();
      const range=document.createRange();range.selectNode(el.firstChild);const label=range.getBoundingClientRect();
      return {input:{left:input.left,right:input.right,width:input.width},unit:{left:unit.left,right:unit.right,height:unit.height},label:{right:label.right,height:label.height},viewport:innerWidth};
    });
    expect(sizes.input.width).toBeLessThanOrEqual(100);expect(sizes.label.height).toBeLessThan(30);expect(sizes.unit.height).toBeLessThan(30);
    expect(sizes.label.right).toBeLessThanOrEqual(sizes.input.left);expect(sizes.unit.left).toBeGreaterThanOrEqual(sizes.input.right);expect(sizes.unit.right).toBeLessThan(sizes.viewport);
    await page.close();
  }
});

test('界面证据：自动明日时钟的桌面、手机、变更及不支持状态',async({browser})=>{
  mkdirSync('.impeccable/review',{recursive:true});
  for(const [name,width,height] of [['desktop',1280,1100],['phone',390,844],['user-500',500,900]]){
    const page=await browser.newPage({viewport:{width,height}});await clockPhone(page);await expect.poll(()=>page.evaluate(()=>window.__clockSends)).toBe(1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`.impeccable/review/clock-${name}.png`,fullPage:true});
    if(name==='phone'){await page.getByRole('button',{name:'课表',exact:true}).click();await page.screenshot({path:'.impeccable/review/clock-phone-home.png',fullPage:true});}
    await page.close();
  }
  const page=await browser.newPage({viewport:{width:390,height:844}});await clockPhone(page,{unsupported:true});await page.screenshot({path:'.impeccable/review/clock-phone-error.png',fullPage:true});await page.close();
});
