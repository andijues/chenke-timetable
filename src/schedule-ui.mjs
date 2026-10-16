import {weekdays, minutes, clock, addDays, weeksForRule, periodsForDay, formatWeeks, validatePeriods} from './core.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function inferWeekRule(weeks, totalWeeks) {
  const values = [...new Set(weeks)].sort((a, b) => a - b);
  const start = values[0] ?? 1, end = values.at(-1) ?? totalWeeks;
  const pattern = ['all','odd','even'].find(pattern => JSON.stringify(weeksForRule({start,end,pattern})) === JSON.stringify(values)) ?? 'custom';
  return {start, end, pattern};
}

export function weekSummary(weeks, settings, day) {
  if (!weeks.length) return '还没有选择上课周次，请选择至少一周。';
  const first = addDays(settings.week1, (weeks[0] - 1) * 7 + day - 1);
  const last = addDays(settings.week1, (weeks.at(-1) - 1) * 7 + day - 1);
  return `已选 ${weeks.length} 周 · ${formatWeeks(weeks)} · ${first} 至 ${last}`;
}

export function weeksEditor(course, settings) {
  const rule = course.weekRule ?? inferWeekRule(course.weeks, settings.totalWeeks);
  return `<section class="course-weeks" aria-labelledby="course-weeks-title">
    <h3 id="course-weeks-title">上课周次</h3>
    <div class="form-pair week-range-fields"><label>从第几周<input id="week-start" type="number" inputmode="numeric" min="1" max="${settings.totalWeeks}" value="${rule.start}"></label><label>到第几周<input id="week-end" type="number" inputmode="numeric" min="1" max="${settings.totalWeeks}" value="${rule.end}"></label></div>
    <div class="week-patterns" aria-label="周次规则">${[['all','每周'],['odd','单周'],['even','双周']].map(([value,label])=>`<button type="button" data-week-pattern="${value}" aria-pressed="${rule.pattern === value}">${label}</button>`).join('')}</div>
    <p class="helper">单双周按学期周数计算，也可点选下面的具体周次。</p>
    <div id="week-calendar" class="week-calendar" aria-label="选择上课周次">${Array.from({length:settings.totalWeeks},(_,i)=>`<button type="button" data-week="${i+1}" aria-label="第 ${i+1} 周" aria-pressed="${course.weeks.includes(i+1)}">${i+1}</button>`).join('')}</div>
    <p id="week-summary" class="selection-summary">${escape(weekSummary(course.weeks,settings,course.day))}</p>
    <label class="week-text-label">周次文字（也可直接输入）<input name="weeks" value="${escape(formatWeeks(course.weeks).replace('周',''))}" placeholder="例如 3-12单，或 1,3,8-10" required></label>
  </section>`;
}

export function coursePeriodControls(settings, day, range) {
  const periods = periodsForDay(settings, day);
  const options = value => periods.map((p,i)=>`<option value="${i+1}" ${value===i+1?'selected':''}>第 ${i+1} 节 · ${p.start}–${p.end}</option>`).join('');
  return periods.length ? `<div class="form-pair"><label>开始节次<select name="periodStart" id="course-period-start">${options(range?.start ?? 1)}</select></label><label>结束节次<select name="periodEnd" id="course-period-end">${options(range?.end ?? range?.start ?? 1)}</select></label></div><p class="helper">时间跟随${weekdays[day-1]}节次表；修改节次后，这门课和起床计划一起更新。</p>` : `<p class="notice">${weekdays[day-1]}暂未设置节次。请先设置节次，或切换到直接填写时间。</p>`;
}

export function resizePeriods(periods, count) {
  const next = periods.slice(0, count).map(p=>({...p}));
  while (next.length < count) {
    const previous = minutes(next.at(-1)?.end);
    const start = next.length ? previous + 10 : 510;
    next.push(Number.isFinite(start) && start < 1439 ? {start:clock(start),end:clock(Math.min(start+45,1439))} : {start:'',end:''});
  }
  return next;
}

export function periodChart(periods, activeIndex) {
  return `<div class="period-chart" aria-label="全天节次时间轴"><div class="period-axis"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>${periods.map((p,i)=>{
    const start=minutes(p.start), end=minutes(p.end), valid=Number.isFinite(start)&&Number.isFinite(end)&&end>start;
    return `<button type="button" class="period-chart-row ${activeIndex===i?'active':''}" data-period-active="${i}" aria-label="可视化调整第 ${i+1} 节"><span>第 ${i+1} 节</span><span class="period-chart-track">${valid?`<i style="left:${start/14.4}%;width:${(end-start)/14.4}%"></i>`:''}</span><small>${valid?`${p.start}–${p.end}`:'待填写'}</small></button>`;
  }).join('')}</div>`;
}

export function periodSliders(periods, activeIndex) {
  const p=periods[activeIndex]; if(!p)return '';
  return `<div class="period-sliders"><strong>拖动调整第 ${activeIndex+1} 节</strong><label>开始 <output id="period-start-output">${escape(p.start)}</output><input type="range" min="0" max="1435" step="5" value="${Number.isFinite(minutes(p.start))?minutes(p.start):510}" data-period-slider="start" aria-label="拖动第 ${activeIndex+1} 节开始时间"></label><label>结束 <output id="period-end-output">${escape(p.end)}</output><input type="range" min="5" max="1439" step="5" value="${Number.isFinite(minutes(p.end))?minutes(p.end):555}" data-period-slider="end" aria-label="拖动第 ${activeIndex+1} 节结束时间"></label></div>`;
}

export function periodsEditor(settings, scope='common', activeIndex=0) {
  const common=scope==='common', periods=common?settings.periods:periodsForDay(settings,+scope);
  const own=!common&&Object.hasOwn(settings.periodsByDay??{},scope);
  const scopeLabel=common?'通用':weekdays[+scope-1];
  const errors=validatePeriods(periods,!common);
  return `<form id="periods-form" class="periods-editor">
    <div class="period-config"><label>适用日期<select id="period-scope"><option value="common" ${common?'selected':''}>通用节次（默认每天）</option>${weekdays.map((day,i)=>`<option value="${i+1}" ${scope===String(i+1)?'selected':''}>${day}${Object.hasOwn(settings.periodsByDay??{},String(i+1))?' · 单独设置':''}</option>`).join('')}</select></label>
    <label>每天几节<div class="period-count-control"><button type="button" data-period-count="-1" aria-label="减少一节" ${periods.length<=(common?1:0)?'disabled':''}>−</button><input id="period-count" type="number" inputmode="numeric" min="${common?1:0}" max="20" value="${periods.length}" aria-label="每天节次数"><button type="button" data-period-count="1" aria-label="增加一节" ${periods.length>=20?'disabled':''}>+</button></div></label></div>
    <p id="period-scope-note" class="helper">${common?'通用表适用于没有单独设置的星期。':own?`${scopeLabel}单独使用这套节次。`:`${scopeLabel}当前沿用通用表；在这里修改后会单独保存。`} 节次数是可排课时段数，并非当天实际课程数。</p>
    ${!common?'<button type="button" class="text-button" data-action="period-inherit">恢复为通用节次</button>':''}
    <div id="period-chart">${periodChart(periods,activeIndex)}</div>
    <div id="period-slider-panel">${periodSliders(periods,activeIndex)}</div>
    <details class="period-precise"><summary>精确填写每节起止时间</summary><div class="period-grid">${periods.map((p,i)=>`<div class="period-row"><strong>第 ${i+1} 节</strong><label><span class="sr-only">第 ${i+1} 节开始时间</span><input type="time" name="p${i}s" value="${escape(p.start)}" data-period-index="${i}" data-period-part="start" required aria-label="第 ${i+1} 节开始"></label><span>至</span><label><span class="sr-only">第 ${i+1} 节结束时间</span><input type="time" name="p${i}e" value="${escape(p.end)}" data-period-index="${i}" data-period-part="end" required aria-label="第 ${i+1} 节结束"></label></div>`).join('')||'<p class="helper">当天不按节次排课，仍可按具体时间手动添加课程。</p>'}</div></details>
    <p id="period-error" class="form-error" role="alert">${escape(errors[0]??'')}</p>
    <div class="period-save"><button class="button" type="submit">保存节次时间</button><span>按节次录入的课程会跟随更新；直接填写的时间保留。</span></div>
  </form>`;
}
