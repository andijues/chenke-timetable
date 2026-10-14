import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createState, minutes, parseWeeks, coursesOn, morningPlan, planAlarms, conflicts, validateState, icsExport} from '../src/core.mjs';
function fixture() {
  const s = createState('2026-09-07'); s.settings.enabled = true;
  s.courses = [{id:'a', name:'高等数学', location:'A302', day:1, start:'08:30', end:'10:10', weeks:[1,2,3], confirmed:true}, {id:'b', name:'英语', day:1, start:'10:30', end:'12:10', weeks:[1,2,3], confirmed:true}]; return s;
}
test('08:30 首课减 90 分钟为 07:00，取最早课程', () => {const p=morningPlan(fixture(),'2026-09-07'); assert.equal(p.alarmTime,'07:00'); assert.equal(p.firstCourse.id,'a');});
test('提前量可调整，跨天提前时间保持绝对日期', () => {const s=fixture(); s.settings.leadMinutes=600; const p=morningPlan(s,'2026-09-07'); assert.equal(p.alarmDate,'2026-09-06'); assert.equal(p.alarmTime,'22:30');});
test('无晨课不调度，上午截止点不包含 12:00', () => {const s=fixture(); s.courses[0].start='12:00'; s.courses[0].end='13:00'; s.courses[1].day=2; assert.equal(morningPlan(s,'2026-09-07').status,'rest');});
test('任何未确认晨课都阻止自动调度', () => {const s=fixture(); s.courses[1].confirmed=false; assert.equal(morningPlan(s,'2026-09-07').status,'review'); assert.deepEqual(planAlarms(s,new Date('2026-09-06T00:00:00Z')),[]);});
test('单双周与离散周次', () => {assert.deepEqual(parseWeeks('1-8周(单)'),[1,3,5,7]); assert.deepEqual(parseWeeks('2-8双'),[2,4,6,8]); assert.deepEqual(parseWeeks('1,3,5-6'),[1,3,5,6]); assert.deepEqual(parseWeeks('8-2'),[]);});
test('周次范围、学期结束不产生课程', () => {const s=fixture(); assert.equal(coursesOn(s,'2026-09-28').length,0); assert.equal(coursesOn(s,'2026-08-31').length,0);});
test('停课、按其他星期调课、补课', () => {const s=fixture(); s.exceptions.push({date:'2026-09-07',type:'skip'}); assert.equal(coursesOn(s,'2026-09-07').length,0); s.exceptions.push({date:'2026-09-08',type:'replaceDay',day:1}); assert.equal(coursesOn(s,'2026-09-08').length,2); s.courses.push({id:'c',name:'补课',day:6,start:'09:00',end:'10:00',weeks:[1],date:'2026-09-12',confirmed:true}); assert.equal(morningPlan(s,'2026-09-12').alarmTime,'07:30');});
test('只取消指定课程后取下一首课',()=>{const s=fixture();s.exceptions.push({date:'2026-09-07',type:'cancelCourse',courseId:'a'});assert.equal(morningPlan(s,'2026-09-07').alarmTime,'09:00');});
test('闹钟开关、演示、已过时间都阻止发布', () => {const s=fixture(); const now=new Date('2026-09-07T00:00:00Z'); assert.equal(planAlarms(s,now,1).length,0); s.settings.enabled=false; assert.equal(planAlarms(s,now).length,0); s.settings.enabled=true;s.demo=true;assert.equal(planAlarms(s,new Date('2026-09-06T00:00:00Z')).length,0);});
test('修改课程后固定每日 ID 不产生重复，支持时区',()=>{const s=fixture();const now=new Date('2026-09-06T16:00:00Z');const a=planAlarms(s,now,1);assert.equal(a[0].id,'chenke-2026-09-07');s.courses[0].start='09:00';const b=planAlarms(s,now,1);assert.equal(b[0].id,a[0].id);assert.equal(b[0].alarmTime,'07:30');});
test('冲突需要同星期、同周并且时间相交', () => {const s=fixture();s.courses[1].start='09:00';assert.equal(conflicts(s.courses).length,1);s.courses[1].weeks=[4];assert.equal(conflicts(s.courses).length,0);});
test('无效备份/坏日期/重复 ID 被拒绝', () => {const s=fixture();assert.doesNotThrow(()=>validateState(s));s.settings.week1='2026-02-31';assert.throws(()=>validateState(s));s.settings.week1='2026-09-07';s.courses[1].id='a';assert.throws(()=>validateState(s));assert.ok(Number.isNaN(minutes('24:00')));});
test('日历导出使用 UTC、不偷添普通通知为闹钟', () => {const text=icsExport(fixture(),'2026-09-07',1);assert.match(text,/DTSTART:20260907T003000Z/);assert.match(text,/SUMMARY:高等数学/);assert.doesNotMatch(text,/VALARM/);});
