import {test,expect} from '@playwright/test';
import {createState} from '../../src/core.mjs';

async function prepare(page,{granted=false,notifications=false,testFails=false}={}){
  const state=createState('2026-10-12');state.settings.enabled=true;
  state.courses=[{id:'harmony-course',name:'鸿蒙晨课',day:5,start:'08:30',end:'10:10',weeks:[1,3,5],confirmed:true,color:'mint'}];
  await page.clock.install({time:new Date('2026-10-15T12:00:00+08:00')});
  await page.addInitScript(({state,granted,notifications,testFails})=>{
    window.__harmony={granted,notifications,testFails,calls:[],testCount:0};
    window.HarmonyBridge={postMessage(raw){
      const m=JSON.parse(raw),h=window.__harmony;h.calls.push(m);let data={};
      const status=()=>({platform:'harmony',supported:true,reminderGranted:h.granted,notificationsAllowed:h.notifications,
        activeReminders:h.granted?0:undefined,mode:h.granted&&h.notifications?'pending':'blocked',failed:!h.granted,
        message:!h.granted?'此安装包尚未获得系统代理提醒授权':!h.notifications?'通知未允许':'系统权限已授予，仍需测试'});
      if(m.action==='capabilities')data=status();
      if(m.action==='loadState')data={state};
      if(m.action==='requestPermissions'){if(h.granted)h.notifications=true;data=status();}
      if(m.action==='syncAlarms')data=h.granted&&h.notifications?{...status(),mode:'system-reminder',scheduled:m.payload.plans.length,message:'系统已接受起床代理提醒'}:{...status(),failed:true};
      if(m.action==='testAlarm'){
        h.testCount++;
        if(h.testFails){queueMicrotask(()=>window.chenkeNativeResult({id:m.id,error:'系统拒绝新增提醒（1700002），原有提醒保留'}));return;}
        data={testScheduled:true,message:'系统已接受一分钟测试提醒，请退出并锁屏'};
      }
      if(m.action==='cancelTestAlarm')data={testScheduled:false,message:'测试提醒已取消，课程起床提醒不受影响'};
      queueMicrotask(()=>window.chenkeNativeResult({id:m.id,data}));
    }};
  },{state,granted,notifications,testFails});
  await page.goto('/');await page.getByRole('button',{name:'闹钟',exact:true}).click();
  await expect(page.locator('.harmony-authorization')).toBeVisible();
}

test('鸿蒙待授权仍可计算起床时间；不误报就绪，不自动弹出通知权限',async({page})=>{
  await prepare(page);await expect(page.locator('.harmony-authorization')).toContainText('等待授权');
  await expect(page.locator('.native-status')).toContainText('等待系统提醒授权');
  await expect(page.getByRole('button',{name:'测试 1 分钟后响铃'})).toBeDisabled();
  await expect(page.locator('.alarm-week')).toContainText('07:00');
  expect(await page.evaluate(()=>window.__harmony.calls.filter(c=>c.action==='requestPermissions').length)).toBe(0);
  await page.getByRole('button',{name:'检查权限并更新'}).click();
  await expect(page.locator('.native-status')).toContainText('尚未获得');
  expect(await page.evaluate(()=>window.__harmony.testCount)).toBe(0);
});
test('鸿蒙通知仅主动检查时申请；测试结果内联显示且可单独取消',async({page})=>{
  await prepare(page,{granted:true});await expect(page.locator('.harmony-authorization')).toContainText('未允许');
  await page.getByRole('button',{name:'检查权限并更新'}).click();
  await expect(page.locator('.native-status')).toContainText('系统已接受');
  await page.getByRole('button',{name:'测试 1 分钟后响铃'}).click();
  await expect(page.locator('.harmony-feedback')).toContainText('请退出并锁屏');
  await page.getByRole('button',{name:'取消测试提醒',exact:true}).click();
  await expect(page.locator('.harmony-feedback')).toContainText('课程起床提醒不受影响');
  await expect(page.getByRole('button',{name:'取消测试提醒',exact:true})).toHaveCount(0);
});
test('鸿蒙测试拒绝内联保留错误；回前台重新读取授权状态',async({page})=>{
  await prepare(page,{granted:true,notifications:true,testFails:true});
  await page.getByRole('button',{name:'测试 1 分钟后响铃'}).click();
  await expect(page.locator('.harmony-feedback[role=alert]')).toContainText('1700002');
  await page.evaluate(()=>{window.__harmony.granted=false;window.chenkeNativeResume();});
  await expect(page.getByRole('button',{name:'测试 1 分钟后响铃'})).toBeDisabled();
  await expect(page.locator('.native-status')).toContainText('等待系统提醒授权');
});
test('鸿蒙系统返回先保护未保存课程，再回课表；主页交还系统返回',async({page})=>{
  await prepare(page);await page.getByRole('button',{name:'课表',exact:true}).click();
  await page.getByRole('button',{name:'添加课程',exact:true}).click();
  await page.locator('#course-form [name=name]').fill('尚未保存的课程');
  page.once('dialog',d=>d.dismiss());await page.evaluate(()=>window.chenkeNativeBack());
  await expect(page.locator('#course-dialog')).toBeVisible();
  await expect(page.locator('#course-form [name=name]')).toHaveValue('尚未保存的课程');
  page.once('dialog',d=>d.accept());await page.evaluate(()=>window.chenkeNativeBack());
  await expect(page.locator('#course-dialog')).not.toBeVisible();
  await page.getByRole('button',{name:'设置',exact:true}).click();await page.evaluate(()=>window.chenkeNativeBack());
  await expect(page.locator('.schedule-panel')).toBeVisible();
  expect(await page.evaluate(()=>window.chenkeNativeBack())).toBe(false);
  await expect.poll(()=>page.evaluate(()=>window.__harmony.calls.filter(c=>c.action==='setBackState').at(-1)?.payload.handled)).toBe(false);
});
