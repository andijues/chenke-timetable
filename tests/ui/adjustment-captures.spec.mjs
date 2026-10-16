import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {makeDemo} from '../../src/core.mjs';

test('界面证据：按课程调休的桌面、手机、小屏、深色与反馈状态',async({browser})=>{
  mkdirSync('.impeccable/review',{recursive:true});
  const captures=[],checks=[];
  for(const [device,width,height,colorScheme] of [['desktop',1280,1040,'light'],['phone',390,844,'light'],['small',320,740,'light'],['user-500',500,900,'light'],['dark',390,844,'dark']]){
    const context=await browser.newContext({viewport:{width,height},colorScheme}),page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const state=makeDemo('2026-10-14'),course=state.courses.find(c=>c.day===4&&c.start==='10:30');
    await page.clock.install({time:new Date('2026-10-14T09:00:00+08:00')});
    await page.addInitScript(state=>localStorage.setItem('chenke.state.v1',JSON.stringify(state)),state);
    await page.goto('/');await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('tab',{name:'例外日期'}).click();
    const form=page.locator('#course-adjustment-form');
    await form.locator('[name=date]').fill('2026-10-15');await form.locator('[name=date]').press('Tab');await form.locator('[name=courseId]').selectOption(course.id);
    await form.locator('[name=targetDate]').fill('2026-10-17');await form.locator('[name=start]').fill('09:00');await form.locator('[name=end]').fill('10:10');await form.locator('[name=location]').fill('图书馆 · 研讨室 302');
    await page.getByRole('button',{name:'保存单次调整'}).click();await expect(page.locator('.adjustment-record')).toContainText('2026-10-17');
    async function capture(name,{fullPage=true}={}){
      await page.clock.runFor(4600);
      const geometry=await page.evaluate(()=>{
        const fields=[...document.querySelectorAll('#settings-pane-exceptions input,#settings-pane-exceptions select,#settings-pane-exceptions button')].filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height);
        return {noOverflow:document.documentElement.scrollWidth<=innerWidth,minimumControlHeight:Math.min(...fields.map(e=>e.getBoundingClientRect().height)),focusVisible:!document.activeElement?.matches('input,select,button')||getComputedStyle(document.activeElement).outlineStyle!=='none'};
      });
      expect(geometry.noOverflow).toBeTruthy();expect(geometry.minimumControlHeight).toBeGreaterThanOrEqual(44);expect(errors).toEqual([]);
      const path=`.impeccable/review/adjustments-${device}-${name}.png`;await page.screenshot({path,fullPage});
      captures.push({device,name,path,width,height,colorScheme,fullPage,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});checks.push({device,name,passed:true,...geometry,noPageErrors:true});
    }
    await windowTop(page);await capture('move');
    if(device==='phone'){await page.locator('#course-adjustment-preview').scrollIntoViewIfNeeded();await capture('preview',{fullPage:false});await windowTop(page);}
    if(device==='phone'){
      await form.locator('[name=type]').selectOption('cancelCourse');await capture('cancel');
      await form.locator('[name=date]').fill('2026-10-18');await form.locator('[name=date]').press('Tab');await expect(form.locator('[name=courseId]')).toContainText('没有原定课程');await capture('empty');
      await page.getByRole('button',{name:'修改 信息检索 2026-10-15 调整'}).click();await form.locator('[name=end]').fill('08:00');await page.getByRole('button',{name:'保存单次调整'}).click();await expect(page.locator('#adjustment-error')).toContainText('结束时间应晚于');await windowTop(page);await capture('error');
      await form.locator('[name=targetDate]').fill('2026-10-16');await form.locator('[name=start]').fill('09:00');await form.locator('[name=end]').fill('10:00');await expect(page.locator('.adjustment-warning')).toContainText('专业实验');await capture('conflict');
      await page.getByRole('button',{name:'按整天',exact:true}).click();await capture('day');
      await page.getByRole('button',{name:'课表',exact:true}).click();await page.getByRole('button',{name:'10月17日 周六'}).click();await expect(page.locator('.daily-list')).toContainText('调入');await capture('moved-home');
    }
    if(device==='desktop'){
      await page.getByRole('button',{name:'按整天',exact:true}).click();await page.locator('#exception-form [name=type]').selectOption('replaceDay');await capture('day');
    }
    if(device==='small'){
      await form.locator('[name=location]').fill('跨校区联合实验教学楼第一教学区研究生公共研讨教室 1208');await form.locator('[name=note]').fill('仅本次调整，其他课程照常。');
      await form.locator('[name=note]').focus();await form.locator('[name=note]').press('Tab');await expect(page.getByRole('button',{name:'保存单次调整'})).toBeFocused();
      await page.getByRole('button',{name:'保存单次调整'}).click();await windowTop(page);await capture('long-location');
    }
    await context.close();
  }
  writeFileSync('reports/adjustments-ui-captures.json',JSON.stringify({version:'0.3.4',checkedAt:new Date().toISOString(),scope:'Shared browser interface only; synthetic demo; no device or ringing certification',demonstrationData:true,checks,captures},null,2));
});
async function windowTop(page){await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0);});}
