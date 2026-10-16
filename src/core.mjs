export const SCHEMA_VERSION = 1;
export const ZONE = 'Asia/Shanghai';
export const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
export const defaultPeriods = [
  ['08:30', '09:15'], ['09:25', '10:10'], ['10:30', '11:15'], ['11:25', '12:10'],
  ['14:00', '14:45'], ['14:55', '15:40'], ['16:00', '16:45'], ['16:55', '17:40'],
  ['19:00', '19:45'], ['19:55', '20:40'], ['20:50', '21:35']
];
export function uid() { return globalThis.crypto?.randomUUID?.() ?? `c-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
export function minutes(value) {
  if (!/^\d{2}:\d{2}$/.test(value ?? '')) return NaN;
  const [h, m] = value.split(':').map(Number);
  return h >= 0 && h < 24 && m >= 0 && m < 60 ? h * 60 + m : NaN;
}
export function clock(value) { return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`; }
export function dateParts(date = new Date(), zone = ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(date);
  const p = Object.fromEntries(parts.map(item => [item.type, item.value]));
  return {date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, minute: +p.hour * 60 + +p.minute};
}
export function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') && !isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value; }
export function addDays(value, days) {
  const d = new Date(`${value}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}
export function dayOfWeek(value) { return (new Date(`${value}T12:00:00Z`).getUTCDay() + 6) % 7 + 1; }
export function mondayOf(value) { return addDays(value, 1 - dayOfWeek(value)); }
export function weekNumber(value, week1) { return Math.floor((Date.parse(`${value}T12:00:00Z`) - Date.parse(`${week1}T12:00:00Z`)) / 604800000) + 1; }
export function parseWeeks(text, max = 18) {
  const s = String(text ?? '').trim().replace(/[（(]/g, '[').replace(/[）)]/g, ']').replace(/[～~—–至到]/g, '-').replace(/[，、；;]/g, ',').replace(/第|周次?/g, '');
  if (!s || /^(?:每|全|全部)$/.test(s)) return Array.from({length: max}, (_, i) => i + 1);
  const odd = /单/.test(s), even = /双/.test(s);
  if (odd && even) return [];
  const nums = new Set();
  let hasNumbers = false;
  for (const match of s.matchAll(/(\d+)\s*(?:-\s*(\d+))?/g)) {
    hasNumbers = true;
    const start = +match[1], end = +(match[2] ?? match[1]);
    if (start < 1 || end > 60 || end < start) return [];
    for (let i = start; i <= end; i++) if ((!odd || i % 2) && (!even || i % 2 === 0)) nums.add(i);
  }
  if (!hasNumbers && (odd || even)) for (let i = 1; i <= max; i++) if ((odd && i % 2) || (even && i % 2 === 0)) nums.add(i);
  return [...nums].sort((a, b) => a - b);
}
export function weeksForRule({start, end, pattern = 'all'}, max = 60) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > max || !['all', 'odd', 'even'].includes(pattern)) return [];
  return Array.from({length: end - start + 1}, (_, i) => i + start).filter(w => pattern === 'all' || (pattern === 'odd' ? w % 2 === 1 : w % 2 === 0));
}
export function periodsForDay(settings, day) { return settings.periodsByDay?.[String(day)] ?? settings.periods; }
export function validatePeriods(periods, allowEmpty = false) {
  if (!Array.isArray(periods) || periods.length < (allowEmpty ? 0 : 1) || periods.length > 20) return ['每天节次应在 0-20 节之间，通用表至少保留 1 节'];
  const errors = [];
  periods.forEach((p, i) => {
    if (!p || !Number.isFinite(minutes(p.start)) || !Number.isFinite(minutes(p.end)) || minutes(p.end) <= minutes(p.start)) errors.push(`第 ${i + 1} 节的结束时间应晚于开始时间`);
    else if (i && minutes(p.start) < minutes(periods[i - 1]?.end)) errors.push(`第 ${i + 1} 节与上一节重叠，请调整时间`);
  });
  return errors;
}
export function resolveCourseTime(course, settings) {
  if (!course.periodRange) return course;
  const periods = periodsForDay(settings, course.day), {start, end} = course.periodRange;
  if (!periods?.[start - 1] || !periods?.[end - 1]) return course;
  return {...course, start: periods[start - 1].start, end: periods[end - 1].end};
}
export function formatWeeks(weeks) {
  if (!weeks?.length) return '未指定周次';
  const a = [...new Set(weeks)].sort((x, y) => x - y); const chunks = [];
  for (let i = 0; i < a.length;) { let j = i; while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++; chunks.push(j > i ? `${a[i]}-${a[j]}` : `${a[i]}`); i = j + 1; }
  return `${chunks.join(',')}周`;
}
export function createState(today = dateParts().date) {
  return {version: SCHEMA_VERSION, courses: [], exceptions: [], settings: {week1: mondayOf(today), totalWeeks: 18, leadMinutes: 90, morningEnd: '12:00', enabled: false, timezone: ZONE, periods: defaultPeriods.map(([start, end]) => ({start, end})), periodsByDay: {}}, modifiedAt: new Date().toISOString(), demo: false};
}
export function validateCourse(c) {
  const errors = [];
  if (!c.name?.trim()) errors.push('请输入课程名称');
  if (!Number.isInteger(c.day) || c.day < 1 || c.day > 7) errors.push('请选择星期');
  if (!Number.isFinite(minutes(c.start)) || !Number.isFinite(minutes(c.end)) || minutes(c.end) <= minutes(c.start)) errors.push('结束时间应晚于开始时间');
  if (!Array.isArray(c.weeks) || !c.weeks.length || c.weeks.some(w => !Number.isInteger(w) || w < 1 || w > 60)) errors.push('请填写有效周次，例如 1-16 或 1-16单');
  if (c.date && !validDate(c.date)) errors.push('补课日期无效');
  if (c.periodRange && (!Number.isInteger(c.periodRange.start) || !Number.isInteger(c.periodRange.end) || c.periodRange.start < 1 || c.periodRange.end < c.periodRange.start || c.periodRange.end > 20)) errors.push('请选择有效的起止节次');
  if (c.weekRule && (!Number.isInteger(c.weekRule.start) || !Number.isInteger(c.weekRule.end) || c.weekRule.start < 1 || c.weekRule.end < c.weekRule.start || c.weekRule.end > 60 || !['all', 'odd', 'even', 'custom'].includes(c.weekRule.pattern))) errors.push('周次范围不正确');
  if (c.weekRule && c.weekRule.pattern !== 'custom' && JSON.stringify([...new Set(c.weeks ?? [])].sort((a,b)=>a-b)) !== JSON.stringify(weeksForRule(c.weekRule))) errors.push('周次选择与单双周规则不一致');
  if (c.name?.length > 100 || c.location?.length > 160) errors.push('课程名称或地点过长');
  return errors;
}
export function validateState(raw) {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.courses) || !Array.isArray(raw.exceptions) || !raw.settings) throw Error('备份格式不正确或版本不支持');
  if (raw.courses.length > 2000 || raw.exceptions.length > 1000) throw Error('备份内容过多');
  const s = raw.settings;
  if (!validDate(s.week1) || dayOfWeek(s.week1) !== 1) throw Error('第 1 周起点必须是星期一');
  if (!Number.isInteger(s.totalWeeks) || s.totalWeeks < 1 || s.totalWeeks > 60) throw Error('学期周数应在 1-60 之间');
  if (s.semesterStart && (!validDate(s.semesterStart) || mondayOf(s.semesterStart) !== s.week1)) throw Error('开学日期必须属于第 1 周');
  if (!Number.isInteger(s.leadMinutes) || s.leadMinutes < 0 || s.leadMinutes > 1440 || !Number.isFinite(minutes(s.morningEnd))) throw Error('起床规则不正确');
  if (s.timezone !== ZONE || typeof s.enabled !== 'boolean') throw Error('当前版本仅支持中国标准时间，闹钟开关应为布尔值');
  if (s.androidAlarmMode !== undefined && !['clock','app'].includes(s.androidAlarmMode)) throw Error('安卓响铃方式无效');
  if (s.alarmSkippedDates !== undefined && (!Array.isArray(s.alarmSkippedDates) || s.alarmSkippedDates.length > 60 || s.alarmSkippedDates.some(date => !validDate(date)) || new Set(s.alarmSkippedDates).size !== s.alarmSkippedDates.length)) throw Error('暂停闹钟的日期无效');
  const periodErrors = validatePeriods(s.periods); if (periodErrors.length) throw Error(periodErrors[0]);
  if (s.periodsByDay !== undefined) {
    if (!s.periodsByDay || typeof s.periodsByDay !== 'object' || Array.isArray(s.periodsByDay)) throw Error('每日节次格式不正确');
    for (const [day, periods] of Object.entries(s.periodsByDay)) if (!/^[1-7]$/.test(day) || validatePeriods(periods, true).length) throw Error('每日节次时间不正确');
  }
  const ids = new Set();
  for (const c of raw.courses) {
    if (validateCourse(c).length || typeof c.confirmed !== 'boolean' || !c.id || ids.has(c.id)) throw Error('备份含有无效或重复课程');
    if (c.periodRange && c.periodRange.end > periodsForDay(s, c.day).length) throw Error(`${c.name} 使用第 ${c.periodRange.end} 节，请先保留该节次或修改课程`);
    ids.add(c.id);
  }
  for (const e of raw.exceptions) if (!validDate(e.date) || !['skip', 'replaceDay', 'cancelCourse'].includes(e.type) || (e.type === 'replaceDay' && (!Number.isInteger(e.day) || e.day < 1 || e.day > 7))) throw Error('例外日期格式不正确');
  return structuredClone(raw);
}
export function coursesOn(state, date, {confirmedOnly = false} = {}) {
  const week = weekNumber(date, state.settings.week1);
  const exception = state.exceptions.filter(e => e.date === date);
  if (exception.some(e => e.type === 'skip')) return [];
  const day = exception.find(e => e.type === 'replaceDay')?.day ?? dayOfWeek(date);
  return state.courses.filter(c => {
    if (confirmedOnly && !c.confirmed) return false;
    if (exception.some(e => e.type === 'cancelCourse' && e.courseId === c.id)) return false;
    if (c.date) return c.date === date;
    return date >= (state.settings.semesterStart ?? state.settings.week1) && week >= 1 && week <= state.settings.totalWeeks && c.day === day && c.weeks.includes(week);
  }).map(c => resolveCourseTime(c, state.settings)).sort((a, b) => minutes(a.start) - minutes(b.start) || a.name.localeCompare(b.name, 'zh'));
}
export function conflicts(courses) {
  const pairs = [];
  for (let i = 0; i < courses.length; i++) for (let j = i + 1; j < courses.length; j++) {
    const a = courses[i], b = courses[j];
    const sharesDate = a.date || b.date ? a.date && b.date && a.date === b.date : a.day === b.day && a.weeks.some(w => b.weeks.includes(w));
    if (sharesDate && minutes(a.start) < minutes(b.end) && minutes(b.start) < minutes(a.end)) pairs.push([a.id, b.id]);
  }
  return pairs;
}
export function morningPlan(state, date) {
  const all = coursesOn(state, date);
  const morning = all.filter(c => minutes(c.start) < minutes(state.settings.morningEnd));
  if (!morning.length) return {date, status: 'rest', reason: '上午无课', firstCourse: null, alarmAt: null};
  if (state.settings.alarmSkippedDates?.includes(date)) return {date,status:'paused',reason:'这天的起床闹钟已暂停，课程照常显示',firstCourse:morning[0],alarmAt:null};
  if (morning.some(c => !c.confirmed)) return {date, status: 'review', reason: '上午课程尚未全部确认', firstCourse: morning[0], alarmAt: null};
  const first = morning[0];
  const startDate = new Date(`${date}T${first.start}:00+08:00`);
  const alarmDate = new Date(startDate.getTime() - state.settings.leadMinutes * 60000);
  const parts = dateParts(alarmDate);
  return {date, status: 'ready', reason: '已按第一节晨课计算', firstCourse: first, alarmAt: alarmDate.toISOString(), alarmDate: parts.date, alarmTime: parts.time, leadMinutes: state.settings.leadMinutes};
}
export function planAlarms(state, now = new Date(), days = 28) {
  if (!state.settings.enabled || state.demo) return [];
  const today = dateParts(now).date; const result = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i), plan = morningPlan(state, date);
    if (plan.status === 'ready' && Date.parse(plan.alarmAt) > now.getTime()) result.push({id: `chenke-${date}`, date, fireAt: plan.alarmAt, title: '该起床啦', course: plan.firstCourse.name, location: plan.firstCourse.location ?? '', courseStart: plan.firstCourse.start, alarmTime: plan.alarmTime, alarmDate: plan.alarmDate, leadMinutes: state.settings.leadMinutes});
  }
  return result;
}
export function courseStatus(c, minute) { return minute < minutes(c.start) ? 'upcoming' : minute < minutes(c.end) ? 'ongoing' : 'done'; }
export function icsExport(state, from = dateParts().date, days = 126) {
  const escape = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, '\\$&');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Chenke//Personal Timetable//ZH', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    for (const c of coursesOn(state, date, {confirmedOnly: true})) {
      const dt = t => new Date(`${date}T${t}:00+08:00`).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      lines.push('BEGIN:VEVENT', `UID:${c.id}-${date}@chenke.local`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`, `DTSTART:${dt(c.start)}`, `DTEND:${dt(c.end)}`, `SUMMARY:${escape(c.name)}`, `LOCATION:${escape(c.location)}`, 'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR'); return lines.join('\r\n') + '\r\n';
}
export function makeDemo(today = dateParts().date) {
  const s = createState(today); s.demo = true;
  s.settings.week1 = addDays(mondayOf(today), -35); s.settings.enabled = false;
  const names = [
    ['高等数学', '理学楼 · A302', 1, '08:30', '10:10', 'mint'],
    ['学术英语', '文科楼 · B201', 1, '14:00', '15:40', 'sky'],
    ['数据结构', '信息楼 · 406', 2, '10:30', '12:10', 'lavender'],
    ['机器学习', '信息楼 · 502', 2, '16:00', '17:40', 'peach'],
    ['概率论与数理统计', '理学楼 · A305', 3, '08:30', '10:10', 'mint'],
    ['科学研究方法', '图书馆 · 研讨室', 3, '14:00', '15:40', 'sky'],
    ['信息检索', '信息楼 · 303', 4, '10:30', '12:10', 'lavender'],
    ['论文研讨', '信息楼 · 502', 4, '19:00', '20:40', 'peach'],
    ['专业实验', '实验楼 · 204', 5, '08:30', '11:15', 'sky']
  ];
  s.courses = names.map(([name, location, day, start, end, color]) => ({id: uid(), name, location, day, start, end, weeks: parseWeeks('1-18'), color, confirmed: true, source: 'demo'}));
  return s;
}
