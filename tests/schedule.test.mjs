import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createState, parseWeeks, weeksForRule, coursesOn, morningPlan, planAlarms, validateState, validatePeriods, resolveCourseTime} from '../src/core.mjs';
import {courseFromText} from '../src/parser.mjs';

function stateWithPeriods(){
  const state=createState('2026-09-07');
  state.settings.enabled=true;state.settings.totalWeeks=8;
  state.courses=[{id:'linked',name:'数学',location:'A302',day:3,start:'08:30',end:'10:10',weeks:[3,5,7],weekRule:{start:3,end:8,pattern:'odd'},periodRange:{start:1,end:2},confirmed:true}];
  return state;
}
test('周次区间的单双周按学期编号计算，空区间不扩展到全学期',()=>{
  assert.deepEqual(parseWeeks('第3周至第8周（单）'),[3,5,7]);
  assert.deepEqual(parseWeeks('第3周到第8周（单）'),[3,5,7]);
  assert.deepEqual(weeksForRule({start:3,end:8,pattern:'even'}),[4,6,8]);
  assert.deepEqual(parseWeeks('2-2单'),[]);assert.deepEqual(parseWeeks('5-3单'),[]);
  assert.deepEqual(parseWeeks('1,5-3'),[]);assert.deepEqual(parseWeeks('单双周'),[]);
});
test('任意开学日属于第1周，但开学日前不排常规课程',()=>{
  const state=stateWithPeriods();state.settings.semesterStart='2026-09-09';
  state.courses[0].weeks=[1,2,3];delete state.courses[0].weekRule;
  state.courses.push({...state.courses[0],id:'monday',day:1});
  assert.equal(coursesOn(state,'2026-09-07').length,0);
  assert.equal(coursesOn(state,'2026-09-09').length,1);
  assert.equal(coursesOn(state,'2026-09-14').length,1);
  assert.doesNotThrow(()=>validateState(state));state.settings.semesterStart='2026-09-14';assert.throws(()=>validateState(state));
});
test('不同星期节次不同，调整时间仅影响按节次录入的课程及闹钟',()=>{
  const state=stateWithPeriods();state.settings.periodsByDay['3']=[{start:'09:00',end:'09:45'},{start:'09:55',end:'10:40'}];
  state.courses.push({id:'fixed',name:'研讨',day:3,start:'14:00',end:'15:00',weeks:[3,5,7],confirmed:true});
  assert.equal(morningPlan(state,'2026-09-23').alarmTime,'07:30');
  assert.equal(coursesOn(state,'2026-09-23')[1].start,'14:00');
  state.settings.periodsByDay['3']=[{start:'09:30',end:'10:15'},{start:'10:25',end:'11:10'}];
  assert.equal(resolveCourseTime(state.courses[0],state.settings).end,'11:10');
  assert.equal(morningPlan(state,'2026-09-23').alarmTime,'08:00');
  assert.equal(coursesOn(state,'2026-09-30').length,0);
  const plans=planAlarms(state,new Date('2026-10-06T01:00:00Z'),28);
  assert.deepEqual(plans.map(p=>p.date),['2026-10-07','2026-10-21']);assert.ok(plans.every(p=>p.alarmTime==='08:00'));
});
test('节次顺序、坏时间与缩减正在使用的节次被拒绝，零节单独设置可保存',()=>{
  assert.ok(validatePeriods([{start:'09:00',end:'bad'}]).length);
  assert.ok(validatePeriods([{start:'09:00',end:'10:00'},{start:'09:50',end:'10:30'}]).length);
  const state=stateWithPeriods();state.settings.periodsByDay['3']=[];assert.throws(()=>validateState(state),/数学.*第 2 节/);
  state.courses=[];assert.doesNotThrow(()=>validateState(state));
});
test('旧版备份兼容新增可选设置，规则元数据与周次不一致不能入库',()=>{
  const state=stateWithPeriods();delete state.settings.periodsByDay;assert.doesNotThrow(()=>validateState(state));
  state.courses[0].weeks=[4,6,8];assert.throws(()=>validateState(state));
});
test('PDF节次解析使用所在星期配置并保持关联，明确时间不强制关联',()=>{
  const state=stateWithPeriods();state.settings.periodsByDay['3']=[{start:'09:00',end:'09:45'},{start:'09:55',end:'10:40'}];
  const inferred=courseFromText('计算方法\n周三 第1-2节\n3-8周(单)\nA302',{},state.settings);
  assert.equal(inferred.start,'09:00');assert.equal(inferred.end,'10:40');assert.deepEqual(inferred.periodRange,{start:1,end:2});assert.deepEqual(inferred.weekRule,{start:3,end:8,pattern:'odd'});assert.equal(inferred.confirmed,false);
  const direct=courseFromText('计算方法\n周三 08:00-09:00 第1-2节\n3-8周(单)',{},state.settings);
  assert.equal(direct.start,'08:00');assert.equal(direct.periodRange,undefined);
  const positioned=courseFromText('计算方法\n3-8周(单)',{day:3,time:['08:30','10:10'],periodRange:{start:1,end:2}},state.settings);
  assert.equal(positioned.start,'09:00');assert.equal(positioned.end,'10:40');
});
