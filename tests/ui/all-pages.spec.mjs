import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {createState} from '../../src/core.mjs';

async function prepare(page){
  await page.clock.install({time:new Date('2026-10-14T09:10:00+08:00')});
  const state=createState('2026-09-07');state.settings.enabled=true;
  state.courses=[
    {id:'today-a',name:'概率论与数理统计',location:'理学楼 A305',day:3,start:'08:30',end:'10:10',weeks:[6],confirmed:true,color:'mint'},
    {id:'today-b',name:'科学研究方法',location:'图书馆 研讨室',day:3,start:'14:00',end:'15:40',weeks:[6],confirmed:true,color:'lavender'},
    {id:'tomorrow',name:'现代计算机体系结构与高性能并行算法研究专题',location:'信息楼 502',day:4,start:'08:30',end:'10:10',weeks:[6],confirmed:true,color:'sky'}
  ];
  await page.addInitScript(state=>{
    window.__wholeCalls=[];let last=null;
    window.AndroidBridge={postMessage(raw){
      const m=JSON.parse(raw);window.__wholeCalls.push(m);let data={};
      if(m.action==='loadState')data={state};
      if(m.action==='capabilities')data={platform:'android',supported:true,clockAvailable:true,lastClockRequest:last};
      if(m.action==='syncAlarms')data={mode:'clock-preview',scheduled:0,message:'已计算明日起床计划',lastClockRequest:last};
      if(m.action==='openClockAlarm'){
        last={...m.payload.plan,localTime:m.payload.plan.alarmTime,localDate:m.payload.plan.alarmDate,skipUiRequested:true,test:false};
        data={mode:'clock-request',scheduled:0,confirmed:false,lastClockRequest:last,message:'已发送免确认时钟请求，请在系统时钟查看或删除。'};
      }
      queueMicrotask(()=>window.chenkeNativeResult({id:m.id,data}));
    }};
  },state);
  await page.goto('/');await expect.poll(()=>page.evaluate(()=>window.__wholeCalls.some(c=>c.action==='openClockAlarm'))).toBe(true);
}

test('设置分类支持键盘、保留未保存输入且一次只显示一个面板',async({page})=>{
  await prepare(page);await page.getByRole('button',{name:'设置',exact:true}).click();
  await page.locator('#settings-form [name=totalWeeks]').fill('22');
  const semester=page.getByRole('tab',{name:'学期设置'});await semester.focus();await semester.press('ArrowRight');
  await expect(page.getByRole('tab',{name:'节次时间'})).toBeFocused();await expect(page.locator('#periods-form')).toBeVisible();
  await page.getByRole('tab',{name:'节次时间'}).press('ArrowLeft');await expect(page.locator('#settings-form [name=totalWeeks]')).toHaveValue('22');
  await semester.press('End');await expect(page.getByRole('button',{name:'导出课表备份'})).toBeVisible();
  await expect(page.locator('.settings-pane:visible')).toHaveCount(1);
  await page.getByRole('tab',{name:'数据备份'}).press('Home');await expect(semester).toBeFocused();
});

test('小屏校对课程保留足够文字宽度，操作触点独立且能进入编辑',async({browser})=>{
  for(const width of [320,390,500]){
    const page=await browser.newPage({viewport:{width,height:844}});await prepare(page);await page.getByRole('button',{name:'导入',exact:true}).click();
    await page.locator('#paste-text').fill('现代计算机体系结构与高性能并行算法研究专题\n周四 08:30-10:10\n1-16周\n信息楼 502');
    await page.getByRole('button',{name:'识别文字',exact:true}).click();await expect(page.locator('.review-row')).toHaveCount(1);
    const body=await page.locator('.review-content').boundingBox();expect(body.width).toBeGreaterThanOrEqual(200);
    for(const button of await page.locator('.review-row-actions button').all()){const b=await button.boundingBox();expect(b.width).toBeGreaterThanOrEqual(44);expect(b.height).toBeGreaterThanOrEqual(44);}
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('button',{name:'校对',exact:true}).click();await expect(page.locator('#course-dialog')).toBeVisible();
    await expect(page.locator('#course-form [name=location]')).toHaveValue('信息楼 502');await page.close();
  }
});

test('界面证据：导入、校对、闹钟、五类设置与编辑器的完整响应式矩阵',async({browser})=>{
  mkdirSync('.impeccable/review',{recursive:true});
  for(const [device,width,height,colorScheme] of [['desktop',1280,1000,'light'],['phone',390,844,'light'],['small',320,740,'light'],['user-500',500,900,'light'],['dark',390,844,'dark']]){
    const page=await browser.newPage({viewport:{width,height},colorScheme});await prepare(page);
    const capture=async name=>{
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`.impeccable/review/surfaces-${device}-${name}.png`,fullPage:name!=='editor'});
    };
    await page.getByRole('button',{name:'导入',exact:true}).click();
    if(['desktop','phone','dark'].includes(device))await capture('import');
    await page.locator('#paste-text').fill('现代计算机体系结构与高性能并行算法研究专题\n周四 08:30-10:10\n1-16周\n信息楼 502');
    await page.getByRole('button',{name:'识别文字',exact:true}).click();await expect(page.locator('.review-row')).toBeVisible();
    if(device!=='user-500')await capture('review');
    await page.getByRole('button',{name:'闹钟',exact:true}).click();await expect(page.locator('.clock-next')).toContainText('07:00');await capture('alarms');
    await page.getByRole('button',{name:'设置',exact:true}).click();await capture('semester');
    await page.getByRole('tab',{name:'节次时间'}).click();await page.locator('#period-count').fill('4');await page.locator('#period-count').press('Tab');await capture('periods');
    if(['desktop','phone'].includes(device)){
      await page.locator('.period-precise summary').click();await capture('precise');
      await page.getByRole('tab',{name:'课程管理'}).click();await capture('courses');
      await page.getByRole('tab',{name:'例外日期'}).click();await capture('exceptions');
      await page.getByRole('tab',{name:'数据备份'}).click();await capture('data');
    }
    await page.getByRole('tab',{name:'课程管理'}).click();await page.getByRole('button',{name:'添加课程',exact:true}).click();
    await page.locator('#course-form [name=name]').fill('跨学科研究方法与实验设计');await page.locator('#course-form [name=location]').fill('信息楼 502');
    if(device!=='user-500')await capture('editor');await page.close();
  }
});
