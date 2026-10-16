import {addDays,clock,coursesOn,courseStatus,dateParts,dayOfWeek,minutes,mondayOf,weekdays} from './core.mjs';

const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shortDate=date=>`${+date.slice(5,7)}月${+date.slice(8,10)}日`;

export function courseTimeline(state,date,icon,aside=false){
  const courses=coursesOn(state,date),now=dateParts(),today=date===now.date;
  if(!courses.length)return `<div class="day-empty">${icon('calendar')}<strong>这一天，没有课程</strong><button class="text-button" data-action="add">为这天添加课程</button></div>`;
  let pointerPlaced=false;
  const pointer=()=>`<div class="day-now-pointer" aria-label="现在 ${now.time}"><span>${now.time}</span><i></i><small>现在</small></div>`;
  const rows=courses.map(c=>{
    const status=today?courseStatus(c,now.minute):'upcoming',active=status==='ongoing';
    const before=today&&!pointerPlaced&&status!=='done';if(before)pointerPlaced=true;
    const progress=Math.max(0,Math.min(100,(now.minute-minutes(c.start))/(minutes(c.end)-minutes(c.start))*100));
    return `${before?pointer():''}<button class="daily-course ${escape(c.color??'mint')} ${active?'is-current':''} ${status==='done'?'is-done':''}" ${c.adjustmentId?`data-adjustment="${escape(c.adjustmentId)}"`:`data-edit="${escape(c.id)}"`} aria-label="编辑 ${escape(c.name)}，${c.start} 至 ${c.end}"><span class="daily-time">${c.start}<small>${c.end}</small></span><span class="daily-info"><strong>${escape(c.name)}</strong><small>${icon('pin')}${escape(c.location||'地点待补充')}</small>${active?`<span class="lesson-progress" role="progressbar" aria-label="当前课程进度" aria-valuenow="${Math.round(progress)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${progress}%"></i></span>`:''}</span><span class="course-state">${!c.confirmed?'待确认':active?'进行中':status==='done'?'已结束':c.adjustmentId?'调入':today?'未开始':'课程'}</span>${icon('arrow','course-chevron')}</button>`;
  }).join('');
  return `<div class="daily-list ${aside?'aside-list':''}">${rows}${today&&!pointerPlaced?pointer():''}</div>`;
}

export function nextLesson(state,selected,icon){
  const now=dateParts(),today=selected===now.date,list=coursesOn(state,selected);
  const next=today?list.find(c=>minutes(c.end)>now.minute):list[0];
  if(!next&&!list.length)return '';
  if(!next)return `<section class="next-lesson next-free"><div class="next-heading"><h2>${today?'今天的课，上完了':'这一天，留一点空白'}</h2>${icon('moon')}</div></section>`;
  const ongoing=today&&minutes(next.start)<=now.minute;
  const duration=today?ongoing?minutes(next.end)-now.minute:minutes(next.start)-now.minute:null;
  return `<section class="next-lesson"><div class="next-heading"><h2>${ongoing?'正在上课':today?'下一节课':'当天首课'}</h2><span>${duration===null?weekdays[next.day-1]:ongoing?`还有 ${duration} 分钟`:`${duration} 分钟后`}</span></div><button class="next-course" ${next.adjustmentId?`data-adjustment="${escape(next.adjustmentId)}"`:`data-edit="${escape(next.id)}"`} aria-label="查看 ${escape(next.name)}，${next.start} 至 ${next.end}"><strong>${escape(next.name)}</strong><span class="next-course-meta"><span>${icon('clock')}${next.start}–${next.end}</span><span>${icon('pin')}${escape(next.location||'地点待补充')}</span></span><span class="next-open">${!next.confirmed?'待校对':next.adjustmentId?'查看调课':'查看课程'}${icon('arrow')}</span></button></section>`;
}

export function homeDashboard({state,selected,view,icon,weekLabel,demoBanner,wake,weekGrid,dayList,showAllDays}){
  const now=dateParts(),monday=mondayOf(selected),current=selected===now.date;
  const chips=Array.from({length:7},(_,i)=>{
    const date=addDays(monday,i),list=coursesOn(state,date);
    return `<button data-date="${date}" class="date-chip ${date===selected?'selected':''} ${date===now.date?'is-today':''}" aria-label="${shortDate(date)} ${weekdays[i]}" aria-pressed="${date===selected}"><span>${weekdays[i].replace('周','')}</span><strong>${+date.slice(8,10)}</strong><i class="${list.length?'has-course':''}"></i></button>`;
  }).join('');
  return `${demoBanner}<div class="page-heading dashboard-heading"><div><h1>${current?'今天':shortDate(selected)}<span>${weekdays[dayOfWeek(selected)-1]}</span></h1><p>${current?shortDate(selected)+' · ':''}${weekLabel} <span class="now-clock">${current?'现在 '+now.time:''}</span></p></div><button class="button secondary compact" data-action="add">${icon('plus')}添加课程</button></div>
    <div class="date-browser"><button class="icon-button previous" data-action="previous" aria-label="前一周">${icon('arrow')}</button><div class="date-strip">${chips}</div><button class="icon-button" data-action="next" aria-label="后一周">${icon('arrow')}</button></div><p class="date-strip-hint">滑动查看七天</p>
    <div class="today-workspace ${!coursesOn(state,selected).length?'no-next':''}"><div class="next-area">${nextLesson(state,selected,icon)}</div><aside class="wake-area">${wake}</aside><section class="schedule-panel today-schedule"><div class="schedule-toolbar"><div class="segmented" aria-label="课表视图"><button data-view="day" class="${view==='day'?'active':''}">日程</button><button data-view="week" class="${view==='week'?'active':''}">周课表</button></div><div class="schedule-context">${view==='day'?`<span>${coursesOn(state,selected).length} 节安排</span>`:`<label>查看周次<select id="view-week" aria-label="查看学期周次"><option value="0">按日期</option>${Array.from({length:state.settings.totalWeeks},(_,i)=>`<option value="${i+1}">${i+1} 周</option>`).join('')}</select></label>`}<button class="text-button" data-action="today">回到今天</button></div></div>${view==='week'?weekGrid():dayList(selected)}${view==='week'?`<div class="schedule-foot"><button class="text-button" data-action="all-days">${showAllDays?'显示五天':'显示周末'}</button></div>`:''}</section></div>`;
}
