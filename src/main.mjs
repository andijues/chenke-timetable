import {uid,createState,makeDemo,weekdays,minutes,clock,dateParts,addDays,mondayOf,dayOfWeek,weekNumber,parseWeeks,formatWeeks,coursesOn,morningPlan,planAlarms,courseStatus,conflicts,validateCourse,validateState,icsExport,weeksForRule,periodsForDay,validatePeriods,resolveCourseTime,validDate} from './core.mjs';
import {parseTimetable} from './parser.mjs';
import {importDocument} from './importer.mjs';
import {platform,callNative,capabilities,dispatchAlarms} from './bridge.mjs';
import {inferWeekRule,weekSummary,weeksEditor,coursePeriodControls,resizePeriods,periodChart,periodSliders,periodsEditor} from './schedule-ui.mjs';
import {harmonyAuthorization} from './harmony-ui.mjs';

const KEY='chenke.state.v1'; const $=s=>document.querySelector(s);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18"/>',upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',settings:'<path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>',arrow:'<path d="m9 5 7 7-7 7"/>',plus:'<path d="M12 5v14M5 12h14"/>',check:'<path d="m5 12 4 4L19 6"/>',book:'<path d="M12 6v15M12 6C9 3 6 3 3 4v15c3-1 6-1 9 2 3-3 6-3 9-2V4c-3-1-6-1-9 2Z"/>',moon:'<path d="M20 14A9 9 0 0 1 10 4a9 9 0 1 0 10 10Z"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v3h16v-3"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v2M12 21v2M1 12h2M21 12h2M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2"/>',trash:'<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>'};
const icon=(name,cls='')=>`<svg class="icon ${cls}" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]??icons.book}</svg>`;
let state=createState();
try {const raw=localStorage.getItem(KEY);if(raw)state=validateState(JSON.parse(raw));} catch {setTimeout(()=>toast('本机记录无法读取，请从备份恢复。原记录未覆盖。'),300);}
let route='home', view='week', selected=dateParts().date, showAllDays=false;
let importResult=null, importBusy=false, progress='', nativeStatus={mode:'pending',scheduled:0,message:'尚未启用系统闹钟'}, nativeCaps=null;
let syncFingerprint='', syncRunning=false, syncAgain=false, clockRequestBusy=false;
let nativeTestFeedback=null, nativeTestBusy=false, nativeResumeTimer=null, editorInitial='';
let periodDraft=null, periodScope='common', periodActive=0;
const root=$('#app');
function updateMobileViewport(){
  const viewport=window.visualViewport;
  if(!viewport||viewport.scale>1.05)return;
  const style=document.documentElement.style;
  style.setProperty('--visual-viewport-height',`${viewport.height}px`);
  style.setProperty('--visual-viewport-top',`${viewport.offsetTop}px`);
  const active=document.activeElement;
  const editing=active?.matches('textarea,input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file])');
  const keyboard=Boolean(editing&&window.innerHeight-viewport.height>150);
  document.documentElement.classList.toggle('keyboard-open',keyboard);
  if(keyboard&&active)requestAnimationFrame(()=>active.scrollIntoView({block:'nearest'}));
}
window.visualViewport?.addEventListener('resize',updateMobileViewport);
window.visualViewport?.addEventListener('scroll',updateMobileViewport);
document.addEventListener('focusin',updateMobileViewport);
document.addEventListener('focusout',()=>requestAnimationFrame(updateMobileViewport));
updateMobileViewport();
function toast(text) {$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),4500);}
function updateNativeNavigation(){if(platform()==='harmony')callNative('setBackState',{handled:route!=='home'||$('#course-dialog').open}).catch(()=>{});}
function updateNativeCaps(c){if(platform()==='harmony'&&c&&'reminderGranted'in c)nativeCaps={...nativeCaps,...c};}
async function harmonyTest(action='testAlarm'){
  if(nativeTestBusy)return;nativeTestBusy=true;render();
  try{const result=await callNative(action);updateNativeCaps(result);nativeTestFeedback={...result,failed:result.failed||result.mode==='blocked'};if(result.failed)nativeStatus=result;}
  catch(e){nativeTestFeedback={failed:true,message:e.message};}
  finally{nativeTestBusy=false;render();$('.harmony-feedback')?.scrollIntoView({block:'nearest'});}
}
function save() {state.modifiedAt=new Date().toISOString();try{localStorage.setItem(KEY,JSON.stringify(state));}catch{toast('保存空间不足，请导出备份后清理文件。');}if(platform()!=='web')callNative('saveState',{state}).catch(e=>toast(`设备保存失败：${e.message}`));render();sync();}
async function sync(force=false) {
  const plans=planAlarms(state);const fingerprint=JSON.stringify([androidClockMode(),plans.map(p=>[p.id,p.fireAt,p.course])]);
  if(!force&&fingerprint===syncFingerprint)return;
  if(syncRunning){syncAgain=true;return;}
  syncRunning=true;nativeStatus={mode:'pending',scheduled:0,message:'正在更新起床计划…'};if(route==='home'||route==='alarms')render();
  try {nativeStatus=await dispatchAlarms(plans,androidClockMode()?'clock':'app');updateNativeCaps(nativeStatus);if(!nativeStatus.failed)syncFingerprint=fingerprint;}catch(e){nativeStatus={mode:'error',scheduled:0,message:e.message};}finally{syncRunning=false;if(route==='alarms'||route==='home')render();if(syncAgain){syncAgain=false;sync();}}
}
function dateLabel(date,short=false){const d=new Date(`${date}T12:00:00Z`);return `${d.getUTCMonth()+1}${short?'/':'月'}${d.getUTCDate()}${short?'':'日'}`;}
function weekLabel(){const w=weekNumber(selected,state.settings.week1);return w<1?'学期开始前':w>state.settings.totalWeeks?'学期已结束':`第 ${w} 周`;}
function header() {return `<header class="topbar"><a class="brand" href="#home" aria-label="晨课课表主页"><span class="brand-mark">${icon('calendar')}</span><strong>晨课<span>我的时间，心里有数</span></strong></a><button class="button compact" data-action="import">${icon('upload')}<span>导入课表</span></button></header>`;}
function nav(){return `<nav class="bottom-nav" aria-label="主导航">${[['home','calendar','课表'],['import','upload','导入'],['alarms','bell','闹钟'],['settings','settings','设置']].map(([id,i,t])=>`<button data-route="${id}" class="nav-item ${route===id?'active':''}" ${route===id?'aria-current="page"':''}>${icon(i)}<span>${t}</span></button>`).join('')}</nav>`;}
function demoBanner(){return state.demo?`<div class="demo-strip">${icon('book')}<span>演示课表 · 不会设置闹钟</span><button class="text-button" data-action="new">开始自己的课表${icon('arrow')}</button></div>`:'';}
function emptyHome(){return `<section class="empty-home"><div class="empty-graphic">${icon('calendar')}</div><h1>把课表放进生活里。</h1><p>导入 PDF 或图片，也可以直接手动排课。<br>先设好学期与节次，时间和周次都由你调整。</p><button class="button" data-action="import">${icon('upload')}导入我的课表</button><button class="button secondary" data-action="add">${icon('plus')}手动添加课程</button><button class="text-button" data-route="settings">设置学期与节次${icon('arrow')}</button><button class="text-button" data-action="demo">先体验演示课表${icon('arrow')}</button><div class="empty-notes"><span>${icon('check')}文件在本机识别</span><span>${icon('check')}课程随时可修改</span></div></section>`;}
function wakeStrip(){const tomorrow=addDays(dateParts().date,1);const plan=morningPlan(state,tomorrow);const arranged=state.settings.enabled&&!state.demo&&['alarm','system-reminder'].includes(nativeStatus.mode)&&nativeStatus.scheduled>0;const status=state.demo?'演示预览':!state.settings.enabled?(androidClockMode()?'起床计划未启用':'闹钟未启用'):androidClockMode()?(nativeStatus.mode==='error'?'时钟交接未完成':plan.status==='review'?'晨课还需确认':plan.status==='rest'?'上午无课，无需交接':nativeStatus.lastClockRequest&&!nativeStatus.lastClockRequest.test&&Date.parse(nativeStatus.lastClockRequest.fireAt)===Date.parse(plan.alarmAt)?'请在时钟确认已保存':'待交给手机时钟'):platform()==='web'?'网页未设置系统闹钟':nativeStatus.mode==='blocked'?'等待系统提醒授权':nativeStatus.mode==='error'?'系统调度失败':arranged?'系统已安排':'等待系统调度';return `<div class="wake-strip"><span class="wake-symbol">${icon(plan.status==='rest'?'moon':'sun')}</span><div class="wake-copy"><strong>${plan.status==='ready'?'明早，建议起床时间':plan.status==='review'?'明早的课程还需确认':'明早，留给自己'}</strong><span>${plan.status==='ready'?`${escape(plan.firstCourse.name)} ${plan.firstCourse.start} · 提前 ${state.settings.leadMinutes} 分钟`:plan.status==='review'?'校对并确认晨课后，才会生成闹钟':'上午无课，不安排起床闹钟'}</span><small class="wake-status">${status}</small></div><button class="wake-time" data-route="alarms" aria-label="查看明早起床计划">${plan.alarmTime??'休息'}${icon('arrow')}</button></div>`;}
function home(){
  if(!state.courses.length)return emptyHome();
  return `${demoBanner()}<div class="page-heading"><div><h1>${dateLabel(selected)}<span>${weekdays[dayOfWeek(selected)-1]}</span></h1><p>${weekLabel()}<span class="dot-separator">·</span>${selected===dateParts().date?'今天':selected} <span class="now-clock">现在 ${dateParts().time}</span></p></div><button class="button secondary compact" data-action="add">${icon('plus')}添加课程</button></div>${wakeStrip()}<div class="workspace"><section class="schedule-panel"><div class="schedule-toolbar"><div class="segmented" aria-label="课表视图"><button data-view="week" class="${view==='week'?'active':''}">周课表</button><button data-view="day" class="${view==='day'?'active':''}">今日</button></div><div class="week-navigation"><button class="icon-button previous" data-action="previous" aria-label="前一周">${icon('arrow')}</button><button class="text-button" data-action="today">今天</button><button class="icon-button" data-action="next" aria-label="后一周">${icon('arrow')}</button></div></div><div class="week-jump"><label>查看周次<select id="view-week" aria-label="查看学期周次"><option value="0" ${weekNumber(selected,state.settings.week1)<1||weekNumber(selected,state.settings.week1)>state.settings.totalWeeks?'selected':''}>按当前日期</option>${Array.from({length:state.settings.totalWeeks},(_,i)=>`<option value="${i+1}" ${weekNumber(selected,state.settings.week1)===i+1?'selected':''}>第 ${i+1} 周${(i+1)%2?' · 单周':' · 双周'}</option>`).join('')}</select></label><span>${dateLabel(mondayOf(selected),true)}–${dateLabel(addDays(mondayOf(selected),6),true)}</span></div>${view==='week'?weekGrid():dayList(selected)}${view==='week'?`<div class="schedule-foot"><span><i class="now-dot"></i>指针为中国标准时间的当前时刻</span><button class="text-button" data-action="all-days">${showAllDays?'显示五天':'显示周末'}</button></div>`:''}</section><aside class="day-aside"><div class="aside-heading"><h2>今天的安排</h2><span>${coursesOn(state,dateParts().date).length} 门课</span></div>${dayList(dateParts().date,true)}<div class="aside-note">${icon('moon')}<p>好的早晨，<br>从心里有数开始。</p></div></aside></div>`;
}
function weekGrid(){
  const monday=mondayOf(selected);const cols=showAllDays?7:5;
  const today=dateParts();const todayIndex=(Date.parse(`${today.date}T12:00:00Z`)-Date.parse(`${monday}T12:00:00Z`))/86400000;
  const weekCourses=Array.from({length:cols},(_,i)=>coursesOn(state,addDays(monday,i))).flat();
  const times=weekCourses.flatMap(c=>[minutes(c.start),minutes(c.end)]);const showNow=todayIndex>=0&&todayIndex<cols;
  const first=Math.min(7*60,Math.floor(Math.min(...times,...(showNow?[today.minute]:[]),7*60)/60)*60),last=Math.max(22*60,Math.ceil(Math.max(...times,...(showNow?[today.minute]:[]),22*60)/60)*60);
  const lines=[];for(let t=first;t<=last;t+=60)lines.push(`<div class="hour-row" style="top:${(t-first)/(last-first)*100}%"><span>${clock(t)}</span></div>`);
  const cells=Array.from({length:cols},(_,i)=>{
    const date=addDays(monday,i);const courses=coursesOn(state,date);return `<div class="day-column ${today.date===date?'is-today':''}" style="--day:${i}">${courses.map(c=>{const start=Math.max(first,minutes(c.start)),end=Math.min(last,minutes(c.end));if(end<=start)return '';return `<button class="course-block ${escape(c.color??'mint')} ${c.confirmed?'':'unconfirmed'}" data-edit="${escape(c.id)}" style="top:${(start-first)/(last-first)*100}%;height:${(end-start)/(last-first)*100}%" aria-label="编辑 ${escape(c.name)}，${c.start} 至 ${c.end}"><strong>${escape(c.name)}</strong><span>${escape(c.location||'地点待补充')}</span><small>${c.start}–${c.end}${c.confirmed?'':' · 待确认'}</small></button>`;}).join('')}</div>`;
  }).join('');
  const position=(today.minute-first)/(last-first)*100;
  const pointer=showNow?`<div class="time-pointer" style="top:${position}%;--today:${todayIndex}" aria-label="现在 ${today.time}"><i></i><b></b></div>`:'';
  const timeTag=showNow?`<span class="current-time-tag" style="top:${position}%">${today.time}</span>`:'';
  return `<div class="grid-scroll ${cols===7?'seven-days':''}"><div class="timetable" style="--columns:${cols};--hours:${(last-first)/60};--grid-height:${Math.max(600,(last-first)/60*50)}px"><div class="day-headers"><span class="time-label">时间</span>${Array.from({length:cols},(_,i)=>{const date=addDays(monday,i);return `<button class="day-header ${today.date===date?'today':''}" data-date="${date}"><span>${weekdays[i]}</span><strong>${new Date(`${date}T12:00:00Z`).getUTCDate()}</strong></button>`;}).join('')}</div><div class="grid-body"><div class="hours">${lines.join('')}${timeTag}</div><div class="course-grid">${cells}${pointer}</div></div></div></div><p class="grid-swipe-hint">横向滑动查看整周 · 点击课程可编辑</p>`;
}
function dayList(date,aside=false){const list=coursesOn(state,date);const now=dateParts();if(!list.length)return `<div class="day-empty">${icon('moon')}<strong>这一天没有课</strong><span>休息、阅读，或者留一点空白。</span></div>`;return `<div class="daily-list ${aside?'aside-list':''}">${list.map(c=>`<button class="daily-course ${escape(c.color??'mint')}" data-edit="${escape(c.id)}"><span class="daily-time">${c.start}<small>${c.end}</small></span><span class="daily-info"><strong>${escape(c.name)}</strong><small>${icon('pin')}${escape(c.location||'地点待补充')}</small></span><span class="course-state">${!c.confirmed?'待确认':date===now.date?({upcoming:'待上课',ongoing:'进行中',done:'已结束'}[courseStatus(c,now.minute)]):formatWeeks(c.weeks)}</span></button>`).join('')}</div>`;}
function importView(){return `<div class="page-heading"><div><h1>导入课表</h1><p>先识别，再校对。把准确留给你。</p></div></div><section class="import-layout"><div class="import-main"><label class="dropzone ${importBusy?'busy':''}" for="file-input">${icon('upload')}<strong>${importBusy?escape(progress):'选择 PDF 或课表图片'}</strong><span>${importBusy?'识别在本机进行，请保持页面打开':'支持文字 PDF、扫描 PDF、PNG / JPG · 最大 30 MB'}</span><span class="button ${importBusy?'disabled':''}">${importBusy?'正在识别…':'选择文件'}</span><input id="file-input" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" ${importBusy?'disabled':''}></label><div class="import-alternative"><h2>也可以粘贴课表文字</h2><textarea id="paste-text" rows="5" placeholder="高等数学&#10;周一 08:30-10:10&#10;1-16周&#10;理学楼 A302">${escape(importResult?.rawText??'')}</textarea><button class="button secondary" data-action="parse-text">识别文字</button></div>${importResult?reviewView():''}</div><aside class="import-guide"><h2>导入前，留意这几件事</h2><div><strong>表格越清楚，识别越准确</strong><p>图片尽量正拍、完整，避免倾斜和遮挡。扫描页会自动转入 OCR。</p></div><div><strong>节次由你定义</strong><p>只有“第 1–2 节”时，按设置里的节次表推算时间。上课时间不同，可以逐门修改。</p><button class="text-button" data-route="settings">调整节次表${icon('arrow')}</button></div><div><strong>确认后，才安排闹钟</strong><p>星期、周次和时间都能编辑。导入过程保留原文，便于对照。</p></div></aside></section>`;}
function reviewView(){const cs=importResult.courses;return `<section class="review-section"><div class="section-heading"><h2>识别结果<span>${cs.length} 项待校对</span></h2><button class="text-button" data-action="add-import">${icon('plus')}补充课程</button></div><p class="review-description">${escape(importResult.name??'粘贴文字')} · ${escape(importResult.kind==='ocr'?'图片 OCR':'文字提取')}。每项保留原文；不同周次的时段可能分开列出。</p>${importResult.warnings.map(w=>`<p class="notice">${escape(w)}</p>`).join('')}<div class="review-list">${cs.map((c,i)=>`<article class="review-row"><span class="review-index">${i+1}</span><div><strong>${escape(c.name)}</strong><p>${weekdays[c.day-1]} · ${c.start}–${c.end} · ${formatWeeks(c.weeks)}</p>${c.location?`<p>地点：${escape(c.location)}</p>`:''}<small>${escape(c.reasons?.join('；')||'请对照原文核对')}</small></div><button class="button secondary compact" data-review="${escape(c.id)}">校对</button><button class="icon-button" data-remove-review="${escape(c.id)}" aria-label="移除识别项 ${escape(c.name)}">${icon('close')}</button></article>`).join('')}</div>${cs.length?`<div class="review-actions"><button class="button" data-action="commit-import">加入课表，继续确认</button><span>加入后仍为待确认课程，不会直接设置闹钟。</span></div>`:''}<details class="raw-details"><summary>查看完整识别原文</summary><pre>${escape(importResult.rawText)}</pre></details></section>`;}
function androidClockMode(){return platform()==='android'&&state.settings.androidAlarmMode!=='app';}
function clockModeChooser(){
  if(platform()!=='android')return '';
  return `<label class="clock-mode-label" for="android-alarm-mode">响铃方式<select id="android-alarm-mode"><option value="clock" ${androidClockMode()?'selected':''}>手机系统时钟</option><option value="app" ${androidClockMode()?'':'selected'}>晨课后台提醒</option></select></label>`;
}
function systemClockPanel(){
  const plan=planAlarms(state).sort((a,b)=>Date.parse(a.fireAt)-Date.parse(b.fireAt))[0];
  const delta=plan?Date.parse(plan.fireAt)-Date.now():0;
  const ready=Boolean(plan&&delta>=60000&&delta<=86400000);
  const last=nativeStatus.lastClockRequest;
  const changed=Boolean(last&&!last.test&&plan&&Date.parse(last.fireAt)!==Date.parse(plan.fireAt)&&Date.parse(last.fireAt)>Date.now());
  const detail=state.demo?'演示课程不交给时钟。请先添加自己的课程。':!state.settings.enabled?'开启下方计划开关，确认课程后会显示下一次起床时间。':!plan?'未来 28 天没有已确认的晨课起床计划。':!ready?'系统时钟接口不能指定课程日期，请临近起床前一天再交接。':`${plan.alarmDate} · ${plan.course} · ${plan.courseStart} 上课`;
  return `<section class="clock-handoff" aria-labelledby="clock-handoff-title"><h2 id="clock-handoff-title">交给手机时钟</h2><div class="clock-next"><strong>${plan?escape(plan.alarmTime):'等待课程'}</strong><span>${plan?'起床 · 北京时间':'先计算起床时间'}</span></div><p>${escape(detail)}</p><div class="alarm-actions"><button class="button primary" data-action="clock-next" ${!ready||clockRequestBusy?'disabled':''}>${clockRequestBusy?'正在打开时钟…':'交给系统时钟'}</button><button class="button secondary" data-action="clock-test" ${clockRequestBusy?'disabled':''}>测试时钟（1–2 分钟）</button><button class="text-button" data-action="clock-show" ${clockRequestBusy?'disabled':''}>查看时钟闹钟</button></div>${['error','clock-request'].includes(nativeStatus.mode)?`<p class="clock-feedback ${nativeStatus.mode==='error'?'error':''}" role="${nativeStatus.mode==='error'?'alert':'status'}">${escape(nativeStatus.message)}</p>`:''}${last?`<p class="clock-last" role="status">${changed?'起床计划已变更，请在时钟里修改旧闹钟。':'上次打开时钟：'}${escape(last.localDate)} ${escape(last.localTime)}。请在时钟列表中确认已保存。</p>`:''}<p class="helper">每次交接下一次的一次性闹钟，需在时钟里确认保存。课程改动后，时钟里的旧闹钟也要手动修改或删除。</p></section>`;
}
async function openSystemClock(action){
  if(clockRequestBusy)return;
  const plan=planAlarms(state).sort((a,b)=>Date.parse(a.fireAt)-Date.parse(b.fireAt))[0];
  if(action==='openClockAlarm'&&!plan){toast('没有待交接的起床计划，请先确认课程并启用计划');return;}
  clockRequestBusy=true;render();
  try{const result=await callNative(action,action==='openClockAlarm'?{plan}:{});if(result.mode)nativeStatus=result;else toast(result.message);}
  catch(error){nativeStatus={mode:'error',scheduled:0,message:error.message};}
  finally{clockRequestBusy=false;render();document.querySelector('.clock-feedback')?.scrollIntoView({block:'nearest'});}
}
function alarmExplanation(){
  if(platform()==='harmony')return '获得系统代理提醒授权后，可由鸿蒙系统负责响铃。先检查权限，再测试退出应用和锁屏后的提醒；未通过测试前，请保留手机时钟闹钟。';
  if(androidClockMode())return '保存后由接收的时钟应用负责响铃。请确认打开的是手机自带时钟，并测试清理后台后的响铃；卓易通是否支持转接需以本机结果为准。';
  if(platform()==='android')return '由 Android 系统准确闹钟触发原生响铃。请允许通知、“闹钟和提醒”及锁屏全屏显示，并检查闹钟音量；如手机限制后台运行，请在系统设置中允许晨课自启动，再退出应用做锁屏测试。';
  return '网页只显示起床计划。安装手机原生版后，才能由系统在锁屏和退出应用后负责响铃。';
}
function alarmsView(){const today=dateParts().date;const next=Array.from({length:7},(_,i)=>morningPlan(state,addDays(today,i)));return `<div class="page-heading"><div><h1>起床，刚刚好。</h1><p>只为上午的第一节课留好时间。</p></div>${icon('sun','heading-icon')}</div><div class="alarm-layout"><section class="alarm-main">${clockModeChooser()}${androidClockMode()?systemClockPanel():''}${platform()==='harmony'?harmonyAuthorization(nativeCaps,nativeTestFeedback,nativeTestBusy):''}<div class="alarm-rule"><div class="rule-top"><h2>${androidClockMode()?'按课表计算起床计划':'自动安排起床闹钟'}</h2><label class="switch"><input type="checkbox" id="alarm-enabled" ${state.settings.enabled?'checked':''} ${state.demo?'disabled':''} aria-label="${androidClockMode()?'按课表计算起床计划':'自动安排起床闹钟'}"><span></span></label></div><p>${state.demo?'演示课表不发布闹钟，先导入你的真实课表。':androidClockMode()?'启用后计算未来 28 天的计划，交给时钟需逐次确认。':'启用后，根据已确认课程更新未来 28 天的起床计划。'}</p><div class="lead-display"><span>提前</span><strong id="lead-value">${state.settings.leadMinutes}</strong><span>分钟起床</span></div><input id="lead-slider" type="range" min="0" max="240" step="5" value="${Math.min(240,state.settings.leadMinutes)}" aria-label="提前起床分钟"><div class="range-labels"><span>跟随首课</span><span>提前 4 小时</span></div><label class="inline-field">精确提前量<input id="lead-input" type="number" inputmode="numeric" aria-label="精确提前起床分钟" min="0" max="1440" value="${state.settings.leadMinutes}"><span>分钟</span></label><div class="rule-example">${icon('clock')}<span>例如 08:30 上课 → ${clock((510-state.settings.leadMinutes+1440)%1440)} 起床${state.settings.leadMinutes>510?'（前一天）':''}</span></div></div><div class="native-status ${nativeStatus.mode==='error'?'error':''}" role="status" aria-live="polite">${icon(nativeStatus.mode==='alarm'||nativeStatus.mode==='system-reminder'?'check':'bell')}<div><strong>${nativeStatus.mode==='clock-request'?'请在时钟中确认保存':nativeStatus.mode==='clock-preview'?'待交给系统时钟':nativeStatus.mode==='alarm'?'系统闹钟已调度':nativeStatus.mode==='system-reminder'?'系统代理提醒已调度':nativeStatus.mode==='preview'?'当前为网页起床预览':nativeStatus.mode==='notification'?'已安排普通通知提醒':nativeStatus.mode==='error'?'闹钟尚未设置':nativeStatus.mode==='blocked'?'等待系统提醒授权':'系统调度状态'}</strong><p>${escape(nativeStatus.message)}</p>${nativeStatus.scheduled?`<small>已安排 ${nativeStatus.scheduled} 个 · 发布窗口 28 天</small>`:''}</div></div><div class="alarm-actions"><button class="button secondary" data-action="sync">${androidClockMode()?'刷新起床计划':'检查权限并更新'}</button>${androidClockMode()?'':`<button class="text-button" data-action="test-alarm" ${nativeTestBusy||platform()==='harmony'&&nativeCaps?.reminderGranted===false?'disabled':''}>${nativeTestBusy?'正在提交测试…':'测试 1 分钟后响铃'}</button>`}</div><p class="helper">${escape(alarmExplanation())}</p></section><section class="alarm-week"><div class="section-heading"><h2>接下来的一周</h2><span>按具体日期计算</span></div>${next.map(p=>`<div class="alarm-day"><div><strong>${p.date===today?'今天':weekdays[dayOfWeek(p.date)-1]}</strong><small>${dateLabel(p.date,true)}</small></div><div class="alarm-day-course"><strong>${p.firstCourse?escape(p.firstCourse.name):'上午无课'}</strong><small>${p.status==='ready'?`${p.firstCourse.start} 上课 · 提前 ${state.settings.leadMinutes} 分钟`:p.reason}</small></div><span class="alarm-day-time ${p.status==='rest'?'rest':''}">${p.alarmTime??(p.status==='review'?'待确认':'休息')}</span></div>`).join('')}<p class="helper">未确认晨课、停课日和上午无课日不会发布闹钟。课程修改后会重新计算；请定期打开应用刷新未来日期。</p></section></div>`;}
function semesterPreview() {
  const form=$('#settings-form'), date=form?.elements.week1.value??(state.settings.semesterStart??state.settings.week1), total=+(form?.elements.totalWeeks.value??state.settings.totalWeeks);
  if(!validDate(date)||!Number.isInteger(total)||total<1||total>60)return '选择开学日期和总周数，查看学期范围。';
  const monday=mondayOf(date), current=weekNumber(dateParts().date,monday);
  return '第 1 周：'+monday+' 至 '+addDays(monday,6)+'；常规课程从 '+date+' 开始。学期至 '+addDays(monday,total*7-1)+'，'+(current<1?'尚未开学':current>total?'已结束':'今天为第 '+current+' 周')+'。';
}
function settingsView(){
  const s=state.settings;
  if(!periodDraft)periodDraft=structuredClone({...s,periodsByDay:s.periodsByDay??{}});
  return `<div class="page-heading"><div><h1>按你的节奏</h1><p>先定学期，再排节次。每门课的日期和时间都能校正。</p></div></div>
  <div class="settings-layout"><section class="settings-section">
    <h2>学期与时间</h2><form id="settings-form" class="settings-form">
      <label>第 1 周开始上课的日期<input name="week1" type="date" value="${s.semesterStart??s.week1}" required><small>可以选择任意星期，所属周的周一作为第 1 周起点。</small></label>
      <label>学期周数<input name="totalWeeks" type="number" inputmode="numeric" min="1" max="60" value="${s.totalWeeks}" required></label>
      <label>上午结束时间<input name="morningEnd" type="time" value="${s.morningEnd}" required><small>首课早于这个时间，才算上午有课。</small></label>
      <p id="semester-preview" class="semester-preview">${escape(semesterPreview())}</p>
      <button class="button" type="submit">保存学期设置</button>
    </form>
    <h2>每天的节次与时间</h2><p class="helper">点时间轴选择一节，拖动或精确填写时间。可设通用表，也可单独设置某个星期。</p>
    <div id="period-editor">${periodsEditor(periodDraft,periodScope,periodActive)}</div>
  </section><section class="settings-section">
    <div class="section-heading"><h2>课程管理</h2><button class="button secondary compact" data-action="add">${icon('plus')}添加课程</button></div>
    <p class="helper">全部 ${state.courses.length} 门课程都在这里，包括本周没有安排的课程。</p>
    <div class="course-management">${state.courses.length?[...state.courses].sort((a,b)=>a.day-b.day||minutes(a.start)-minutes(b.start)).map(c=>{const time=resolveCourseTime(c,s);return `<button class="managed-course" data-edit="${escape(c.id)}"><span class="course-color ${escape(c.color??'mint')}"></span><span><strong>${escape(c.name)}</strong><small>${weekdays[c.day-1]} · ${time.start}–${time.end}${c.periodRange?` · 第${c.periodRange.start}–${c.periodRange.end}节`:''}</small><small>${c.date?c.date+' · 单次课程':escape(formatWeeks(c.weeks))}${c.confirmed?'':' · 待确认'}</small></span>${icon('arrow')}</button>`;}).join(''):'<p class="helper">从这里手动添加，或导入 PDF 后逐门校对。</p>'}</div>
    <h2>停课、放假与调课</h2><form id="exception-form" class="exception-form"><label>日期<input type="date" name="date" required></label><label>安排<select name="type"><option value="skip">这天停课 / 放假</option><option value="replaceDay">按其他星期上课</option></select></label><label>调课到<select name="day">${weekdays.map((d,i)=>`<option value="${i+1}">${d}</option>`).join('')}</select></label><label>备注<input name="note" maxlength="100" placeholder="例如：国庆停课"></label><button class="button secondary" type="submit">添加例外日期</button></form>
    <div class="exception-list">${state.exceptions.length?state.exceptions.map((e,i)=>`<div><span><strong>${e.date}</strong> ${e.type==='skip'?'停课 / 放假':e.type==='cancelCourse'?'单门停课':`按${weekdays[e.day-1]}上课`}<small>${escape(e.note??'')}</small></span><button class="icon-button" data-delete-exception="${i}" aria-label="删除 ${e.date} 例外">${icon('close')}</button></div>`).join(''):'<p class="helper">还没有例外日期。单次补课可在添加课程时指定日期。</p>'}</div>
    <h2>数据与备份</h2><div class="data-actions"><button class="button secondary" data-action="backup">${icon('download')}导出备份</button><label class="button secondary restore-label">恢复备份<input id="restore-input" type="file" accept="application/json,.json"></label><button class="button secondary" data-action="ics">导出日历 .ics</button></div><p class="helper">备份包含课程、节次和学期。日历用于查看课程，不等于起床闹钟。</p><div class="danger-zone"><button class="text-button danger" data-action="clear">${icon('trash')}清空课表与本应用闹钟</button></div>
  </section></div>`;
}
function periodList(edit=false){
  if(!periodDraft)periodDraft=structuredClone({...state.settings,periodsByDay:state.settings.periodsByDay??{}});
  if(periodScope==='common')return periodDraft.periods;
  if(edit&&!Object.hasOwn(periodDraft.periodsByDay,periodScope))periodDraft.periodsByDay[periodScope]=structuredClone(periodDraft.periods);
  return periodsForDay(periodDraft,+periodScope);
}
function refreshPeriods(){
  periodActive=Math.max(0,Math.min(periodActive,periodList().length-1));
  $('#period-editor').innerHTML=periodsEditor(periodDraft,periodScope,periodActive);
}
function refreshPeriodPreview(keepSlider=false){
  const periods=periodList();
  $('#period-chart').innerHTML=periodChart(periods,periodActive);
  if(!keepSlider)$('#period-slider-panel').innerHTML=periodSliders(periods,periodActive);
  $('#period-error').textContent=validatePeriods(periods,periodScope!=='common')[0]??'';
  if(periodScope!=='common')$('#period-scope-note').textContent=weekdays[+periodScope-1]+'单独设置；保存后应用。节次数是可排课时段数，并非当天实际课程数。';
}
function applyWeekSelection(weeks,rule,rewriteText=true,updateBounds=true){
  const form=$('#course-form'); if(!form)return;
  form.dataset.weekRule=JSON.stringify(rule);
  if(rewriteText)form.elements.weeks.value=weeks.length?formatWeeks(weeks).replace('周',''):'';
  if(updateBounds){$('#week-start').value=rule.start;$('#week-end').value=rule.end;}
  form.querySelectorAll('[data-week]').forEach(button=>button.setAttribute('aria-pressed',String(weeks.includes(+button.dataset.week))));
  form.querySelectorAll('[data-week-pattern]').forEach(button=>button.setAttribute('aria-pressed',String(rule.pattern===button.dataset.weekPattern)));
  $('#week-summary').textContent=weekSummary(weeks,state.settings,+form.elements.day.value);
}
function updateWeeksFromRange(pattern){
  const rule={start:+$('#week-start').value,end:+$('#week-end').value,pattern:pattern??JSON.parse($('#course-form').dataset.weekRule).pattern};
  if(rule.pattern==='custom')rule.pattern='all';
  applyWeekSelection(weeksForRule(rule,state.settings.totalWeeks),rule,true,false);
}
function refreshCourseTiming(range){
  const form=$('#course-form'), day=+form.elements.day.value, mode=form.elements.timeMode.value;
  const previous=range??{start:+form.elements.periodStart?.value||1,end:+form.elements.periodEnd?.value||1};
  $('#course-period-controls').innerHTML=coursePeriodControls(state.settings,day,previous);
  $('#course-period-controls').hidden=mode!=='periods';
  form.querySelectorAll('[data-time-mode]').forEach(button=>button.setAttribute('aria-pressed',String(mode===button.dataset.timeMode)));
  form.elements.start.readOnly=mode==='periods';form.elements.end.readOnly=mode==='periods';
  updateCourseTimes();
}
function updateCourseTimes(){
  const form=$('#course-form');if(form.elements.timeMode.value!=='periods')return;
  const periods=periodsForDay(state.settings,+form.elements.day.value), first=+form.elements.periodStart?.value, last=+form.elements.periodEnd?.value;
  if(periods[first-1]&&periods[last-1]){form.elements.start.value=periods[first-1].start;form.elements.end.value=periods[last-1].end;}
}
function render(){const previousScroll=$('.grid-scroll')?.scrollLeft;root.innerHTML=`<div class="app-shell">${header()}<main>${route==='home'?home():route==='import'?importView():route==='alarms'?alarmsView():settingsView()}</main>${nav()}</div>`;document.documentElement.dataset.platform=platform();const scroll=$('.grid-scroll');if(scroll){if(previousScroll!==undefined)scroll.scrollLeft=previousScroll;else{const day=$('.day-header.today');if(day)scroll.scrollLeft=Math.max(0,day.offsetLeft-scroll.clientWidth/2+day.clientWidth/2);}}updateNativeNavigation();}

function openEditor(id=null,review=false){
  const source=review?importResult?.courses:state.courses;
  const original=source?.find(c=>c.id===id)??{id:uid(),name:'',location:'',day:dayOfWeek(selected),start:'08:30',end:'10:10',weeks:parseWeeks('',state.settings.totalWeeks),color:'mint',confirmed:!review,date:''};
  const c=resolveCourseTime(original,state.settings), rule=c.weekRule??inferWeekRule(c.weeks,state.settings.totalWeeks);
  const dialog=$('#course-dialog');dialog.innerHTML=`<form id="course-form" data-id="${escape(c.id)}" data-review="${review}" data-existing="${Boolean(id)}" data-week-rule="${escape(JSON.stringify(rule))}">
    <div class="dialog-heading"><h2 id="course-dialog-title">${id?'校对课程':'添加课程'}</h2><button type="button" class="icon-button" data-action="close-dialog" aria-label="关闭">${icon('close')}</button></div>
    <label>课程名称<input name="name" value="${escape(c.name)}" maxlength="100" required autofocus></label><label>上课地点<input name="location" value="${escape(c.location)}" maxlength="160" placeholder="例如：信息楼 502"></label>
    <label>星期<select name="day">${weekdays.map((d,i)=>`<option value="${i+1}" ${c.day===i+1?'selected':''}>${d}</option>`).join('')}</select></label>
    <section class="course-time-section"><h3>上课时间</h3><input type="hidden" name="timeMode" value="${c.periodRange?'periods':'custom'}"><div class="time-mode-buttons" aria-label="时间填写方式"><button type="button" data-time-mode="periods" aria-pressed="${Boolean(c.periodRange)}">按节次选择</button><button type="button" data-time-mode="custom" aria-pressed="${!c.periodRange}">直接填时间</button></div>
    <div id="course-period-controls" ${c.periodRange?'':'hidden'}>${coursePeriodControls(state.settings,c.day,c.periodRange)}</div>
    <div class="form-pair actual-course-times"><label>开始时间<input name="start" type="time" value="${c.start}" ${c.periodRange?'readonly':''} required></label><label>结束时间<input name="end" type="time" value="${c.end}" ${c.periodRange?'readonly':''} required></label></div></section>
    ${weeksEditor(c,state.settings)}
    <details class="single-date-details" ${c.date?'open':''}><summary>只在某一天上课 / 补课</summary><label>仅某一天补课（可留空）<input name="date" type="date" value="${escape(c.date??'')}"><small>填写后只按这个日期安排，星期与常规周次不再限制这次课程。</small></label></details>
    <fieldset class="color-picker"><legend>课程颜色</legend>${['mint','sky','lavender','peach','rose'].map((v,i)=>`<label class="${v}"><input type="radio" name="color" value="${v}" ${c.color===v?'checked':''} aria-label="${['薄荷绿','天空蓝','浅紫','杏色','粉色'][i]}"><span></span></label>`).join('')}</fieldset>
    <label class="confirm-check"><input name="confirmed" type="checkbox" ${c.confirmed?'checked':''}>我已核对星期、周次与时间</label>
    ${c.raw?`<details class="raw-details"><summary>对照识别原文</summary><pre>${escape(c.raw)}</pre></details>`:''}<p id="course-error" class="form-error" role="alert"></p>
    <div class="dialog-actions">${id?`<button type="button" class="text-button danger" data-${review?'remove-review':'delete-course'}="${escape(c.id)}">删除课程</button>`:'<span></span>'}<button class="button" type="submit">保存课程</button></div>
  </form>`;
  dialog.showModal();editorInitial=JSON.stringify([...new FormData($('#course-form'))]);updateNativeNavigation();dialog.querySelector('[name=name]').focus();
}
async function processFile(file){if(!file||importBusy)return;route='import';importBusy=true;progress='正在准备文件…';render();try{const doc=await importDocument(file,text=>{progress=text;const strong=$('.dropzone strong');if(strong)strong.textContent=text;});importResult={...parseTimetable(doc,state.settings),name:doc.name,kind:doc.kind};}catch(e){toast(e.message);}finally{importBusy=false;render();}}
function download(name,text,type='application/json'){if(platform()!=='web'){callNative('exportFile',{name,text,type}).then(()=>toast('已打开系统分享 / 保存')).catch(e=>toast(e.message));return;}const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

document.addEventListener('click',async event=>{
  const b=event.target.closest('button,a');if(!b)return;
  if(b.dataset.route){route=b.dataset.route;render();window.scrollTo(0,0);return;}
  if(b.dataset.view){view=b.dataset.view;render();return;}
  if(b.dataset.date){selected=b.dataset.date;view='day';render();return;}
  if(b.dataset.edit){openEditor(b.dataset.edit);return;}
  if(b.dataset.review){openEditor(b.dataset.review,true);return;}
  if(b.dataset.removeReview){importResult.courses=importResult.courses.filter(c=>c.id!==b.dataset.removeReview);$('#course-dialog').close();render();return;}
  if(b.dataset.deleteCourse){if(confirm('删除这门课程？对应的起床计划会重新计算。')){state.courses=state.courses.filter(c=>c.id!==b.dataset.deleteCourse);$('#course-dialog').close();save();}return;}
  if(b.dataset.deleteException!==undefined){state.exceptions.splice(+b.dataset.deleteException,1);save();return;}
  if(b.dataset.weekPattern){updateWeeksFromRange(b.dataset.weekPattern);return;}
  if(b.dataset.week){const form=$('#course-form'),weeks=parseWeeks(form.elements.weeks.value,state.settings.totalWeeks),week=+b.dataset.week;const next=weeks.includes(week)?weeks.filter(w=>w!==week):[...weeks,week].sort((a,b)=>a-b);applyWeekSelection(next,{...inferWeekRule(next,state.settings.totalWeeks),pattern:'custom'});return;}
  if(b.dataset.timeMode){$('#course-form').elements.timeMode.value=b.dataset.timeMode;refreshCourseTiming();return;}
  if(b.dataset.periodActive!==undefined){periodActive=+b.dataset.periodActive;refreshPeriodPreview();$('#period-slider-panel').scrollIntoView({block:'nearest',behavior:'smooth'});return;}
  if(b.dataset.periodCount){const count=periodList().length+(+b.dataset.periodCount);if(count<(periodScope==='common'?1:0)||count>20)return;const periods=resizePeriods(periodList(),count);if(periodScope==='common')periodDraft.periods=periods;else periodDraft.periodsByDay[periodScope]=periods;refreshPeriods();return;}
  switch(b.dataset.action){
    case'import':route='import';render();break;
    case'demo':state=makeDemo();periodDraft=null;save();break;
    case'new':state=createState();periodDraft=null;selected=dateParts().date;save();break;
    case'add':openEditor();break;
    case'add-import':openEditor(null,true);break;
    case'close-dialog':$('#course-dialog').close();break;
    case'previous':selected=addDays(selected,-7);render();break;
    case'next':selected=addDays(selected,7);render();break;
    case'today':selected=dateParts().date;render();requestAnimationFrame(()=>$('.time-pointer')?.scrollIntoView({behavior:'smooth',block:'center'}));break;
    case'all-days':showAllDays=!showAllDays;render();break;
    case'parse-text':{const text=$('#paste-text').value;if(!text.trim()){toast('请先粘贴课表文字');break;}importResult={...parseTimetable({text},state.settings),name:'粘贴文字',kind:'text'};render();break;}
    case'commit-import':{if(!importResult?.courses.length)break;if(state.demo){state.courses=[];state.demo=false;}const keys=new Set(state.courses.map(c=>[c.name,c.day,c.start,c.end,c.weeks.join(',')].join('|')));let added=0;for(const c of importResult.courses){const key=[c.name,c.day,c.start,c.end,c.weeks.join(',')].join('|');if(!keys.has(key)){state.courses.push(c);keys.add(key);added++;}}importResult=null;route='home';save();toast(`已加入 ${added} 门课程，点击课程可校对并确认`);break;}
    case'backup':download(`晨课备份-${dateParts().date}.json`,JSON.stringify(state,null,2));break;
    case'ics':download('晨课课程.ics',icsExport(state,state.settings.week1,state.settings.totalWeeks*7),'text/calendar');break;
    case'clear':if(confirm('将清空所有课程和设置，并取消本应用安排的闹钟。建议先导出备份。')){state=createState();periodDraft=null;save();toast('课表已清空');}break;
    case'period-inherit':delete periodDraft.periodsByDay[periodScope];refreshPeriods();break;
    case'sync':try{if(platform()==='harmony'){const c=await callNative('requestPermissions');updateNativeCaps(c);if(c.reminderGranted===false){nativeStatus=c;render();break;}}if(platform()==='android'&&!androidClockMode()){const c=await callNative('requestPermissions');if(!c.exactAllowed||!c.notificationsAllowed){toast(c.message);break;}}await sync(true);render();}catch(e){toast(e.message);}break;
    case'clock-next':await openSystemClock('openClockAlarm');break;
    case'clock-test':await openSystemClock('testClockAlarm');break;
    case'clock-show':await openSystemClock('showClockAlarms');break;
    case'cancel-test-alarm':await harmonyTest('cancelTestAlarm');break;
    case'test-alarm':if(platform()==='harmony'){await harmonyTest();break;}if(platform()==='web'){toast('网页预览不能设置系统闹钟，请在原生版测试');}else{try{if(platform()==='android'){const c=await callNative('requestPermissions');if(!c.exactAllowed||!c.notificationsAllowed){toast(c.message);break;}}const r=await callNative('testAlarm');toast(r.message);}catch(e){toast(e.message);}}break;
  }
});
document.addEventListener('input',event=>{
  const el=event.target;
  if(el.id==='lead-slider'){const value=+el.value;$('#lead-value').textContent=value;$('#lead-input').value=value;}
  if(el.closest('#settings-form')&&['week1','totalWeeks'].includes(el.name))$('#semester-preview').textContent=semesterPreview();
  if(el.dataset.periodIndex!==undefined){const periods=periodList(true);periods[+el.dataset.periodIndex][el.dataset.periodPart]=el.value;periodActive=+el.dataset.periodIndex;refreshPeriodPreview();}
  if(el.dataset.periodSlider){const part=el.dataset.periodSlider,periods=periodList(true);periods[periodActive][part]=clock(+el.value);$('#period-'+part+'-output').textContent=clock(+el.value);const input=$('#periods-form [name="p'+periodActive+(part==='start'?'s':'e')+'"]');if(input)input.value=clock(+el.value);refreshPeriodPreview(true);}
});
document.addEventListener('change',async event=>{
  const el=event.target;
  if(el.id==='view-week'){const week=+el.value;selected=week?addDays(state.settings.week1,(week-1)*7+dayOfWeek(selected)-1):dateParts().date;render();return;}
  if(el.id==='period-scope'){periodScope=el.value;periodActive=0;refreshPeriods();return;}
  if(el.id==='period-count'){const count=+el.value;if(!Number.isInteger(count)||count<(periodScope==='common'?1:0)||count>20){$('#period-error').textContent='通用表1-20节，单独设置的星期0-20节。';return;}const periods=resizePeriods(periodList(),count);if(periodScope==='common')periodDraft.periods=periods;else periodDraft.periodsByDay[periodScope]=periods;refreshPeriods();return;}
  if(el.id==='week-start'||el.id==='week-end'){updateWeeksFromRange();return;}
  if(el.closest('#course-form')){
    const form=$('#course-form');
    if(el.name==='weeks'){const weeks=parseWeeks(el.value,state.settings.totalWeeks);applyWeekSelection(weeks,inferWeekRule(weeks,state.settings.totalWeeks),false);}
    if(el.name==='day'){refreshCourseTiming();$('#week-summary').textContent=weekSummary(parseWeeks(form.elements.weeks.value,state.settings.totalWeeks),state.settings,+el.value);}
    if(el.name==='periodStart'||el.name==='periodEnd'){if(+form.elements.periodEnd.value<+form.elements.periodStart.value){if(el.name==='periodStart')form.elements.periodEnd.value=el.value;else form.elements.periodStart.value=el.value;}updateCourseTimes();}
    if(el.name==='date')form.elements.weeks.required=!el.value;
  }
  if(el.id==='file-input')processFile(el.files[0]);
  if(el.id==='alarm-enabled'){state.settings.enabled=el.checked;save();}
  if(el.id==='lead-slider'||el.id==='lead-input'){const n=+el.value;if(!Number.isInteger(n)||n<0||n>1440){toast('提前量请输入 0-1440 分钟');return;}state.settings.leadMinutes=n;save();}
  if(el.id==='restore-input'&&el.files[0]){try{if(el.files[0].size>5*1024*1024)throw Error('备份文件超过 5 MB');const next=validateState(JSON.parse(await el.files[0].text()));if(confirm('用备份替换当前课表？请先保存现有记录。')){state=next;periodDraft=null;state.settings.enabled=false;save();toast('备份已恢复，请检查后重新启用闹钟');}}catch(e){toast(`恢复失败：${e.message}`);}}
});
document.addEventListener('submit',event=>{
  event.preventDefault();const form=event.target;const d=Object.fromEntries(new FormData(form));
  if(form.id==='course-form'){
    const review=form.dataset.review==='true';const source=review?importResult?.courses:state.courses;const old=source?.find(c=>c.id===form.dataset.id)??{};
    const weeks=d.date?([weekNumber(d.date,state.settings.week1)].filter(w=>w>=1&&w<=60).length?[weekNumber(d.date,state.settings.week1)]:[1]):parseWeeks(d.weeks,state.settings.totalWeeks);
    let weekRule=JSON.parse(form.dataset.weekRule);if(d.date)weekRule=undefined;else if(weekRule.pattern!=='custom'&&JSON.stringify(weeksForRule(weekRule))!==JSON.stringify(weeks))weekRule=inferWeekRule(weeks,state.settings.totalWeeks);
    let c={...old,id:form.dataset.id,name:d.name.trim(),location:d.location.trim(),day:+d.day,start:d.start,end:d.end,weeks,weekRule,color:d.color??'mint',confirmed:Boolean(d.confirmed),date:d.date||undefined,source:old.source??'manual',periodRange:d.timeMode==='periods'?{start:+d.periodStart,end:+d.periodEnd}:undefined};
    const errors=validateCourse(c);if(!d.date&&weeks.some(w=>w>state.settings.totalWeeks))errors.push('选择的周次超出学期，请先调整学期周数或课程周次');
    if(c.periodRange&&c.periodRange.end>periodsForDay(state.settings,c.day).length)errors.push('该星期没有所选节次，请先设置节次或直接填写时间');
    if(errors.length){$('#course-error').textContent=errors.join('；');return;}c=resolveCourseTime(c,state.settings);
    if(!review&&state.demo){state={...state,courses:[],exceptions:[],demo:false};}
    const list=review?importResult.courses:state.courses;const i=list.findIndex(a=>a.id===c.id);if(i<0)list.push(c);else list[i]=c;
    $('#course-dialog').close();if(review)render();else{save();if(conflicts(state.courses).some(p=>p.includes(c.id)))toast('课程已保存，但有时间重叠，请核对周次和时间');}return;
  }
  if(form.id==='settings-form'){const candidate=structuredClone(state);candidate.settings={...candidate.settings,week1:mondayOf(d.week1),semesterStart:d.week1,totalWeeks:+d.totalWeeks,morningEnd:d.morningEnd};try{validateState(candidate);state=candidate;save();toast('学期设置已保存，课程与起床计划已重新计算');}catch(e){toast(e.message);}return;}
  if(form.id==='periods-form'){const candidate=structuredClone(state);candidate.settings.periods=structuredClone(periodDraft.periods);candidate.settings.periodsByDay=structuredClone(periodDraft.periodsByDay);try{const next=validateState(candidate);next.courses=next.courses.map(c=>resolveCourseTime(c,next.settings));state=next;periodDraft=null;save();toast('节次已保存，按节次录入的课程与起床计划已更新');}catch(e){$('#period-error').textContent=e.message;}return;}
  if(form.id==='exception-form'){state.exceptions=state.exceptions.filter(e=>e.date!==d.date||e.type==='cancelCourse');state.exceptions.push({date:d.date,type:d.type,day:+d.day,note:d.note});state.exceptions.sort((a,b)=>a.date.localeCompare(b.date));save();toast('例外日期已保存');}
});
document.addEventListener('dragover',event=>{if(event.target.closest('.dropzone'))event.preventDefault();});
document.addEventListener('drop',event=>{if(event.target.closest('.dropzone')){event.preventDefault();processFile(event.dataTransfer.files[0]);}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(route==='home')render();if(platform()==='harmony')globalThis.chenkeNativeResume?.();else sync();}});
setInterval(()=>{if(!document.hidden&&route==='home'&&!$('#course-dialog').open)render();},60000);
$('#course-dialog').addEventListener('close',updateNativeNavigation);
globalThis.chenkeNativeBack=()=>{
  const dialog=$('#course-dialog');
  if(dialog.open){
    if(JSON.stringify([...new FormData($('#course-form'))])!==editorInitial&&!confirm('课程尚未保存，放弃这次修改？'))return true;
    dialog.close();updateNativeNavigation();return true;
  }
  if(route!=='home'){route='home';render();return true;}
  return false;
};
render();
let nativeInitialized=false;
globalThis.chenkeNativeReady=async()=>{
  if(nativeInitialized||platform()==='web')return;nativeInitialized=true;
  try{const c=await capabilities();nativeCaps=c;if(c.message)nativeStatus={...c,mode:c.mode??'pending',scheduled:0};}
  catch(e){nativeStatus={mode:'error',message:e.message};}
  try{const data=await callNative('loadState');if(data?.state)state=validateState(data.state);}
  catch(e){toast(`设备记录读取失败：${e.message}`);}
  render();syncFingerprint='';sync();
};
globalThis.chenkeNativeResume=()=>{
  if(!nativeInitialized||platform()==='web')return;
  clearTimeout(nativeResumeTimer);
  nativeResumeTimer=setTimeout(async()=>{
    try{const c=await capabilities();nativeCaps=c;if(c.message)nativeStatus={...c,mode:c.mode??'pending',scheduled:0};}
    catch(e){nativeStatus={mode:'error',message:e.message};}
    await sync(true);
  },100);
};
if(platform()!=='web')globalThis.chenkeNativeReady();else{capabilities().then(c=>nativeCaps=c);sync();}
if(platform()==='web'&&'serviceWorker'in navigator&&/^https?:$/.test(location.protocol)&&!import.meta.env.DEV)navigator.serviceWorker.register('./sw.js').catch(()=>{});

document.addEventListener('change',event=>{if(event.target.id==='android-alarm-mode'){state.settings.androidAlarmMode=event.target.value;syncFingerprint='';save();}});
