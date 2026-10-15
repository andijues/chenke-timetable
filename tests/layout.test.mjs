import {test} from 'node:test';
import assert from 'node:assert/strict';
import {courseFromText,parseTimetable,tableCells,weekdayColumns} from '../src/parser.mjs';
import {extractRulings,rotateRulings} from '../src/pdf-layout.mjs';
import {createState} from '../src/core.mjs';

const settings=createState('2026-09-07').settings;
const item=(text,x,y,width=80,height=12)=>({text,x,y,width,height});
const headers=()=>[...('一二三四五六日')].map((day,i)=>item('星期'+day,130+i*105,30,42));
const cell=(day,text,top=90,bottom=200)=>({day,text,top,bottom,left:100+(day-1)*105,right:205+(day-1)*105,items:[]});
const page=(cells,options={})=>({width:900,height:600,items:options.headed===false?[]:headers(),cells,source:'text',...options});
const course=(name,period,weeks='2-4,6-14周',room='A-101')=>`${name}(${name}01)\n${period}节\n${weeks}\n示例教师\n${room}`;

test('换行标题及斜杠元数据保留课程、节次、单双周与教室',()=>{
  const c=courseFromText('跨行课程名\n称后半段★\n(７-８节)４-１８周(双)/校区:演示校区/场\n地:１０-４０７/教师:示例教师/学分:2.0',{day:4,cell:true},settings);
  assert.equal(c.name,'跨行课程名称后半段');assert.equal(c.location,'10-407');
  assert.deepEqual(c.periodRange,{start:7,end:8});assert.deepEqual(c.weeks,[4,6,8,10,12,14,16,18]);
  assert.equal(c.confirmed,false);assert.match(c.reasons.join(','),/节次推算/);
});

test('去除重复教学班名时保留合法括号、副标题及英文空格',()=>{
  for(const name of ['演示计算(先进计算等)','体育(游泳07)','Data Science']){
    const c=courseFromText(`${name}(${name}01)\n示例教师\nA-101\n1-8周`,{day:1,cell:true},settings);
    assert.equal(c.name,name);
  }
});

test('OCR 周次行损坏时仍保留课程名，缺少周次必须提示校对',()=>{
  const c=courseFromText('3-154)\n另一演示课(另一演示课02)\n示例教师\nB-202',{day:3,cell:true},settings);
  assert.equal(c.name,'另一演示课');assert.equal(c.location,'B-202');
  assert.match(c.reasons.join(','),/未找到周次/);assert.equal(c.confirmed,false);
});

test('教学班尾号单独换行时保留闭括号，教师名单不混入课程名',()=>{
  const c=courseFromText('1-8周\n演示课程\n(演示课程\n01)\n示例教师、演示教师\nA-101',{day:1,cell:true},settings);
  assert.equal(c.name,'演示课程');assert.equal(c.location,'A-101');
});

test('合并单元格的多个时刻覆盖默认节次，而不修改设置',()=>{
  const original=structuredClone(settings);
  const p=page([cell(1,'演示课程(演示课程01)\n1-8周\n示例教师\nA-101',80,210)]);
  p.items.push(item('第一节 08:30-09:15',0,100,95),item('第二节 09:20-10:05',0,160,95));
  const result=parseTimetable({pages:[p]},settings),c=result.courses[0];
  assert.equal(c.start,'08:30');assert.equal(c.end,'10:05');assert.equal(c.timeSource,'document');
  assert.deepEqual(c.detectedPeriodRange,{start:1,end:2});assert.equal(c.periodRange,undefined);
  assert.deepEqual(settings,original);
});

test('节次标题和钟点分成两行时不重复递增节次',()=>{
  const p=page([cell(1,'演示课程(演示课程01)\n1-8周\nA-101',80,210),cell(1,'演示课程(演示课程01)\n1-8周\nA-101',210,350)]);
  p.items.push(item('08:30-09:15',0,120,90),item('第二节',0,240,70),item('09:20-10:05',0,270,90));
  const result=parseTimetable({pages:[p]},settings);
  assert.equal(result.courses.length,1);assert.deepEqual(result.courses[0].detectedPeriodRange,{start:1,end:2});
  assert.equal(result.courses[0].start,'08:30');assert.equal(result.courses[0].end,'10:05');
});

test('跨页同列教室续接，并排除未安排时间的页尾课程',()=>{
  const a=page([cell(1,'演示晚课★\n(9-10节)3-18周/校区:演示校区',450,595)]);
  const b=page([cell(1,'/场地:G-305/教师:示例教师/教学班:演示班',18,125)],{headed:false});
  b.items=[item('其 他 课 程：未排期演示实习',25,190,250)];
  const r=parseTimetable({pages:[a,b]},settings);
  assert.equal(r.courses.length,1);assert.equal(r.courses[0].location,'G-305');assert.equal(r.courses[0].day,1);
  assert.deepEqual(r.courses[0].periodRange,{start:9,end:10});
  assert.match(r.warnings.join(','),/跨页/);assert.match(r.warnings.join(','),/未安排具体/);assert.match(r.warnings.join(','),/只提供节次/);
});

test('跨页继承仅连接上一页底部，不跨越空页补错教室',()=>{
  const a=page([cell(1,'演示晚课★\n(9-10节)3-18周/场地:A-101',450,595)]);
  const b=page([],{headed:false});
  const c=page([cell(1,'/场地:Z-999/教师:示例教师',18,125)],{headed:false});
  const r=parseTimetable({pages:[a,b,c]},settings);
  assert.equal(r.courses.length,1);assert.equal(r.courses[0].location,'A-101');assert.doesNotMatch(r.courses[0].raw,/Z-999/);
});

test('相邻课程仅在周次完全一致时合并，且不改变其他星期节次',()=>{
  const p=page([cell(1,course('演示课',1),80,180),cell(1,course('演示课',2),180,280),cell(1,course('演示课',3,'2-4,6-13周'),280,380),cell(2,course('另一演示课',1),80,180)]);
  const r=parseTimetable({pages:[p]},settings);
  assert.equal(r.courses.length,3);
  assert.deepEqual(r.courses.map(c=>c.periodRange),[{start:1,end:2},{start:3,end:3},{start:1,end:1}]);
  assert.equal(r.courses[0].weeks.at(-1),14);assert.equal(r.courses[1].weeks.at(-1),13);
});

test('OCR 周次只参考同课同教室相邻格，并明确标记待校对',()=>{
  const p=page([cell(1,course('演示课',1,'2-46-14周')),cell(1,course('演示课',2))],{source:'ocr'});
  const r=parseTimetable({pages:[p]},settings);
  assert.equal(r.courses.length,1);assert.equal(r.courses[0].weeksRepaired,true);
  assert.deepEqual(r.courses[0].weeks,[2,3,4,6,7,8,9,10,11,12,13,14]);assert.equal(r.courses[0].confirmed,false);
  assert.match(r.courses[0].reasons.join(','),/分隔符模糊/);assert.match(r.warnings.join(','),/OCR 周次/);
});

test('OCR 周次有两个不同参考或只有非相邻参考时不擅自补全',()=>{
  for(const cells of [
    [cell(1,course('演示课',1,'2,5-12周')),cell(1,course('演示课',2,'25-12周')),cell(1,course('演示课',3,'5-12周'))],
    [cell(1,course('演示课',1)),cell(1,course('演示课',4,'2-46-14周'))]
  ]){
    const r=parseTimetable({pages:[page(cells,{source:'ocr'})]},settings);
    const invalid=r.courses.find(c=>c.weeks.length===0);assert.ok(invalid);assert.equal(invalid.weeksRepaired,undefined);
  }
});

test('实际表格边界取代标题中心估算，页尾拆字不进入课表',()=>{
  const p=page([]);delete p.cells;
  p.items.push(item('演示课程',104,100,90),item('1-8周',104,120,50),item('A-101',104,140,40),item('本 学 期 已 选 但 未 安 排 时 间 地 点 的 课 程',25,300,380),item('未排期演示课',104,330,90));
  p.grid={vertical:[100,205,310,415,520,625,730,835].map(x=>({x,y1:50,y2:500})),horizontal:[{x1:100,x2:835,y:200}]};
  const partition=tableCells(p,weekdayColumns(p));
  assert.equal(partition.cells.length,1);assert.equal(partition.cells[0].left,100);assert.equal(partition.cells[0].right,205);assert.equal(partition.hasUnscheduled,true);
  assert.doesNotMatch(partition.cells[0].text,/未排期/);
});

test('PDF 线段变换与状态恢复保留表格，忽略字形曲线和短线',()=>{
  const OPS={save:1,restore:2,transform:3,constructPath:4,stroke:5};
  const path=(coords)=>[5,[new Float32Array(coords)],[0,0,200,200]];
  const operatorList={fnArray:[1,3,4,2,4,4],argsArray:[null,[2,0,0,2,10,20],path([0,0,0,1,100,0,1,100,100]),null,path([0,0,5,1,80,5]),path([0,0,0,2,5,5,10,10,20,20,1,22,20])]};
  const grid=extractRulings(operatorList,{width:900,height:600,convertToViewportPoint:(x,y)=>[x,y]},OPS);
  assert.deepEqual(grid.horizontal,[{x1:10,x2:210,y:20},{x1:0,x2:80,y:5}]);assert.deepEqual(grid.vertical,[{y1:20,y2:220,x:210}]);
});

test('侧转的横竖表格线与 OCR 图像使用相同坐标',()=>{
  const grid={horizontal:[{x1:20,x2:80,y:30}],vertical:[{y1:10,y2:60,x:50}]};
  assert.deepEqual(rotateRulings(grid,100,200,90),{horizontal:[{x1:140,x2:190,y:50}],vertical:[{y1:20,y2:80,x:170}]});
  assert.deepEqual(rotateRulings(rotateRulings(grid,100,200,90),200,100,270),grid);
});

test('嵌套 PDF 表单的旋转矩阵影响表格线，结束后恢复外层坐标',()=>{
  const OPS={paintFormXObjectBegin:1,paintFormXObjectEnd:2,constructPath:3,stroke:4};
  const path=[4,[new Float32Array([0,0,0,1,100,0])],[0,0,100,0]];
  const operatorList={fnArray:[1,1,3,2,3,2,3],argsArray:[[[0,1,-1,0,300,20]],[[1,0,0,1,10,0]],path,null,path,null,path]};
  const grid=extractRulings(operatorList,{width:900,height:600,convertToViewportPoint:(x,y)=>[x,y]},OPS);
  assert.deepEqual(grid.vertical,[{y1:30,y2:130,x:300},{y1:20,y2:120,x:300}]);
  assert.deepEqual(grid.horizontal,[{x1:0,x2:100,y:0}]);
});
