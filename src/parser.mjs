import {uid, parseWeeks, defaultPeriods, validateCourse, weekdays, periodsForDay, weeksForRule} from './core.mjs';

const dayRegex = /(?:星期|周|礼拜)([一二三四五六日天])/;
const dayChars = '一二三四五六日天';
const clean = s => String(s ?? '').replace(/[０-９]/g,c=>String(c.charCodeAt(0)-0xff10)).replace(/[：]/g, ':').replace(/[～~—–]/g, '-').replace(/[\t\u00a0]/g, ' ').replace(/([\u4e00-\u9fff])[ ]+(?=[\u4e00-\u9fff])/g,'$1').replace(/(\d)[ ]*-[ ]*(\d)/g,'$1-$2').trim();
function parseDay(text) { const m=text.match(dayRegex); return m ? Math.min(dayChars.indexOf(m[1]) + 1, 7) : null; }
function timeRange(text) {
  const m = clean(text).match(/(\d{1,2})\s*:\s*(\d{2})\s*(?:-|至|到)\s*(\d{1,2})\s*:\s*(\d{2})/);
  return m ? [`${m[1].padStart(2,'0')}:${m[2]}`, `${m[3].padStart(2,'0')}:${m[4]}`] : null;
}
function periodNumbers(text) {
  const chinese=text.match(/第\s*([一二三四五六七八九十]{1,3})\s*(?:节|课)/);
  if(chinese){const n=chinese[1],digit=s=>'一二三四五六七八九'.indexOf(s)+1,value=n==='十'?10:n.includes('十')?(n.startsWith('十')?10:digit(n[0])*10)+(n.endsWith('十')?0:digit(n.at(-1))):digit(n);if(value>=1&&value<=20)return {start:value,end:value};}
  const m = text.match(/(?:第\s*)?(\d{1,2})\s*(?:[-,，、至到]\s*(?:第\s*)?(\d{1,2}))?\s*节/);
  if (!m) return null;
  const start=+m[1], end=+(m[2]??m[1]);
  return start>=1&&end>=start&&end<=20?{start,end}:null;
}
function periodRange(text, periods) {
  const range=periodNumbers(text);
  if(!range||range.end>periods.length)return null;
  return [periods[range.start-1].start, periods[range.end-1].end];
}
function editDistance(a,b){let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=0;i<a.length;i++){const next=[i+1];for(let j=0;j<b.length;j++)next[j+1]=Math.min(next[j]+1,row[j+1]+1,row[j]+(a[i]===b[j]?0:1));row=next;}return row[b.length];}
function stripTeachingClass(value){
  const name=clean(value).replace(/[{}《〈]/g,'(').replace(/[》〉]/g,')');
  if(!/\d{1,4}[）)]$/.test(name))return name;
  const normalized=s=>s.replace(/[()（）\s]/g,'');
  for(let i=3;i<name.length-3;i++){
    const head=name.slice(0,i);if(/[（(]$/.test(head))continue;
    if((head.match(/[（(]/g)??[]).length!==(head.match(/[）)]/g)??[]).length)continue;
    const tail=name.slice(i).replace(/^[（(]/,'').replace(/\d{1,4}[）)]$/,'');
    const a=normalized(head),b=normalized(tail);
    if(a.length<3||Math.abs(a.length-b.length)>1)continue;
    if(a===b||a.length>=6&&a.slice(0,2)===b.slice(0,2)&&editDistance(a,b)<=1)return head;
  }
  return name;
}
export function courseFromText(raw, context = {}, settings = {}) {
  const text = clean(raw); const lines=text.split(/\n|\|/).map(clean).filter(Boolean);
  const day=parseDay(text)??context.day;
  const periods=periodsForDay({...settings,periods:settings.periods??defaultPeriods.map(([start,end])=>({start,end}))},day??1);
  const direct=timeRange(text), range=direct?null:periodNumbers(text)??context.periodRange;
  const period=range&&range.end<=periods.length?[periods[range.start-1].start,periods[range.end-1].end]:null;
  const time=direct??(context.observedTime?context.time:null)??period??(range?undefined:context.time);
  const weekSource=text.replace(/(\d)\s*[.,，、]+\s*(?=\d)/g,'$1,').replace(/[,，、.]+/g,',');
  const weekText = weekSource.match(/(?:第\s*)?\d+\s*周\s*(?:至|到|-)\s*(?:第\s*)?\d+\s*周(?:\s*[（(\[]?[单双][）)\]]?)?/)?.[0] ?? weekSource.match(/(?:第\s*)?\d+(?:\s*[-,，、]\s*\d+)*\s*(?:周(?:次)?(?:\s*[（(\[]?[单双][）)\]]?)?|[单双]周)/)?.[0] ?? weekSource.match(/\d+\s*-\s*\d+\s*[单双]/)?.[0];
  let name=''; let location='';
  const discard = /^(?:上午|下午|晚上|午休|时间|节次|课程|学期|星期|周[一二三四五六日]|\d+\s*[-,]\s*\d+\s*节|\d{1,2}\s*:\s*\d{2})/;
  const candidates=lines.map(s=>s.replace(dayRegex,'').replace(/\d{1,2}\s*:\s*\d{2}\s*(?:-|至|到)\s*\d{1,2}\s*:\s*\d{2}/,'').replace(/(?:第\s*)?\d+(?:\s*[-,，、]\s*\d+)*\s*节/,'').replace(weekText??/\u0000/,'').trim()).filter(s=>s&&!discard.test(s)&&!/^\d+[ -]*\d*\s*(?:周|[单双])?$/.test(s));
  const locRE=/(?:教室|地点|校区|楼|室|馆|[A-Z]\d{2,4}|\d{3,4}教室)/;
  const nameCandidate=candidates.find(s=>!locRE.test(s) && s.length > 1);
  if (nameCandidate) name=nameCandidate.replace(/^(?:课程(?:名称)?[:\s]*)/,'').replace(/\s*(?:教师|老师)[:\s].*$/,'').trim();
  const locationCandidate=candidates.find(s=>s!==nameCandidate&&locRE.test(s));
  if (locationCandidate) location=locationCandidate.replace(/^(?:教室|地点)[:\s]*/, '');
  if (!name && candidates.length) name=candidates.find(s=>/[\u4e00-\u9fffA-Za-z]/.test(s)&&!locRE.test(s))??'';
  const compact=text.replace(/\s+/g,'');
  const labeledLocation=compact.match(/(?:场地|教室|地点):([^/]+)/)?.[1];
  if(labeledLocation)location=labeledLocation;
  const structuredTitle=compact.match(/^(.+?)[（(]\d+(?:[-,，至到]\d+)?节[）)]/);
  if(structuredTitle)name=structuredTitle[1];
  else if(context.cell){
    const rows=lines.filter(s=>!/^\d+[\d\s,，.、\-]*周/.test(s)&&!timeRange(s)&&!/^第[一二三四五六七八九十\d]+节/.test(s));
    const locIndex=rows.findIndex(s=>/^(?:[A-Za-z]\s*-?\s*\d{2,4}|\d{1,3}-\d{2,4}|.*(?:楼|馆|教室)\s*[A-Za-z\d-]*)$/.test(s));
    if(locIndex>=0)location=rows[locIndex].replace(/\s/g,'').replace(/^([a-z])-/,(_,c)=>c.toUpperCase()+'-');
    let title=[];
    for(const row of rows.slice(0,locIndex>=0?locIndex:rows.length)){
      if(!/[\u4e00-\u9fffA-Za-z]/.test(row)&&!title.length)continue;
      if(/^(?:研究生选课|打印时间|https?:|学号|姓名|校区|教师|教学班|其他课程|本学期已选)/.test(row))continue;
      title.push(row);
      if(/\d+\s*[）)]\s*$/.test(row))break;
    }
    if(title.length===locIndex&&title.length>1&&!/[()（）]/.test(title.at(-1))&&/^[\u4e00-\u9fff、,，/]{2,18}$/.test(title.at(-1)))title.pop();
    if(title.length)name=title.join('');
  }
  name=clean(name).replace(/[★☆◆■〇]/g,'').replace(/[“”"{}《》]/g,'').replace(/\s+(?=[()（）])/g,'').trim();
  name=stripTeachingClass(name);
  if (!name || /^(?:课表|教学安排|个人课程表|无课|节次|日期)$/.test(name)||/^(?:https?:|打印时间|学号|姓名|[★☆◆■〇]:|\/?场地:|部\/场地:|教学班|学班组成|考核方式|课程学时|周学时|总学时|学分|其他课程|本学期已选|研究生选课)/.test(name)||!/[\u4e00-\u9fffA-Za-z]/.test(name)||(!day&&!weekText&&!time&&/^[A-Za-z\s]{1,4}$/.test(name))) return null;
  const reasons=[];
  if (!time) reasons.push('未找到上课时间，请按学校节次补全');
  if (period && !direct&&!context.observedTime) reasons.push('时间按节次推算，请核对节次设置');
  if (!day) reasons.push('未找到星期');
  if (!weekText) reasons.push('未找到周次，暂按每周填写');
  const course={id:uid(), name, location, day:day??1, start:time?.[0]??'08:30', end:time?.[1]??'10:10', weeks:parseWeeks(weekText??'',settings.totalWeeks??18), color:'mint', confirmed:false, source:'import', raw:text, reasons};
  if(weekText&&/\d+\s*-\s*\d+\s*-\s*\d+/.test(weekText)){course.weeks=[];course.reasons.push('周次分隔符不清楚，请对照原文重新填写');}
  if(range){if(context.observedTime)course.detectedPeriodRange={...range};else if(period)course.periodRange={...range};}
  if(context.observedTime)course.timeSource='document';
  if(weekText)course.detectedWeekText=weekText;
  if(weekText&&course.weeks.length){
    const numbers=[...weekText.matchAll(/\d+/g)].map(m=>+m[0]);
    const rule={start:Math.min(...numbers),end:Math.max(...numbers),pattern:/单/.test(weekText)?'odd':/双/.test(weekText)?'even':'all'};
    if(JSON.stringify(weeksForRule(rule))!==JSON.stringify(course.weeks))rule.pattern='custom';
    course.weekRule=rule;
  }
  const errors=validateCourse(course); if (errors.length) course.reasons.push(...errors);
  return course;
}
export function groupRows(items, tolerance=5) {
  const rows=[];
  for (const item of [...items].sort((a,b)=>a.y-b.y || a.x-b.x)) {
    if (!item.text?.trim()) continue;
    let row=rows.find(r=>Math.abs(r.y-item.y)<=Math.max(tolerance,item.height*0.22));
    if (!row) {row={y:item.y,items:[]}; rows.push(row);}
    row.items.push(item);
  }
  return rows.map(r=>({...r, items:r.items.sort((a,b)=>a.x-b.x), text:r.items.map(t=>t.text).join(' ')}));
}
export function weekdayColumns(page,previous=null){
  const candidates=[];
  for(const row of groupRows(page.items??[],Math.max(4,page.height*.008))){
    let text='',positions=[];
    for(const item of row.items)for(let i=0;i<item.text.length;i++){const char=item.text[i];if(/\s/.test(char))continue;text+=char;positions.push(item.x+(i+.5)*item.width/item.text.length);}
    const found=[...text.matchAll(/(?:星期|周|礼拜)[一二三四五六日天]/g)].map(m=>({day:parseDay(m[0]),x:positions[m.index+Math.floor(m[0].length/2)],y:row.y,height:Math.max(...row.items.map(i=>i.height??10))}));
    const unique=[...new Map(found.map(h=>[h.day,h])).values()].sort((a,b)=>a.x-b.x);
    if(unique.length>=3)candidates.push(unique);
  }
  let head=candidates.sort((a,b)=>b.length-a.length)[0];
  if(!head&&previous&&Math.abs(previous.width/page.width-1)<.05)return {head:previous.head.map(h=>({...h,x:h.x*page.width/previous.width,y:0})),spacing:previous.spacing*page.width/previous.width,bodyTop:0,inherited:true};
  if(!head)return null;
  const steps=[];for(let i=1;i<head.length;i++)if(head[i].day>head[i-1].day)steps.push((head[i].x-head[i-1].x)/(head[i].day-head[i-1].day));
  steps.sort((a,b)=>a-b);const spacing=steps[Math.floor(steps.length/2)];
  if(!spacing||spacing<page.width*.04)return null;
  if(steps.every(v=>Math.abs(v-spacing)<spacing*.2)){
    const base=head[0].x-(head[0].day-1)*spacing;
    for(let day=1;day<=7;day++){const x=base+(day-1)*spacing;if(x-spacing*.4<0||x+spacing*.4>page.width)continue;if(!head.some(h=>h.day===day))head.push({day,x,y:head[0].y,height:head[0].height,inferred:true});}
    head.sort((a,b)=>a.x-b.x);
  }
  return {head,spacing,bodyTop:Math.min(...head.map(h=>h.y))+Math.max(...head.map(h=>h.height??10))*1.05,inherited:false};
}
const footerPattern=/(?:本学期已选|未安排时间地点|其他课程[:：]|打印时间[:：]|https?:\/\/|课程代码|[★☆◆■〇]\s*[:：])/;
const metadataOnly=s=>/^(?:https?:|研究生选课$|打印时间|学号[:：]|姓名[:：]|\d{4}\/\d{1,2}\/\d{1,2}|\d+\s*[/f]\s*\d+$)/.test(clean(s));
function tableMarkers(page,layout,settings){
  const left=layout.head[0].x-layout.spacing/2,rows=groupRows(page.items.filter(i=>i.x+i.width/2<left&&i.y>=layout.bodyTop),Math.max(4,page.height*.008));
  const result=[];let lastClockEnd=0,lastClockY=-Infinity,pending=null;
  for(const row of rows){
    const value=clean(row.text),time=timeRange(value);let range=periodNumbers(value);
    const number=value.replace(/上午|下午|晚上|晚间|中午/g,'').trim();if(!range&&/^\d{1,2}$/.test(number)&&+number>0&&+number<=20)range={start:+number,end:+number};
    if(time&&!range)range=pending&&pending.y>lastClockY&&row.y-pending.y<page.height*.1?pending.range:{start:lastClockEnd+1,end:lastClockEnd+1};
    if(time||range){
      result.push({y:row.y,time,periodRange:range,observedTime:Boolean(time)});
      if(time){lastClockEnd=range.end;lastClockY=row.y;}else if(range)pending={range,y:row.y};
    }
  }
  return result;
}
export function tableCells(page,layout){
  const footer=groupRows(page.items??[],Math.max(4,page.height*.006)).filter(i=>i.y>layout.bodyTop&&footerPattern.test(clean(i.text))).sort((a,b)=>a.y-b.y)[0];
  const bottom=footer?.y??page.height,cells=[];
  for(let col=0;col<layout.head.length;col++){
    const h=layout.head[col];
    const snap=value=>{const candidates=(page.grid?.vertical??[]).filter(l=>l.y2-l.y1>page.height*.2&&Math.abs(l.x-value)<layout.spacing*.22).sort((a,b)=>Math.abs(a.x-value)-Math.abs(b.x-value));return candidates[0]?.x??value;};
    const left=snap(col?(layout.head[col-1].x+h.x)/2:h.x-layout.spacing/2),right=snap(col===layout.head.length-1?h.x+layout.spacing/2:(h.x+layout.head[col+1].x)/2);
    const items=page.items.filter(i=>i.y+i.height/2>=layout.bodyTop&&i.y<bottom&&i.x+i.width/2>=left&&i.x+i.width/2<right&&!metadataOnly(i.text));
    const rules=(page.grid?.horizontal??[]).filter(l=>l.y>layout.bodyTop+1&&l.y<bottom&&l.x1<h.x-layout.spacing*.2&&l.x2>h.x+layout.spacing*.2).map(l=>l.y).sort((a,b)=>a-b);
    const bounds=[layout.bodyTop];for(const y of rules)if(y-bounds.at(-1)>2)bounds.push(y);bounds.push(bottom);
    if(rules.length){
      for(let i=0;i<bounds.length-1;i++){
        const group=items.filter(item=>item.y+item.height/2>=bounds[i]&&item.y+item.height/2<bounds[i+1]);
        if(group.length)cells.push({day:h.day,left,right,top:bounds[i],bottom:bounds[i+1],text:groupRows(group,Math.max(3,page.height*.004)).map(r=>r.text).join('\n'),items:group,inferred:h.inferred});
      }
    }else{
      const blocks=[];
      for(const row of groupRows(items,Math.max(3,page.height*.004))){
        const prior=blocks.at(-1),gap=prior?row.y-prior.lastY:Infinity;
        if(prior&&gap<=Math.max(12,(row.items[0]?.height??12)*2.1)){prior.text+='\n'+row.text;prior.lastY=row.y;prior.items.push(...row.items);}
        else blocks.push({day:h.day,left,right,top:row.y,bottom:row.y+(row.items[0]?.height??12),lastY:row.y,text:row.text,items:[...row.items],inferred:h.inferred});
      }
      cells.push(...blocks);
    }
  }
  return {cells,bottom,hasUnscheduled:Boolean(footer&&/本学期已选|未安排时间|其他课程/.test(clean(footer.text)))};
}
function pageRecords(page,settings,previous=null){
  const layout=weekdayColumns(page,previous);if(!layout)return {layout:null,records:[],method:'lines'};
  const markers=tableMarkers(page,layout,settings),partition=tableCells(page,layout);if(page.cells)partition.cells=page.cells;
  const records=partition.cells.map(cell=>{
    const nearby=markers.filter(m=>m.y>=cell.top-5&&m.y<cell.bottom+2),first=nearby.find(m=>m.time)??nearby[0]??markers.filter(m=>m.y<=cell.top+15).at(-1);
    const last=nearby.filter(m=>m.time).at(-1),time=first?.time&&last?.time?[first.time[0],last.time[1]]:first?.time;
    const range=first?.periodRange&&last?.periodRange?{start:first.periodRange.start,end:last.periodRange.end}:first?.periodRange;
    return {...cell,context:{day:cell.day,time,periodRange:range,observedTime:first?.observedTime,cell:true},pageHeight:page.height,source:page.source};
  });
  return {layout:{...layout,width:page.width},records,method:'grid',hasUnscheduled:partition.hasUnscheduled};
}
function recordsToCourses(records,settings){
  return records.map(record=>{
    const c=courseFromText(record.text,record.context,settings);if(!c)return null;
    if(record.inferred)c.reasons.push('星期由相邻列推断，请核对');
    if(record.continued)c.reasons.push('已续接下一页同列内容，请对照原文核对');
    if(record.source==='ocr')c.reasons.push('图片文字经本机 OCR 识别，请核对名称、周次和地点');
    c.recognizedBy=record.source??'text';
    return c;
  }).filter(Boolean);
}
export function parsePositionedPage(page,settings){const result=pageRecords(page,settings);return {courses:recordsToCourses(result.records,settings),method:result.method};}
function mergeAdjacent(courses){
  const result=[];
  for(const course of [...courses].sort((a,b)=>a.day-b.day||a.start.localeCompare(b.start))){
    const range=course.detectedPeriodRange??course.periodRange;
    const prior=result.at(-1),previous=prior&&(prior.detectedPeriodRange??prior.periodRange);
    if(range&&previous&&prior.day===course.day&&previous.end+1===range.start&&prior.name===course.name&&prior.location===course.location&&JSON.stringify(prior.weeks)===JSON.stringify(course.weeks)){
      prior.end=course.end;previous.end=range.end;prior.raw+='\n\n'+course.raw;prior.reasons=[...new Set([...prior.reasons,...course.reasons])];prior.weeksRepaired ||= course.weeksRepaired;
    }else result.push(course);
  }
  return result;
}
function repairAmbiguousWeeks(courses){
  for(const course of courses){
    if(course.recognizedBy!=='ocr'||course.weeks.length||!course.detectedWeekText)continue;
    const compact=s=>s.replace(/周|[\s()（）]/g,'');
    const range=course.detectedPeriodRange??course.periodRange;
    const matches=courses.filter(other=>{const adjacent=other.detectedPeriodRange??other.periodRange;return range&&adjacent&&(adjacent.end+1===range.start||range.end+1===adjacent.start)&&other!==course&&other.day===course.day&&other.name===course.name&&other.location===course.location&&other.weeks.length&&other.detectedWeekText&&editDistance(compact(other.detectedWeekText),compact(course.detectedWeekText))<=1;});
    const choices=[...new Map(matches.map(c=>[c.weeks.join(','),c])).values()];
    if(choices.length!==1)continue;
    course.weeks=[...choices[0].weeks];course.weekRule=choices[0].weekRule?{...choices[0].weekRule}:undefined;
    course.reasons=course.reasons.filter(r=>!/周次分隔符|请填写有效周次/.test(r));
    course.reasons.push('周次分隔符模糊，已参考同课相邻单元格补全，请对照原文确认');course.weeksRepaired=true;
  }
}
export function parseTimetable(document,settings){
  let courses=[],methods=[],previous=null,carry=new Map(),records=[],hasUnscheduled=false,observedTimes=false,continued=0;
  for(const page of document.pages??[]){
    const result=pageRecords(page,settings,previous);methods.push(result.method);hasUnscheduled ||= result.hasUnscheduled;
    if(result.layout){
      const nextCarry=new Map();
      for(const record of result.records){
        const old=carry.get(record.day),newAnchor=/\d+[\d,，.、\s-]*周/.test(record.text)&&/[\u4e00-\u9fff]/.test(record.text.replace(/\d+[\d,，.、\s-]*周/g,''));
        if(result.layout.inherited&&record.top<page.height*.15&&old&&!newAnchor){old.text+='\n'+record.text;old.continued=true;continued++;if(record.bottom>page.height*.72)nextCarry.set(record.day,old);}
        else {records.push(record);if(record.bottom>page.height*.72)nextCarry.set(record.day,record);}
        observedTimes ||= Boolean(record.context.observedTime);
      }
      carry=nextCarry;
      previous=result.layout;
    }else{
      previous=null;carry.clear();const rows=groupRows(page.items??[]).map(r=>r.text);courses.push(...parseTextRows(rows.length?rows:page.text?.split('\n')??[],settings));
    }
  }
  courses.push(...recordsToCourses(records,settings));
  if(!document.pages?.length)courses=parseTextRows((document.text??'').split('\n'),settings);
  const seen=new Set();courses=courses.filter(c=>{const key=[c.name,c.day,c.start,c.end,c.weeks.join(','),c.location].join('|');if(seen.has(key))return false;seen.add(key);return true;});
  repairAmbiguousWeeks(courses);courses=mergeAdjacent(courses);
  const colors=['mint','sky','lavender','peach','rose'];courses.forEach((c,i)=>c.color=colors[i%colors.length]);
  const warnings=[];
  if(!courses.length)warnings.push('没有找到可可靠分组的课程。可按识别原文手动添加，或换一张清晰的课表图片。');
  if(hasUnscheduled)warnings.push('课表包含未安排具体星期或时间的课程，已保留在识别原文，未擅自放入周一或生成闹钟。请按实际安排手动补充。');
  if(continued)warnings.push('已按相同星期列续接跨页内容，请核对跨页课程的地点和周次。');
  if(courses.some(c=>c.periodRange)&&!observedTimes)warnings.push('此课表只提供节次，没有几点上课。时间暂按“设置”中的节次表换算，请先按学校作息校正后再确认课程。');
  if(observedTimes)warnings.push('已按原课表的时间列读取上课时刻，未覆盖你在设置中保存的通用节次表。');
  if(courses.some(c=>c.weeksRepaired))warnings.push('部分 OCR 周次分隔符不清晰，已用同课同地点的相邻记录补全并标注，确认前请重点核对。');
  return {courses,methods,rawText:document.text??document.pages?.map(p=>p.text).join('\n\n')??'',warnings};
}
export function parseTextRows(rows, settings) {
  const result=[]; let day=null; let buffer=[];
  const flush=()=>{if(buffer.length){const c=courseFromText(buffer.join('\n'),{day},settings);if(c)result.push(c);buffer=[];}};
  for (const raw of rows) {
    const line=clean(raw); if (!line) {flush();continue;}
    if(footerPattern.test(line)||metadataOnly(line)){flush();if(footerPattern.test(line))break;continue;}
    if (parseDay(line)&&line.length<8) {flush();day=parseDay(line);continue;}
    if (parseDay(line)&& (timeRange(line)||/节/.test(line))) {
      const c=courseFromText(line.split(/\s{2,}|\|/).join('\n'),{day},settings);
      if(c){flush();result.push(c);}else{buffer.push(line);}
      continue;
    }
    if (buffer.length && (timeRange(buffer.join(' '))||/周/.test(buffer.join(' '))) && !timeRange(line)&& !/(?:周|节|楼|室|教师|地点|教室)/.test(line) && buffer.length>=2) flush();
    buffer.push(line);
  }
  flush();return result;
}
