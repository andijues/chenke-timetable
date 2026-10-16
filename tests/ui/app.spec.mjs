import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
test('真实文字 PDF 导入、校正与起床规则',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.getByRole('heading',{name:'把课表放进生活里。'})).toBeVisible();
  await page.getByRole('button',{name:'导入我的课表'}).click();
  await page.locator('#file-input').setInputFiles(path.resolve('tests/fixtures/sample-timetable.pdf'));
  await expect(page.getByRole('heading',{name:/识别结果/})).toBeVisible();
  await expect(page.locator('.review-row')).toHaveCount(4);await expect(page.locator('.review-list')).toContainText('高等数学');
  await page.getByRole('button',{name:'加入课表，继续确认'}).click();await page.getByRole('button',{name:'周课表',exact:true}).click();
  await page.getByRole('button',{name:/编辑 高等数学/}).click();
  await page.locator('[name=confirmed]').check();await page.getByRole('button',{name:'保存课程',exact:true}).click();
  await page.getByRole('button',{name:'闹钟',exact:true}).click();
  await page.locator('#alarm-enabled').check();await expect(page.locator('.native-status')).toContainText('网页');
  await page.locator('#lead-input').fill('60');await page.locator('#lead-input').press('Tab');
  await expect(page.locator('.rule-example')).toContainText('07:30');
  expect(errors).toEqual([]);
});
test('PNG 本机 OCR 后进入可校正列表',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'导入我的课表'}).click();
  await page.locator('#file-input').setInputFiles(path.resolve('tests/fixtures/sample-timetable.png'));
  await expect(page.getByRole('heading',{name:/识别结果/})).toBeVisible({timeout:110000});
  await expect(page.locator('.review-description')).toContainText('图片 OCR');
  await expect(page.locator('.review-list')).toContainText('高等数学');
  await expect(page.locator('.review-row')).toHaveCount(4);
  await expect(page.locator('.review-list')).toContainText('专业实验');
});
test('扫描 PDF 走本机 OCR 并保留待校对状态',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'导入我的课表'}).click();
  await page.locator('#file-input').setInputFiles(path.resolve('tests/fixtures/sample-scanned.pdf'));
  await expect(page.getByRole('heading',{name:/识别结果/})).toBeVisible({timeout:110000});
  await expect(page.locator('.review-description')).toContainText('图片 OCR');await expect(page.locator('.review-list')).toContainText('高等数学');
});
test('录入、备份恢复校验和停课例外',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:/体验演示/}).click();
  await page.getByRole('button',{name:'设置',exact:true}).click();
  await page.locator('#exception-form [name=date]').fill('2026-10-15');await page.locator('#exception-form [name=note]').fill('节假日');await page.getByRole('button',{name:'添加例外日期'}).click();
  await expect(page.locator('.exception-list')).toContainText('2026-10-15');
  await page.locator('#restore-input').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":42}')});
  await expect(page.locator('#toast')).toContainText('恢复失败');
});
test('手动录入早于07点的课程仍可见，首页优先说明明日无课',async({page})=>{
  await page.clock.install({time:new Date('2026-10-14T01:10:00Z')});
  await page.goto('/');await page.getByRole('button',{name:'手动添加课程'}).click();
  await page.locator('[name=name]').fill('清晨实验');await page.locator('[name=start]').fill('05:30');await page.locator('[name=end]').fill('06:30');await page.locator('[name=confirmed]').check();await page.getByRole('button',{name:'保存课程',exact:true}).click();
  await page.getByRole('button',{name:'周课表',exact:true}).click();await expect(page.locator('.course-block')).toContainText('清晨实验');await expect(page.locator('.hours')).toContainText('05:00');await expect(page.locator('.wake-status')).toContainText('明天上午无课，不发送');
  mkdirSync('.impeccable/review',{recursive:true});await page.screenshot({path:'.impeccable/review/early-course-desktop.png',fullPage:true});
});
test('界面证据：桌面、手机、暗色、导入与闹钟页',async({browser})=>{
  mkdirSync('.impeccable/review',{recursive:true});
  for(const [name,width,height,colorScheme] of [['desktop',1280,1040,'light'],['mobile',390,844,'light'],['mobile-dark',390,844,'dark']]){
    const context=await browser.newContext({viewport:{width,height},colorScheme});const page=await context.newPage();
    await page.clock.install({time:new Date('2026-10-14T01:10:00Z')});await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:/体验演示/}).click();
    await page.getByRole('button',{name:'周课表',exact:true}).click();await expect(page.locator('.timetable')).toBeVisible();await expect(page.locator('.time-pointer')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
    await page.screenshot({path:`.impeccable/review/${name}.png`,fullPage:true});
    if(name==='mobile'){await page.getByRole('button',{name:'闹钟',exact:true}).click();await page.screenshot({path:'.impeccable/review/alarms-mobile.png',fullPage:true});await page.getByRole('button',{name:'导入',exact:true}).click();await page.screenshot({path:'.impeccable/review/import-mobile.png',fullPage:true});}
    await context.close();
  }
});
