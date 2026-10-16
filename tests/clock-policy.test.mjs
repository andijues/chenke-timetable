import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createState,morningPlan,planAlarms,validateState} from '../src/core.mjs';
import {tomorrowClock,clockRequestKey} from '../src/clock-policy.mjs';

function state(){const s=createState('2026-10-14');s.settings.enabled=true;s.courses=[{id:'first',name:'演示晨课',location:'演示楼101',day:4,start:'08:30',end:'10:10',weeks:[1,2,3],confirmed:true}];return s;}
test('今天9点只选择明天的7点，不发送当天或更远的课程',()=>{
  const s=state();s.courses.push({...s.courses[0],id:'today',day:3,start:'10:30',end:'12:10'});
  const r=tomorrowClock(s,new Date('2026-10-14T09:00:00+08:00'));
  assert.equal(r.canSend,true);assert.equal(r.plan.date,'2026-10-15');assert.equal(r.plan.alarmTime,'07:00');
});
test('凌晨5点不把明天7点的单次闹钟误设成今天，过今天7点后才可发',()=>{
  const s=state();assert.equal(tomorrowClock(s,new Date('2026-10-14T05:00:00+08:00')).status,'deferred');
  assert.equal(tomorrowClock(s,new Date('2026-10-14T07:00:01+08:00')).canSend,true);
});
test('演示、关闭、未确认、上午无课、假日及仅有后天课都不自动发送',()=>{
  for(const modify of [s=>s.demo=true,s=>s.settings.enabled=false,s=>s.courses[0].confirmed=false,s=>s.courses[0].start='14:00',s=>s.exceptions.push({date:'2026-10-15',type:'skip'}),s=>s.courses[0].day=5]){
    const s=state();modify(s);assert.equal(tomorrowClock(s,new Date('2026-10-14T09:00:00+08:00')).canSend,false);
  }
});
test('暂停次日起床保留课表课程，只移除那个日期的提醒计划',()=>{
  const s=state();s.settings.alarmSkippedDates=['2026-10-15'];
  assert.equal(morningPlan(s,'2026-10-15').status,'paused');assert.equal(s.courses.length,1);
  assert.equal(planAlarms(s,new Date('2026-10-14T09:00:00+08:00')).some(p=>p.date==='2026-10-15'),false);
  assert.equal(tomorrowClock(s,new Date('2026-10-14T09:00:00+08:00')).canSend,false);
});
test('提前量跨到今天晚间仍属于明天课程，安全的下一次时刻可以发送',()=>{
  const s=state();s.courses[0].start='00:30';s.courses[0].end='01:30';
  const r=tomorrowClock(s,new Date('2026-10-14T22:00:00+08:00'));
  assert.equal(r.canSend,true);assert.equal(r.plan.date,'2026-10-15');assert.equal(r.plan.alarmDate,'2026-10-14');assert.equal(r.plan.alarmTime,'23:00');
});
test('相同计划的去重键稳定，提前量变化必须被识别为另一计划',()=>{
  const s=state(),now=new Date('2026-10-14T09:00:00+08:00');
  const key=clockRequestKey(tomorrowClock(s,now).plan);assert.equal(clockRequestKey(tomorrowClock(s,now).plan),key);
  s.settings.leadMinutes=60;assert.notEqual(clockRequestKey(tomorrowClock(s,now).plan),key);
});
test('坏暂停日期或重复日期不能进入备份恢复',()=>{
  for(const dates of [['2026-02-30'],['2026-10-15','2026-10-15'],'2026-10-15']){const s=state();s.settings.alarmSkippedDates=dates;assert.throws(()=>validateState(s));}
});
