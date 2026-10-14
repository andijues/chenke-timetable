import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

async function expectNoPageOverflow(page){
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}
async function expectTouchSize(locator){
  for(const element of await locator.all()){
    const box=await element.boundingBox();
    if(box){expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);}
  }
}
for(const [name,width,height] of [['small-phone',320,740],['phone',390,844],['landscape-phone',844,390]]){
  test(`${name}：课程编辑、系统计划、导入校对及设置可触摸操作`,async({browser})=>{
    const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true});
    const page=await context.newPage();await page.clock.install({time:new Date('2026-10-14T01:10:00Z')});
    await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:'手动添加课程',exact:true}).tap();
    const dialog=page.locator('#course-dialog');
    await expectTouchSize(dialog.locator('.icon-button,.color-picker label,.confirm-check'));
    const fonts=await dialog.locator('input:not([type=radio]):not([type=checkbox]),select').evaluateAll(es=>es.map(e=>parseFloat(getComputedStyle(e).fontSize)));
    expect(fonts.every(n=>n>=16)).toBe(true);
    expect(await dialog.evaluate(d=>d.scrollWidth<=d.clientWidth)).toBe(true);
    await dialog.locator('[name=name]').fill('现代计算机体系结构与高性能并行算法研究专题');
    await dialog.locator('[name=location]').fill('ComputerScienceBuildingRoomWithAnUnusuallyLongName502');
    await dialog.locator('[name=day]').selectOption('4');await dialog.locator('[name=start]').fill('08:30');await dialog.locator('[name=end]').fill('10:10');
    await dialog.locator('[name=confirmed]').check();
    mkdirSync('.impeccable/review',{recursive:true});await page.screenshot({path:`.impeccable/review/${name}-editor.png`});
    await page.getByRole('button',{name:'保存课程',exact:true}).tap();await expect(dialog).not.toBeVisible();
    await expectNoPageOverflow(page);await expect(page.locator('.time-pointer')).toBeVisible();
    await expectTouchSize(page.locator('.week-navigation button,.schedule-foot button,.bottom-nav button'));
    const nav=await page.locator('.bottom-nav').boundingBox();expect(nav.y+nav.height).toBeCloseTo(height,0);
    await page.screenshot({path:`.impeccable/review/${name}-home.png`,fullPage:true});
    await page.getByRole('button',{name:'闹钟',exact:true}).tap();await expect(page.locator('.alarm-day').nth(1)).toContainText('07:00');
    await expect(page.locator('.native-status')).toContainText('网页');await expect(page.locator('#lead-input')).toHaveAttribute('inputmode','numeric');
    await expectTouchSize(page.locator('#alarm-enabled,#lead-slider'));await expectNoPageOverflow(page);
    await page.screenshot({path:`.impeccable/review/${name}-alarms.png`,fullPage:true});
    await page.getByRole('button',{name:'导入',exact:true}).tap();
    await page.locator('#paste-text').fill('高性能计算与智能信息处理综合研究课程\n周四 08:30-10:10\n1-16周\n计算机楼 502');
    await page.getByRole('button',{name:'识别文字',exact:true}).tap();await expect(page.locator('.review-row')).toHaveCount(1);
    await expect(page.locator('.review-row')).toContainText('周四');await expect(page.locator('.review-row')).not.toContainText('未找到');
    await expectTouchSize(page.locator('.review-row button'));await expectNoPageOverflow(page);
    await page.screenshot({path:`.impeccable/review/${name}-review.png`,fullPage:true});
    await page.getByRole('button',{name:'设置',exact:true}).tap();await expectNoPageOverflow(page);
    expect(await page.locator('main input:not([type=file]),main select').evaluateAll(es=>es.every(e=>parseFloat(getComputedStyle(e).fontSize)>=16))).toBe(true);
    await page.screenshot({path:`.impeccable/review/${name}-settings.png`,fullPage:true});await context.close();
  });
}

test('短视口中课程表单可滚动保存，关闭后恢复导航',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:330},hasTouch:true,isMobile:true});
  const page=await context.newPage();await page.goto('http://127.0.0.1:5173');
  await page.getByRole('button',{name:'手动添加课程',exact:true}).tap();
  const dialog=page.locator('#course-dialog');const box=await dialog.boundingBox();expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(330);
  await dialog.locator('[name=name]').fill('短视口课程');await dialog.locator('[name=location]').fill('信息楼 502');
  await dialog.locator('[name=confirmed]').check();await page.getByRole('button',{name:'保存课程',exact:true}).tap();
  await expect(dialog).not.toBeVisible();await expect(page.locator('.bottom-nav')).toBeVisible();await context.close();
});
