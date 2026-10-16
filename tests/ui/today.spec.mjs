import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {createState} from '../../src/core.mjs';

test('默认今日、下一节与明日起床；日期切换不改变真实起床日期',async({page})=>{
  await page.clock.install({time:new Date('2026-10-14T01:10:00Z')});await page.goto('/');await page.getByRole('button',{name:/体验演示/}).click();
  await expect(page.locator('.daily-list')).toBeVisible();await expect(page.locator('.next-course')).toContainText('概率论与数理统计');
  await expect(page.locator('.wake-time')).toContainText('09:00');await expect(page.locator('.day-now-pointer')).toContainText('09:10');
  await expect(page.locator('.date-chip.selected')).toHaveAttribute('data-date','2026-10-14');
  await page.locator('.date-chip[data-date="2026-10-15"]').click();await expect(page.locator('.next-heading h2')).toHaveText('当天首课');await expect(page.locator('.wake-time')).toContainText('09:00');
  await page.getByRole('button',{name:'回到今天',exact:true}).click();await expect(page.locator('.next-heading h2')).toHaveText('正在上课');
  await page.getByRole('button',{name:'周课表',exact:true}).click();await expect(page.locator('.timetable')).toBeVisible();await expect(page.locator('.time-pointer')).toBeVisible();
});

test('小手机的长课程名及连续英文教室不撑破今日界面',async({page})=>{
  await page.setViewportSize({width:320,height:740});await page.clock.install({time:new Date('2026-10-14T01:10:00Z')});
  const state=createState('2026-10-14');state.courses=[{id:'long',name:'现代计算机体系结构与高性能并行算法研究专题',location:'ComputerScienceBuildingRoomWithAnUnusuallyLongName502',day:3,start:'08:30',end:'10:10',weeks:[1],confirmed:true,color:'mint'}];
  await page.addInitScript(s=>localStorage.setItem('chenke.state.v1',JSON.stringify(s)),state);await page.goto('/');
  await expect(page.locator('.next-course')).toContainText(state.courses[0].name);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:/编辑 现代计算机/}).click();await expect(page.locator('#course-dialog')).toBeVisible();
});

test('手机日期条显示完整日期，七天都可通过选择到达',async({browser})=>{
  for(const width of [320,390,500]){
    const page=await browser.newPage({viewport:{width,height:844}});await page.clock.install({time:new Date('2026-10-14T01:10:00Z')});await page.goto('/');await page.getByRole('button',{name:/体验演示/}).click();
    const check=async()=>{
      const result=await page.locator('.date-strip').evaluate(el=>{
        const outer=el.getBoundingClientRect();let full=0,partial=0;
        for(const chip of el.children){const r=chip.getBoundingClientRect(),overlap=Math.min(r.right,outer.right)-Math.max(r.left,outer.left);if(overlap>1){if(overlap>=r.width-1)full++;else partial++;}}
        return {full,partial};
      });
      expect(result.partial).toBe(0);expect(result.full).toBe(width<360?3:5);
    };
    await check();await expect(page.locator('.date-strip-hint')).toBeVisible();
    for(const index of [6,0,3]){await page.locator('.date-chip').nth(index).click();await check();await expect(page.locator('.date-chip').nth(index)).toHaveAttribute('aria-pressed','true');}
    await page.close();
  }
});

test('界面证据：今日索引的桌面、手机、深色及空状态',async({browser})=>{
  mkdirSync('.impeccable/review',{recursive:true});
  for(const [name,width,height,colorScheme] of [['desktop',1440,1024,'light'],['phone',390,844,'light'],['small',320,740,'light'],['dark',390,844,'dark']]){
    const page=await browser.newPage({viewport:{width,height},colorScheme});await page.clock.install({time:new Date('2026-10-14T01:10:00Z')});await page.goto('http://127.0.0.1:5173');
    if(name==='phone')await page.screenshot({path:'.impeccable/review/redesign-empty-phone.png',fullPage:true});
    await page.getByRole('button',{name:/体验演示/}).click();await expect(page.locator('.next-lesson')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`.impeccable/review/redesign-today-${name}.png`,fullPage:true});await page.close();
  }
});
