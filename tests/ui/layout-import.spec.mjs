import {test,expect} from '@playwright/test';
import path from 'node:path';

const savedCourses=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('chenke.state.v1')).courses);
const weeks=(start,end,step=1)=>Array.from({length:Math.floor((end-start)/step)+1},(_,i)=>start+i*step);

test('匿名跨页文字 PDF：合并格、换行标题、单双周及页尾排除',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await page.getByRole('button',{name:'导入我的课表'}).click();
  await page.locator('#file-input').setInputFiles(path.resolve('tests/fixtures/layout-multipage-demo.pdf'));
  await expect(page.locator('.review-row')).toHaveCount(6);
  await expect(page.locator('.review-section')).toContainText('没有几点上课');
  await expect(page.locator('.review-section')).toContainText('未安排具体星期或时间');
  await expect(page.locator('.review-list')).toContainText('地点：G-305');
  await expect(page.locator('.review-list')).toContainText('地点：H-306');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'加入课表，继续确认'}).click();
  const courses=await savedCourses(page);
  expect(courses.map(c=>[c.name,c.day,c.periodRange,c.weeks,c.location])).toEqual([
    ['下午演示课',1,{start:5,end:6},weeks(1,16),'F-204'],
    ['跨页晚课',1,{start:9,end:10},weeks(3,18),'G-305'],
    ['演示课程甲',2,{start:1,end:2},weeks(3,18),'C-201'],
    ['演示课程乙',2,{start:3,end:4},weeks(13,16),'D-302'],
    ['跨行课程名称后半段',3,{start:3,end:4},weeks(2,16,2),'E-203'],
    ['跨页实验课',3,{start:9,end:11},weeks(2,16,2),'H-306']
  ]);
  expect(courses.every(c=>c.confirmed===false)).toBe(true);expect(errors).toEqual([]);
});

test('匿名侧转轮廓 PDF：自动转正、逐格 OCR、原表时刻及跨页课程',async({page})=>{
  test.setTimeout(180000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.getByRole('button',{name:'导入我的课表'}).click();
  await page.locator('#file-input').setInputFiles(path.resolve('tests/fixtures/rotated-outline-demo.pdf'));
  await expect(page.getByRole('heading',{name:/识别结果/})).toBeVisible({timeout:160000});
  await expect(page.locator('.review-row')).toHaveCount(3);
  await expect(page.locator('.review-section')).toContainText('原课表的时间列');
  await page.getByRole('button',{name:'加入课表，继续确认'}).click();
  const courses=await savedCourses(page);
  expect(courses.map(c=>[c.name,c.day,c.start,c.end,c.weeks,c.location])).toEqual([
    ['组合演示课',1,'08:30','10:05',[2,3,4,...weeks(6,13)],'A-101'],
    ['跨页演示课',2,'14:50','15:35',weeks(2,12),'C-303'],
    ['另一演示课',3,'10:25','11:10',weeks(3,15,2),'B-202']
  ]);
  expect(courses.every(c=>c.confirmed===false&&c.timeSource==='document'&&!c.periodRange)).toBe(true);
  expect(errors).toEqual([]);
});
