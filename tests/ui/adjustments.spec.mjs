import {test,expect} from '@playwright/test';
import {createState,applyCourseAdjustment} from '../../src/core.mjs';

function fixture(){
  const state=createState('2026-10-12');state.settings.enabled=true;
  state.courses=[
    {id:'early',name:'课程甲',day:4,start:'08:30',end:'10:10',weeks:[1,2,3,4],confirmed:true,location:'教学楼 101',color:'mint'},
    {id:'later',name:'课程乙',day:4,start:'10:30',end:'12:00',weeks:[1,2,3,4],confirmed:true,color:'sky'},
    {id:'friday',name:'课程丙',day:5,start:'14:00',end:'15:40',weeks:[1,2,3,4],confirmed:true,color:'peach'}
  ];return state;
}
async function open(page,state=fixture(),nativeMode=null){
  await page.clock.install({time:new Date('2026-10-14T09:00:00+08:00')});
  await page.addInitScript(({state,nativeMode})=>{
    if(!localStorage.getItem('chenke.state.v1'))localStorage.setItem('chenke.state.v1',JSON.stringify(state));
    window.__adjustmentCalls=[];
    if(nativeMode){
      window.AndroidBridge={postMessage(raw){
        const m=JSON.parse(raw);window.__adjustmentCalls.push(m);let data={};
        if(m.action==='loadState')data={state:JSON.parse(localStorage.getItem('chenke.state.v1'))};
        if(m.action==='capabilities')data={platform:'android',clockAvailable:true,lastClockRequest:window.__receipt};
        if(m.action==='syncAlarms')data={mode:m.payload.mode==='app'?'alarm':'clock-preview',scheduled:m.payload.mode==='app'?m.payload.plans.length:0};
        if(m.action==='openClockAlarm'){
          const plan=m.payload.plan;
          if(window.__receipt&&window.__receipt.fireAt!==plan.fireAt&&!m.payload.force)data={mode:'clock-changed',scheduled:0,lastClockRequest:window.__receipt,message:'起床计划已变更，请先删除旧闹钟再重新发送。'};
          else{window.__receipt={date:plan.date,fireAt:plan.fireAt,localDate:plan.alarmDate,localTime:plan.alarmTime,course:plan.course,skipUiRequested:true};data={mode:'clock-request',scheduled:0,lastClockRequest:window.__receipt};}
        }
        queueMicrotask(()=>window.chenkeNativeResult({id:m.id,data}));
      }};
    }
  },{state,nativeMode});
  await page.goto('/');await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('tab',{name:'例外日期'}).click();
}
const form=page=>page.locator('#course-adjustment-form');
const data=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('chenke.state.v1')));
async function choose(page,id='early'){
  await form(page).locator('[name=date]').fill('2026-10-15');await form(page).locator('[name=date]').press('Tab');
  await form(page).locator('[name=courseId]').selectOption(id);
}
async function move(page,{date='2026-10-16',start='09:00',end='10:00',location='实验楼 202'}={}){
  await form(page).locator('[name=targetDate]').fill(date);
  await form(page).locator('[name=start]').fill(start);await form(page).locator('[name=end]').fill(end);
  await form(page).locator('[name=location]').fill(location);
}

test('单次停课只影响所选课程，保留其他课与后续周次，并可撤销',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);await choose(page);
  await form(page).locator('[name=type]').selectOption('cancelCourse');
  await expect(form(page).locator('.adjustment-target')).toBeHidden();await expect(form(page).locator('[name=targetDate]')).toBeDisabled();
  await expect(page.locator('#course-adjustment-preview')).toContainText('07:00');await expect(page.locator('#course-adjustment-preview')).toContainText('09:00');
  await page.getByRole('button',{name:'保存单次调整'}).click();expect((await data(page)).exceptions).toMatchObject([{type:'cancelCourse',date:'2026-10-15',courseId:'early'}]);
  await page.getByRole('button',{name:'课表',exact:true}).click();await page.getByRole('button',{name:'10月15日 周四'}).click();
  await expect(page.locator('.daily-list')).toContainText('课程乙');await expect(page.locator('.daily-list')).not.toContainText('课程甲');await expect(page.locator('.wake-time')).toContainText('09:00');
  await page.getByRole('button',{name:'设置',exact:true}).click();await choose(page);
  await form(page).locator('[name=date]').fill('2026-10-22');await form(page).locator('[name=date]').press('Tab');
  await expect(form(page).locator('[name=courseId]')).toContainText('课程甲');
  await page.getByRole('button',{name:'撤销 课程甲 2026-10-15 调整'}).click();expect((await data(page)).exceptions).toHaveLength(0);expect((await data(page)).courses).toHaveLength(3);expect(errors).toEqual([]);
});

test('课程可跨日期改时间地点，主页调入课程能继续修改，刷新与撤销保持一致',async({page})=>{
  await page.setViewportSize({width:390,height:844});await open(page);await choose(page);await move(page);
  await expect(page.locator('#course-adjustment-preview')).toContainText('07:30');
  await page.getByRole('button',{name:'保存单次调整'}).click();await expect(page.locator('.adjustment-record')).toContainText('2026-10-16 09:00–10:00');
  await page.getByRole('button',{name:'课表',exact:true}).click();await page.getByRole('button',{name:'10月16日 周五'}).click();
  await expect(page.locator('.daily-list')).toContainText('实验楼 202');await expect(page.locator('.daily-list')).toContainText('调入');
  await page.locator('.daily-course[data-adjustment]').click();await expect(form(page).locator('[name=targetDate]')).toHaveValue('2026-10-16');await expect(form(page).locator('[name=location]')).toHaveValue('实验楼 202');
  await move(page,{start:'10:00',end:'11:00'});await page.getByRole('button',{name:'保存单次调整'}).click();expect((await data(page)).exceptions).toHaveLength(1);
  await page.reload();await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('tab',{name:'例外日期'}).click();
  await expect(page.locator('.adjustment-record')).toContainText('10:00–11:00');await page.getByRole('button',{name:'撤销 课程甲 2026-10-15 调整'}).click();
  await page.getByRole('button',{name:'课表',exact:true}).click();await page.getByRole('button',{name:'10月16日 周五'}).click();await expect(page.locator('.daily-list')).not.toContainText('课程甲');
  await page.getByRole('button',{name:'10月15日 周四'}).click();await expect(page.locator('.daily-list')).toContainText('课程甲');
});

test('单门调整与整天安排共存，切换单位保留输入，重叠时明确提醒',async({page})=>{
  await open(page);await choose(page);await move(page,{date:'2026-10-15',start:'10:45',end:'11:30'});
  await expect(page.locator('.adjustment-warning')).toContainText('课程乙');await page.getByRole('button',{name:'按整天',exact:true}).click();await page.getByRole('button',{name:'按课程',exact:true}).click();
  await expect(form(page).locator('[name=start]')).toHaveValue('10:45');await page.getByRole('button',{name:'保存单次调整'}).click();
  await choose(page,'later');await form(page).locator('[name=type]').selectOption('cancelCourse');await page.getByRole('button',{name:'保存单次调整'}).click();
  await page.getByRole('button',{name:'按整天',exact:true}).click();const whole=page.locator('#exception-form');
  await whole.locator('[name=date]').fill('2026-10-15');await whole.locator('[name=note]').fill('临时放假');await page.getByRole('button',{name:'添加例外日期'}).click();expect((await data(page)).exceptions).toHaveLength(3);
  await whole.locator('[name=type]').selectOption('replaceDay');await expect(whole.locator('[name=day]')).toBeVisible();await whole.locator('[name=day]').selectOption('4');await page.getByRole('button',{name:'添加例外日期'}).click();
  const s=await data(page);expect(s.exceptions).toHaveLength(3);expect(s.exceptions.filter(e=>['moveCourse','cancelCourse'].includes(e.type))).toHaveLength(2);
  await page.getByRole('button',{name:'课表',exact:true}).click();await page.getByRole('button',{name:'10月15日 周四'}).click();await expect(page.locator('.daily-list')).toContainText('10:45');await expect(page.locator('.daily-list')).not.toContainText('课程乙');
});

test('无课程、无效时间及目标放假有可恢复反馈，失败不覆盖记录',async({page})=>{
  const state=fixture();state.exceptions=[{date:'2026-10-16',type:'skip'}];await open(page,state);
  await expect(page.getByRole('button',{name:'保存单次调整'})).toBeDisabled();await choose(page);await move(page,{start:'11:00',end:'10:00'});
  await page.getByRole('button',{name:'保存单次调整'}).click();await expect(page.locator('#adjustment-error')).toContainText('目标日期已设整天停课');expect((await data(page)).exceptions).toHaveLength(1);
  await form(page).locator('[name=targetDate]').fill('2026-10-17');await page.getByRole('button',{name:'保存单次调整'}).click();await expect(page.locator('#adjustment-error')).toContainText('结束时间应晚于');
  await expect(form(page).locator('[name=location]')).toHaveValue('实验楼 202');await form(page).locator('[name=end]').fill('12:00');await page.getByRole('button',{name:'保存单次调整'}).click();
  expect((await data(page)).exceptions).toHaveLength(2);await expect(page.locator('#adjustment-error')).toBeEmpty();
});

test('调课重新发送后台计划，并保留已发送系统时钟的旧闹钟管理提示',async({browser})=>{
  for(const mode of ['app','clock']){
    const page=await browser.newPage();const state=fixture();state.settings.androidAlarmMode=mode;await open(page,state,mode);
    await expect.poll(()=>page.evaluate(()=>window.__adjustmentCalls.some(m=>m.action==='syncAlarms'))).toBe(true);
    if(mode==='clock')await expect.poll(()=>page.evaluate(()=>Boolean(window.__receipt))).toBe(true);
    await choose(page);await form(page).locator('[name=type]').selectOption('cancelCourse');await page.getByRole('button',{name:'保存单次调整'}).click();
    await expect.poll(()=>page.evaluate(()=>window.__adjustmentCalls.filter(m=>m.action==='syncAlarms').at(-1).payload.plans.find(p=>p.date==='2026-10-15')?.alarmTime)).toBe('09:00');
    if(mode==='clock'){await expect(page.locator('.external-clock-notice')).toContainText('07:00 的闹钟可能仍会响');await expect(page.getByRole('button',{name:'去系统时钟管理'})).toBeVisible();}
    await page.close();
  }
});

test('删除原课程同时清理单次调整，备份可恢复移动后的安排',async({page})=>{
  const state=applyCourseAdjustment(fixture(),{type:'moveCourse',date:'2026-10-15',courseId:'early',targetDate:'2026-10-16',start:'09:00',end:'10:00'});await open(page,state);
  await page.getByRole('tab',{name:'数据备份'}).click();const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:/导出课表备份/}).click();const download=await downloaded;expect(download.suggestedFilename()).toMatch(/\.json$/);
  await page.getByRole('tab',{name:'课程管理'}).click();await page.locator('.managed-course').filter({hasText:'课程甲'}).click();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'删除课程',exact:true}).click();expect((await data(page)).exceptions).toHaveLength(0);
  await page.getByRole('tab',{name:'数据备份'}).click();page.once('dialog',d=>d.accept());await page.locator('#restore-input').setInputFiles({name:'adjusted.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(state))});
  await expect(page.locator('#toast')).toContainText('备份已恢复');await page.getByRole('tab',{name:'例外日期'}).click();await expect(page.locator('.adjustment-record')).toContainText('2026-10-16 09:00–10:00');expect((await data(page)).settings.enabled).toBe(false);
});
