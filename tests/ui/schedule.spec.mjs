import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

for(const [device,width,height] of [['desktop',1280,1000],['phone',390,844],['user-500',500,900]]){
  test(`${device}：可视化节次、学期首日、单双周手动排课与联动更新`,async({browser})=>{
    const context=await browser.newContext({viewport:{width,height},hasTouch:device==='phone',isMobile:device==='phone'});
    const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.clock.install({time:new Date('2026-10-06T01:10:00Z')});await page.goto('http://127.0.0.1:5173');
    await page.getByRole('button',{name:'设置',exact:true}).click();
    await page.locator('#settings-form [name=week1]').fill('2026-09-09');await page.locator('#settings-form [name=totalWeeks]').fill('8');
    await expect(page.locator('#semester-preview')).toContainText('2026-09-07 至 2026-09-13');await page.getByRole('button',{name:'保存学期设置',exact:true}).click();
    await page.locator('#period-count').fill('6');await page.locator('#period-count').press('Tab');await expect(page.locator('.period-row')).toHaveCount(6);await page.getByRole('button',{name:'保存节次时间',exact:true}).click();
    await page.locator('#period-scope').selectOption('3');await page.locator('#period-count').fill('2');await page.locator('#period-count').press('Tab');
    for(const [name,value] of [['p0s','09:00'],['p0e','09:45'],['p1s','09:55'],['p1e','10:40']])await page.locator(`#periods-form [name=${name}]`).fill(value);
    await page.getByRole('button',{name:'可视化调整第 1 节',exact:true}).click();const slider=page.getByRole('slider',{name:'拖动第 1 节开始时间',exact:true});await expect(slider).toBeVisible();
    await slider.press('ArrowRight');await expect(page.locator('#periods-form [name=p0s]')).toHaveValue('09:05');await slider.press('ArrowLeft');await expect(page.locator('#periods-form [name=p0s]')).toHaveValue('09:00');
    await page.getByRole('button',{name:'保存节次时间',exact:true}).click();await expect(page.locator('#period-scope')).toHaveValue('3');
    mkdirSync('.impeccable/review',{recursive:true});await page.screenshot({path:`.impeccable/review/schedule-${device}-settings.png`,fullPage:true});
    await page.getByRole('button',{name:'添加课程',exact:true}).click();const form=page.locator('#course-form');
    await form.locator('[name=name]').fill('计算方法与数值分析');await form.locator('[name=location]').fill('理学楼 A302');await form.locator('[name=day]').selectOption('3');
    await page.getByRole('button',{name:'按节次选择',exact:true}).click();await form.locator('[name=periodEnd]').selectOption('2');await expect(form.locator('[name=start]')).toHaveValue('09:00');
    await page.locator('#week-start').fill('3');await page.locator('#week-end').fill('8');await page.getByRole('button',{name:'单周',exact:true}).click();
    await expect(page.locator('#week-summary')).toContainText('3,5,7周');await expect(page.locator('[data-week][aria-pressed=true]')).toHaveCount(3);
    await page.screenshot({path:`.impeccable/review/schedule-${device}-course.png`});await page.getByRole('button',{name:'保存课程',exact:true}).click();
    await expect(page.locator('#course-dialog')).not.toBeVisible();await page.getByRole('button',{name:'课表',exact:true}).click();await expect(page.locator('.wake-time')).toContainText('07:30');
    await page.getByRole('button',{name:'周课表',exact:true}).click();await page.locator('#view-week').selectOption('4');await expect(page.locator('.course-block')).toHaveCount(0);await page.locator('#view-week').selectOption('5');await expect(page.locator('.course-block')).toHaveCount(1);
    await page.getByRole('button',{name:'设置',exact:true}).click();
    for(const [name,value] of [['p0s','09:30'],['p0e','10:15'],['p1s','10:25'],['p1e','11:10']])await page.locator(`#periods-form [name=${name}]`).fill(value);
    await page.getByRole('button',{name:'保存节次时间',exact:true}).click();await page.getByRole('button',{name:'课表',exact:true}).click();
    await expect(page.locator('.wake-time')).toContainText('08:00');await expect(page.locator('.course-block')).toContainText('09:30–11:10');
    await page.screenshot({path:`.impeccable/review/schedule-${device}-home.png`,fullPage:true});
    await page.getByRole('button',{name:'设置',exact:true}).click();await page.locator('#period-count').fill('1');await page.locator('#period-count').press('Tab');await page.getByRole('button',{name:'保存节次时间',exact:true}).click();await expect(page.locator('#period-error')).toContainText('第 2 节');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);await context.close();
  });
}
