import {uid, parseWeeks, defaultPeriods, validateCourse, weekdays} from './core.mjs';

const dayRegex = /(?:星期|周|礼拜)([一二三四五六日天])/;
const dayChars = '一二三四五六日天';
const clean = s => String(s ?? '').replace(/[：]/g, ':').replace(/[～~—–]/g, '-').replace(/[\t\u00a0]/g, ' ').replace(/([\u4e00-\u9fff])[ ]+(?=[\u4e00-\u9fff])/g,'$1').replace(/(\d)[ ]*-[ ]*(\d)/g,'$1-$2').trim();
function parseDay(text) { const m=text.match(dayRegex); return m ? Math.min(dayChars.indexOf(m[1]) + 1, 7) : null; }
function timeRange(text) {
  const m = clean(text).match(/(\d{1,2})\s*:\s*(\d{2})\s*(?:-|至|到)\s*(\d{1,2})\s*:\s*(\d{2})/);
  return m ? [`${m[1].padStart(2,'0')}:${m[2]}`, `${m[3].padStart(2,'0')}:${m[4]}`] : null;
}
function periodRange(text, periods) {
  const m = text.match(/(?:第\s*)?(\d{1,2})\s*(?:[-,，、]\s*(\d{1,2}))?\s*节/);
  if (!m) return null;
  const start=+m[1], end=+(m[2]??m[1]);
  if (start < 1 || end < start || end > periods.length) return null;
  return [periods[start-1].start, periods[end-1].end];
}
export function courseFromText(raw, context = {}, settings = {}) {
  const text = clean(raw); const lines=text.split(/\n|\|/).map(clean).filter(Boolean);
  const periods=settings.periods??defaultPeriods.map(([start,end])=>({start,end}));
  const direct=timeRange(text), period=periodRange(text,periods);
  const time=direct??period??context.time;
  const day=parseDay(text)??context.day;
  const weekText = text.match(/(?:第\s*)?\d+(?:\s*[-,，、]\s*\d+)*\s*(?:周(?:次)?(?:\s*[（(\[]?[单双][）)\]]?)?|[单双]周)/)?.[0] ?? text.match(/\d+\s*-\s*\d+\s*[单双]/)?.[0];
  let name=''; let location='';
  const discard = /^(?:上午|下午|晚上|午休|时间|节次|课程|学期|星期|周[一二三四五六日]|\d+\s*[-,]\s*\d+\s*节|\d{1,2}\s*:\s*\d{2})/;
  const candidates=lines.map(s=>s.replace(dayRegex,'').replace(/\d{1,2}\s*:\s*\d{2}\s*(?:-|至|到)\s*\d{1,2}\s*:\s*\d{2}/,'').replace(/(?:第\s*)?\d+(?:\s*[-,，、]\s*\d+)*\s*节/,'').replace(weekText??/\u0000/,'').trim()).filter(s=>s&&!discard.test(s)&&!/^\d+[ -]*\d*\s*(?:周|[单双])?$/.test(s));
  const locRE=/(?:教室|地点|校区|楼|室|馆|[A-Z]\d{2,4}|\d{3,4}教室)/;
  const nameCandidate=candidates.find(s=>!locRE.test(s) && s.length > 1);
  if (nameCandidate) name=nameCandidate.replace(/^(?:课程(?:名称)?[:\s]*)/,'').replace(/\s*(?:教师|老师)[:\s].*$/,'').trim();
  const locationCandidate=candidates.find(s=>s!==nameCandidate&&locRE.test(s));
  if (locationCandidate) location=locationCandidate.replace(/^(?:教室|地点)[:\s]*/, '');
  if (!name && candidates.length) name=candidates.find(s=>/[\u4e00-\u9fffA-Za-z]/.test(s)&&!locRE.test(s))??'';
  if (!name || /^(?:课表|教学安排|个人课程表|无课|节次|日期)$/.test(name)) return null;
  const reasons=[];
  if (!time) reasons.push('未找到上课时间，请按学校节次补全');
  if (period && !direct) reasons.push('时间按节次推算，请核对节次设置');
  if (!day) reasons.push('未找到星期');
  if (!weekText) reasons.push('未找到周次，暂按每周填写');
  const course={id:uid(), name, location, day:day??1, start:time?.[0]??'08:30', end:time?.[1]??'10:10', weeks:parseWeeks(weekText??'',settings.totalWeeks??18), color:'mint', confirmed:false, source:'import', raw:text, reasons};
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
function headers(items) {
  const results=[];
  for (const i of items) {
    const matches=[...i.text.matchAll(/(?:星期|周|礼拜)[一二三四五六日天]/g)];
    for (const m of matches) results.push({day:parseDay(m[0]), x:i.x + (m.index+m[0].length/2)/Math.max(i.text.length,1)*i.width, y:i.y});
  }
  const byY=new Map();
  for (const h of results) {const key=Math.round(h.y/12); if (!byY.has(key)) byY.set(key,[]);byY.get(key).push(h);}
  const row=[...byY.values()].sort((a,b)=>new Set(b.map(i=>i.day)).size-new Set(a.map(i=>i.day)).size)[0]??[];
  return [...new Map(row.map(h=>[h.day,h])).values()].sort((a,b)=>a.x-b.x);
}
export function parsePositionedPage(page, settings) {
  let head=headers(page.items); if (head.length<3) return {courses:[],method:'lines'};
  const steps=[];for(let i=1;i<head.length;i++){const days=head[i].day-head[i-1].day;if(days>0)steps.push((head[i].x-head[i-1].x)/days);}
  steps.sort((a,b)=>a-b);const spacing=steps[Math.floor(steps.length/2)]??(head.at(-1).x-head[0].x)/(head.length-1);
  // OCR occasionally misses a weekday header. Infer only a consistent regular column grid, flagged for review.
  if(steps.length&&steps.every(s=>Math.abs(s-spacing)<spacing*.2)){
    const base=head[0].x-(head[0].day-1)*spacing;const y=head[0].y;
    for(let day=1;day<=7;day++){const x=base+(day-1)*spacing;if(x-spacing*.35<0||x+spacing*.35>page.width)continue;if(!head.some(h=>h.day===day))head.push({day,x,y,inferred:true});}
    head.sort((a,b)=>a.x-b.x);
  }
  const yMin=Math.min(...head.map(i=>i.y)); const leftBoundary=head[0].x-spacing/2;
  const markers=groupRows(page.items.filter(i=>i.x+i.width/2<leftBoundary&&i.y>yMin+10));
  const periods=settings.periods??defaultPeriods.map(([start,end])=>({start,end}));
  const timed=[];
  for (let i=0;i<markers.length;i++) {
    const row=markers[i]; let t=timeRange(row.text)??periodRange(row.text,periods);
    if (!t && /\d{1,2}:\d{2}/.test(clean(row.text))) {
      const match=clean(row.text).match(/\d{1,2}:\d{2}/)?.[0];const next=markers[i+1];
      if (next&&/\d{1,2}:\d{2}/.test(clean(next.text))&&next.y-row.y<60) {t=[match.padStart(5,'0'),clean(next.text).match(/\d{1,2}:\d{2}/)[0].padStart(5,'0')]; i++;}
    }
    if (t) timed.push({y:row.y,time:t});
  }
  const courses=[];
  for (let col=0;col<head.length;col++) {
    const h=head[col]; const x1=col===0?h.x-spacing/2:(head[col-1].x+h.x)/2; const x2=col===head.length-1?h.x+spacing/2:(head[col+1].x+h.x)/2;
    const column=page.items.filter(i=>i.y>yMin+12 && i.x+i.width/2>=x1 && i.x+i.width/2<x2);
    const rows=groupRows(column,4);
    const blocks=[];
    for (const row of rows) {
      const previous=blocks.at(-1); const near=previous&&row.y-previous.lastY<=Math.max(25,(row.items[0]?.height??12)*2.5);
      if (near) {previous.text+='\n'+row.text;previous.lastY=row.y;} else blocks.push({y:row.y,lastY:row.y,text:row.text});
    }
    for (const b of blocks) {
      const nearest=timed.filter(t=>t.y<=b.y+35).at(-1)??timed[0];
      const c=courseFromText(b.text,{day:h.day,time:nearest?.time},settings);
      if (c) {if (!timeRange(b.text)&&!periodRange(b.text,periods)&&nearest)c.reasons.push('时间由表格行位置推断，请核对');if(h.inferred)c.reasons.push('星期由相邻列推断，请核对');courses.push(c);}
    }
  }
  return {courses,method:'grid'};
}
export function parseTimetable(document, settings) {
  let courses=[]; let methods=[];
  for (const page of document.pages??[]) {
    const result=parsePositionedPage(page,settings); methods.push(result.method);
    courses.push(...result.courses);
    if (!result.courses.length) {
      const rows=groupRows(page.items??[]).map(r=>r.text);
      courses.push(...parseTextRows(rows.length?rows:page.text?.split('\n')??[],settings));
    }
  }
  if (!document.pages?.length) courses=parseTextRows((document.text??'').split('\n'),settings);
  const seen=new Set(); courses=courses.filter(c=>{const key=[c.name,c.day,c.start,c.end,c.weeks.join(',')].join('|');if(seen.has(key))return false;seen.add(key);return true;});
  const colors=['mint','sky','lavender','peach','rose']; courses.forEach((c,i)=>c.color=colors[i%colors.length]);
  return {courses, methods, rawText:document.text??document.pages?.map(p=>p.text).join('\n\n')??'', warnings:courses.length?[]:['没有找到可可靠分组的课程。可按识别原文手动添加，或换一张清晰的课表图片。']};
}
export function parseTextRows(rows, settings) {
  const result=[]; let day=null; let buffer=[];
  const flush=()=>{if(buffer.length){const c=courseFromText(buffer.join('\n'),{day},settings);if(c)result.push(c);buffer=[];}};
  for (const raw of rows) {
    const line=clean(raw); if (!line) {flush();continue;}
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
