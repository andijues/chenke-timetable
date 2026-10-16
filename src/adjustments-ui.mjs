import {adjustableCoursesOn,applyCourseAdjustment,coursesOn,morningPlan,minutes,weekdays,dayOfWeek} from './core.mjs';

const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const individual=e=>['cancelCourse','moveCourse'].includes(e.type);
const when=date=>`${date} ${weekdays[dayOfWeek(date)-1]}`;

export function courseAdjustmentDraft(state,date,courseId=''){
  const course=adjustableCoursesOn(state,date).find(c=>c.id===courseId);
  const prior=state.exceptions.find(e=>individual(e)&&e.date===date&&e.courseId===courseId);
  return {date,courseId:course?.id??'',type:prior?.type??'moveCourse',targetDate:prior?.targetDate??date,start:prior?.start??course?.start??'',end:prior?.end??course?.end??'',location:prior?.location??course?.location??'',note:prior?.note??''};
}

export function adjustmentPreview(state,draft){
  const course=adjustableCoursesOn(state,draft.date).find(c=>c.id===draft.courseId);
  if(!course)return '';
  const original=`<div class="adjustment-preview-row"><span>原安排</span><strong>${escape(when(draft.date))}<br>${course.start}–${course.end}</strong></div>`;
  let candidate;
  try{candidate=applyCourseAdjustment(state,draft);}catch(error){return `<div class="adjustment-preview">${original}<p class="adjustment-instruction">${escape(error.message)}</p></div>`;}
  const target=draft.type==='cancelCourse'?'<strong>仅停这一次</strong>':`<strong>${escape(when(draft.targetDate))}<br>${draft.start}–${draft.end}${draft.location?`<span>${escape(draft.location)}</span>`:''}</strong>`;
  const dates=[...new Set([draft.date,...(draft.type==='moveCourse'?[draft.targetDate]:[])])];
  const wake=dates.map(date=>{
    const before=morningPlan(state,date),after=morningPlan(candidate,date);
    const label=p=>p.status==='ready'?p.alarmTime:p.status==='review'?'待确认':p.status==='paused'?'已暂停':'上午无课';
    return `<div class="adjustment-preview-row"><span>${escape(date)} 起床</span><strong>${escape(label(before))}${label(before)!==label(after)?` <span class="adjustment-arrow">→</span> ${escape(label(after))}`:''}</strong></div>`;
  }).join('');
  const moved=candidate.exceptions.find(e=>individual(e)&&e.date===draft.date&&e.courseId===draft.courseId);
  const overlaps=draft.type==='moveCourse'?coursesOn(candidate,draft.targetDate).filter(c=>c.id!==moved.id&&minutes(c.start)<minutes(draft.end)&&minutes(draft.start)<minutes(c.end)):[];
  return `<div class="adjustment-preview" aria-label="本次调整预览">${original}<div class="adjustment-preview-row"><span>调整后</span>${target}</div>${wake}</div>${overlaps.length?`<p class="adjustment-warning" role="status">与${overlaps.map(c=>`「${escape(c.name)}」`).join('、')}时间重叠，请核对后保存。</p>`:''}${!course.confirmed?'<p class="adjustment-warning">这门课尚未核对，调整后仍需确认才能安排闹钟。</p>':''}`;
}

export function courseAdjustmentForm(state,draft){
  const choices=adjustableCoursesOn(state,draft.date),moving=draft.type==='moveCourse';
  return `<form id="course-adjustment-form" class="exception-form course-adjustment-form"><label>原上课日期<input type="date" name="date" value="${escape(draft.date)}" required></label><label class="adjustment-course-label">选择这次课程<select name="courseId" required ${choices.length?'':'disabled'}><option value="">${choices.length?'请选择课程':'这一天没有原定课程'}</option>${choices.map(c=>`<option value="${escape(c.id)}" ${c.id===draft.courseId?'selected':''}>${c.start}–${c.end} ${escape(c.name)}</option>`).join('')}</select></label><label class="adjustment-type-label">处理方式<select name="type"><option value="moveCourse" ${moving?'selected':''}>调整日期、时间或地点</option><option value="cancelCourse" ${moving?'':'selected'}>仅停这一次课</option></select></label><fieldset class="adjustment-target" ${moving?'':'hidden disabled'}><legend>新的安排</legend><label class="adjustment-target-date">上课日期<input name="targetDate" type="date" value="${escape(draft.targetDate)}" required></label><label>开始时间<input name="start" type="time" value="${escape(draft.start)}" required></label><label>结束时间<input name="end" type="time" value="${escape(draft.end)}" required></label><label class="adjustment-target-location">上课地点<input name="location" maxlength="160" value="${escape(draft.location)}" placeholder="可保留原地点"></label></fieldset><label class="adjustment-note">备注<input name="note" maxlength="100" value="${escape(draft.note)}" placeholder="选填"></label><div id="course-adjustment-preview" class="adjustment-feedback" aria-live="polite">${adjustmentPreview(state,draft)}</div><p id="adjustment-error" class="form-error" role="alert"></p><button class="button" type="submit" ${draft.courseId?'':'disabled'}>保存单次调整</button></form>`;
}

export function adjustmentRecords(state){
  if(!state.exceptions.length)return '<p class="adjustment-empty">暂无调课记录</p>';
  return state.exceptions.map((e,i)=>{
    const course=state.courses.find(c=>c.id===e.courseId);
    const source=individual(e)?adjustableCoursesOn(state,e.date).find(c=>c.id===e.courseId):null;
    const title=individual(e)?course?.name??'原课程已删除':e.type==='skip'?'全天停课 / 放假':`全天按${weekdays[e.day-1]}上课`;
    const detail=e.type==='moveCourse'?`${e.date}${source?' '+source.start+'–'+source.end:''} → ${e.targetDate} ${e.start}–${e.end}`:`${e.date}${e.type==='cancelCourse'?(source?' '+source.start+'–'+source.end:'')+' · 仅停这一次':''}`;
    return `<div class="adjustment-record"><div class="adjustment-record-copy"><strong>${escape(title)}</strong><span>${escape(detail)}</span>${e.type==='moveCourse'&&e.location?`<span>${escape(e.location)}</span>`:''}${individual(e)&&!source?'<span class="adjustment-warning">原日期已无此课，当前调整不生效</span>':''}${e.note?`<small>${escape(e.note)}</small>`:''}</div><div class="adjustment-record-actions">${individual(e)&&source?`<button class="text-button" data-edit-adjustment="${i}" aria-label="修改 ${escape(title)} ${e.date} 调整">修改</button>`:''}<button class="text-button" data-delete-exception="${i}" aria-label="撤销 ${escape(title)} ${e.date} 调整">撤销</button></div></div>`;
  }).join('');
}

export function adjustmentsPanel(state,draft,scope){
  return `<div class="segmented adjustment-scopes" role="group" aria-label="调课单位"><button type="button" data-exception-scope="course" class="${scope==='course'?'active':''}" aria-pressed="${scope==='course'}">按课程</button><button type="button" data-exception-scope="day" class="${scope==='day'?'active':''}" aria-pressed="${scope==='day'}">按整天</button></div><div id="single-course-adjustment" ${scope==='course'?'':'hidden'}>${courseAdjustmentForm(state,draft)}</div><div id="whole-day-adjustment" ${scope==='day'?'':'hidden'}><form id="exception-form" class="exception-form"><label>日期<input type="date" name="date" value="${escape(draft.date)}" required></label><label>安排<select name="type"><option value="skip">这天停课 / 放假</option><option value="replaceDay">按其他星期上课</option></select></label><label id="exception-day-label" hidden>按哪天课表<select name="day" disabled>${weekdays.map((d,i)=>`<option value="${i+1}">${d}</option>`).join('')}</select></label><label>备注<input name="note" maxlength="100" placeholder="选填"></label><button class="button secondary" type="submit">添加例外日期</button></form><p id="exception-error" class="form-error" role="alert"></p></div><section class="adjustment-history" aria-labelledby="adjustment-history-title"><h3 id="adjustment-history-title">已保存的调整</h3><div class="exception-list">${adjustmentRecords(state)}</div></section>`;
}
