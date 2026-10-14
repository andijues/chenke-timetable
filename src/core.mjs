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
  const s = String(text ?? '').trim().replace(/[（(]/g, '[').replace(/[）)]/g, ']').replace(/[～~—–至]/g, '-').replace(/[，、；;]/g, ',');
  if (!s || /每周|全周|全部/.test(s)) return Array.from({length: max}, (_, i) => i + 1);
  const odd = /单/.test(s), even = /双/.test(s);
  const nums = new Set();
  for (const match of s.matchAll(/(\d+)\s*(?:-\s*(\d+))?/g)) {
    const start = +match[1], end = +(match[2] ?? match[1]);
    if (start < 1 || end > 60 || end < start) continue;
    for (let i = start; i <= end; i++) if ((!odd || i % 2) && (!even || i % 2 === 0)) nums.add(i);
  }
  if (!nums.size && (odd || even)) for (let i = 1; i <= max; i++) if ((odd && i % 2) || (even && i % 2 === 0)) nums.add(i);
  return [...nums].sort((a, b) => a - b);
}
export function formatWeeks(weeks) {
  if (!weeks?.length) return '未指定周次';
  const a = [...new Set(weeks)].sort((x, y) => x - y); const chunks = [];
  for (let i = 0; i < a.length;) { let j = i; while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++; chunks.push(j > i ? `${a[i]}-${a[j]}` : `${a[i]}`); i = j + 1; }
  return `${chunks.join(',')}周`;
}
export function createState(today = dateParts().date) {
  return {version: SCHEMA_VERSION, courses: [], exceptions: [], settings: {week1: mondayOf(today), totalWeeks: 18, leadMinutes: 90, morningEnd: '12:00', enabled: false, timezone: ZONE, periods: defaultPeriods.map(([start, end]) => ({start, end}))}, modifiedAt: new Date().toISOString(), demo: false};
}
export function validateCourse(c) {
  const errors = [];
  if (!c.name?.trim()) errors.push('请输入课程名称');
  if (!Number.isInteger(c.day) || c.day < 1 || c.day > 7) errors.push('请选择星期');
  if (!Number.isFinite(minutes(c.start)) || !Number.isFinite(minutes(c.end)) || minutes(c.end) <= minutes(c.start)) errors.push('结束时间应晚于开始时间');
  if (!Array.isArray(c.weeks) || !c.weeks.length || c.weeks.some(w => !Number.isInteger(w) || w < 1 || w > 60)) errors.push('请填写有效周次，例如 1-16 或 1-16单');
  if (c.date && !validDate(c.date)) errors.push('补课日期无效');
  if (c.name?.length > 100 || c.location?.length > 160) errors.push('课程名称或地点过长');
  return errors;
}
export function validateState(raw) {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.courses) || !Array.isArray(raw.exceptions) || !raw.settings) throw Error('备份格式不正确或版本不支持');
  if (raw.courses.length > 2000 || raw.exceptions.length > 1000) throw Error('备份内容过多');
  const s = raw.settings;
  if (!validDate(s.week1) || dayOfWeek(s.week1) !== 1) throw Error('第 1 周起点必须是星期一');
  if (!Number.isInteger(s.totalWeeks) || s.totalWeeks < 1 || s.totalWeeks > 60) throw Error('学期周数应在 1-60 之间');
  if (!Number.isInteger(s.leadMinutes) || s.leadMinutes < 0 || s.leadMinutes > 1440 || !Number.isFinite(minutes(s.morningEnd))) throw Error('起床规则不正确');
  if (s.timezone !== ZONE || typeof s.enabled !== 'boolean') throw Error('当前版本仅支持中国标准时间，闹钟开关应为布尔值');
  if (!Array.isArray(s.periods) || s.periods.length < 1 || s.periods.length > 20 || s.periods.some(p => !Number.isFinite(minutes(p.start)) || minutes(p.end) <= minutes(p.start))) throw Error('节次时间不正确');
  const ids = new Set();
  for (const c of raw.courses) {
    if (validateCourse(c).length || typeof c.confirmed !== 'boolean' || !c.id || ids.has(c.id)) throw Error('备份含有无效或重复课程');
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
    return week >= 1 && week <= state.settings.totalWeeks && c.day === day && c.weeks.includes(week);
  }).sort((a, b) => minutes(a.start) - minutes(b.start) || a.name.localeCompare(b.name, 'zh'));
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
