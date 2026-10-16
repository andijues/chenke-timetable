import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createState,adjustableCoursesOn,applyCourseAdjustment,coursesOn,morningPlan,planAlarms,validateState,icsExport} from '../src/core.mjs';
import {tomorrowClock} from '../src/clock-policy.mjs';

function fixture(){
  const s=createState('2026-09-07');s.settings.enabled=true;
  s.courses=[
    {id:'math',name:'数学',location:'A302',day:1,start:'08:30',end:'10:10',weeks:[1,2,3],confirmed:true},
    {id:'english',name:'英语',location:'B201',day:1,start:'10:30',end:'12:10',weeks:[1,2,3],confirmed:true},
    {id:'tuesday',name:'实验',location:'C101',day:2,start:'10:30',end:'12:10',weeks:[1,2,3],confirmed:true}
  ];return s;
}
const move=(s,patch={})=>applyCourseAdjustment(s,{date:'2026-09-07',courseId:'math',type:'moveCourse',targetDate:'2026-09-08',start:'09:00',end:'10:00',location:'D102',...patch});

test('单次停课只移除这一门这一次，保留当天其他课和后续周次',()=>{
  const original=fixture(),s=applyCourseAdjustment(original,{date:'2026-09-07',courseId:'math',type:'cancelCourse'});
  assert.deepEqual(coursesOn(s,'2026-09-07').map(c=>c.id),['english']);
  assert.equal(morningPlan(s,'2026-09-07').alarmTime,'09:00');
  assert.deepEqual(coursesOn(s,'2026-09-14').map(c=>c.id),['math','english']);
  assert.equal(original.exceptions.length,0);assert.equal(s.courses.length,3);
});

test('跨日期移动删除原时段，目标当天仍保留其他课并重新计算首课',()=>{
  const s=move(fixture());
  assert.deepEqual(coursesOn(s,'2026-09-07').map(c=>c.name),['英语']);
  const target=coursesOn(s,'2026-09-08');
  assert.deepEqual(target.map(c=>c.name),['数学','实验']);
  assert.equal(target[0].start,'09:00');assert.equal(target[0].location,'D102');
  assert.equal(target[0].sourceCourseId,'math');assert.equal(target[0].rescheduledFrom,'2026-09-07');
  assert.equal(morningPlan(s,'2026-09-08').alarmTime,'07:30');
  assert.equal(coursesOn(s,'2026-09-14')[0].start,'08:30');
});

test('同一天只改时间和地点，不产生重复课程，晨课调到下午后选下一节',()=>{
  const s=move(fixture(),{targetDate:'2026-09-07',start:'14:00',end:'15:30'});
  assert.deepEqual(coursesOn(s,'2026-09-07').map(c=>c.name),['英语','数学']);
  assert.equal(morningPlan(s,'2026-09-07').alarmTime,'09:00');
  assert.equal(coursesOn(s,'2026-09-07').filter(c=>c.name==='数学').length,1);
});

test('单周课可独立移到双周日期，原有单双周规则保留',()=>{
  const original=fixture();original.courses[0].weeks=[1,3];
  const s=move(original,{targetDate:'2026-09-15'});
  assert.equal(coursesOn(s,'2026-09-15').filter(c=>c.name==='数学').length,1);
  assert.equal(coursesOn(s,'2026-09-14').filter(c=>c.name==='数学').length,0);
  assert.equal(coursesOn(s,'2026-09-21').filter(c=>c.id==='math').length,1);
  assert.deepEqual(s.courses[0].weeks,[1,3]);
});

test('同一门不同次课可调到同一天，各自有唯一日历记录',()=>{
  let s=move(fixture(),{targetDate:'2026-09-19'});
  s=move(s,{date:'2026-09-14',targetDate:'2026-09-19',start:'14:00',end:'15:00'});
  const cs=coursesOn(s,'2026-09-19');assert.equal(cs.length,2);
  assert.notEqual(cs[0].id,cs[1].id);assert.equal(new Set(icsExport(s,'2026-09-19',1).match(/UID:[^\r]+/g)).size,2);
});

test('保存同一次调整会替换原记录，改为停课移除调入且保留其他课程调整',()=>{
  let s=move(fixture());const id=s.exceptions[0].id;
  s=applyCourseAdjustment(s,{date:'2026-09-07',courseId:'english',type:'cancelCourse'});
  s=move(s,{start:'09:30'});assert.equal(s.exceptions.length,2);
  assert.equal(s.exceptions.find(e=>e.courseId==='math').id,id);
  s=applyCourseAdjustment(s,{date:'2026-09-07',courseId:'math',type:'cancelCourse'});
  assert.equal(s.exceptions.length,2);assert.equal(coursesOn(s,'2026-09-08').filter(c=>c.name==='数学').length,0);
});

test('撤销一条移动同时恢复原课和撤销调入，不影响另一门停课',()=>{
  let s=move(fixture());s=applyCourseAdjustment(s,{date:'2026-09-07',courseId:'english',type:'cancelCourse'});
  s.exceptions=s.exceptions.filter(e=>e.type!=='moveCourse');
  assert.deepEqual(coursesOn(s,'2026-09-07').map(c=>c.id),['math']);
  assert.deepEqual(coursesOn(s,'2026-09-08').map(c=>c.id),['tuesday']);
});

test('整天停课优先，但原日期放假不抹去已明确移到其他日期的课程',()=>{
  const s=move(fixture());s.exceptions.push({type:'skip',date:'2026-09-07'});
  assert.equal(coursesOn(s,'2026-09-07').length,0);
  assert.equal(coursesOn(s,'2026-09-08')[0].name,'数学');
  s.exceptions.push({type:'skip',date:'2026-09-08'});assert.equal(coursesOn(s,'2026-09-08').length,0);
  assert.throws(()=>move(s),/目标日期.*整天停课/);
});

test('整天按周一上课的日期也能仅调整其中一门',()=>{
  const original=fixture();original.exceptions.push({type:'replaceDay',date:'2026-09-09',day:1});
  assert.deepEqual(adjustableCoursesOn(original,'2026-09-09').map(c=>c.id),['math','english']);
  const s=move(original,{date:'2026-09-09',targetDate:'2026-09-10'});
  assert.deepEqual(coursesOn(s,'2026-09-09').map(c=>c.id),['english']);
  assert.equal(coursesOn(s,'2026-09-10')[0].name,'数学');
});

test('未确认原课程被移动后仍阻止提醒，关闭闹钟和演示仍不发布',()=>{
  const original=fixture();original.courses[0].confirmed=false;const s=move(original);
  assert.equal(morningPlan(s,'2026-09-08').status,'review');
  assert.equal(coursesOn(s,'2026-09-08',{confirmedOnly:true}).length,1);
  s.courses[0].confirmed=true;s.settings.enabled=false;
  assert.deepEqual(planAlarms(s,new Date('2026-09-06T12:00:00Z')),[]);
  s.settings.enabled=true;s.demo=true;assert.deepEqual(planAlarms(s,new Date('2026-09-06T12:00:00Z')),[]);
});

test('调课联动明日时钟请求，日期稳定且不使用调课前的起床时间',()=>{
  const s=move(fixture());const tomorrow=tomorrowClock(s,new Date('2026-09-07T12:00:00+08:00'));
  assert.equal(tomorrow.canSend,true);assert.equal(tomorrow.plan.alarmTime,'07:30');
  const plans=planAlarms(s,new Date('2026-09-06T12:00:00Z'),3);
  assert.deepEqual(plans.map(p=>[p.id,p.alarmTime]),[['chenke-2026-09-07','09:00'],['chenke-2026-09-08','07:30']]);
});

test('调课记录备份可往返，损坏日期、时间、引用和重复记录不能入库',()=>{
  const s=move(fixture());assert.deepEqual(validateState(JSON.parse(JSON.stringify(s))),s);
  for(const patch of [{targetDate:'2026-02-30'},{start:'24:00'},{start:'10:00',end:'09:00'},{courseId:'missing'},{id:'math'}]){
    const bad=structuredClone(s);Object.assign(bad.exceptions[0],patch);assert.throws(()=>validateState(bad));
  }
  const bad=structuredClone(s);bad.exceptions.push({...bad.exceptions[0],id:'duplicate'});assert.throws(()=>validateState(bad));
  assert.throws(()=>move(fixture(),{date:'2026-09-08'}),/原日期没有这门课/);
});

test('原课节次更新不会覆盖已经明确填写的调课时间',()=>{
  const original=fixture();original.courses[0].periodRange={start:1,end:2};
  const s=move(original);s.settings.periods[0].start='08:00';
  assert.equal(coursesOn(s,'2026-09-08')[0].start,'09:00');
  assert.equal(coursesOn(s,'2026-09-14')[0].start,'08:00');
  assert.equal(coursesOn(s,'2026-09-08')[0].periodRange,undefined);
});
