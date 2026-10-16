import {uid,createState,makeDemo,weekdays,minutes,clock,dateParts,addDays,mondayOf,dayOfWeek,weekNumber,parseWeeks,formatWeeks,coursesOn,morningPlan,planAlarms,courseStatus,conflicts,validateCourse,validateState,icsExport,weeksForRule,periodsForDay,validatePeriods,resolveCourseTime,validDate,applyCourseAdjustment} from './core.mjs';
import {parseTimetable} from './parser.mjs';
import {importDocument} from './importer.mjs';
import {platform,callNative,capabilities,dispatchAlarms} from './bridge.mjs';
import {inferWeekRule,weekSummary,weeksEditor,coursePeriodControls,resizePeriods,periodChart,periodSliders,periodsEditor} from './schedule-ui.mjs';
import {harmonyAuthorization} from './harmony-ui.mjs';
import {homeDashboard,courseTimeline} from './home-ui.mjs';
import {tomorrowClock,clockRequestKey} from './clock-policy.mjs';
import {courseAdjustmentDraft,courseAdjustmentForm,adjustmentPreview,adjustmentsPanel} from './adjustments-ui.mjs';

const KEY='chenke.state.v1'; const $=s=>document.querySelector(s);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18"/>',upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',settings:'<path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>',arrow:'<path d="m9 5 7 7-7 7"/>',plus:'<path d="M12 5v14M5 12h14"/>',check:'<path d="m5 12 4 4L19 6"/>',book:'<path d="M12 6v15M12 6C9 3 6 3 3 4v15c3-1 6-1 9 2 3-3 6-3 9-2V4c-3-1-6-1-9 2Z"/>',moon:'<path d="M20 14A9 9 0 0 1 10 4a9 9 0 1 0 10 10Z"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v3h16v-3"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v2M12 21v2M1 12h2M21 12h2M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2"/>',trash:'<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>'};
const icon=(name,cls='')=>`<svg class="icon ${cls}" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]??icons.book}</svg>`;
let state=createState();
try {const raw=localStorage.getItem(KEY);if(raw)state=validateState(JSON.parse(raw));} catch {setTimeout(()=>toast('本机记录无法读取，请从备份恢复。原记录未覆盖。'),300);}
let route='home', view='day', selected=dateParts().date, showAllDays=false;
let importResult=null, importBusy=false, progress='', nativeStatus={mode:'pending',scheduled:0,message:'尚未启用系统闹钟'}, nativeCaps=null;
let clockReceipt=null,clockAutoBusy=false;const clockAttempts=new Set();
let syncFingerprint='', syncRunning=false, syncAgain=false, clockRequestBusy=false;
let nativeTestFeedback=null, nativeTestBusy=false, nativeResumeTimer=null, editorInitial='';
let periodDraft=null, periodScope='common', periodActive=0, settingsPanel='semester';
let exceptionScope='course', adjustmentDraft=null;
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
function rememberClock(result){if(result?.lastClockRequest&&!result.lastClockRequest.test)clockReceipt=result.lastClockRequest;}
async function autoSystemClock(){
  if(!androidClockMode()||!nativeInitialized||document.hidden||clockAutoBusy||clockRequestBusy||importBusy||$('#course-dialog').open)return;
  if(document.activeElement?.matches('input:not([type=checkbox]):not([type=range]),textarea,select'))return;
  const policy=tomorrowClock(state);if(!policy.canSend)return;
  if(nativeCaps?.clockAvailable===false){nativeStatus={mode:'blocked',scheduled:0,message:'当前兼容环境不支持系统时钟接口，无法自动发送。可使用获授权后的鸿蒙原生提醒。'};if(route==='home'||route==='alarms')render();return;}
  const key=clockRequestKey(policy.plan);
  if(clockReceipt?.skipUiRequested&&clockReceipt.fireAt===policy.plan.fireAt&&clockReceipt.course===policy.plan.course){nativeStatus={...nativeStatus,mode:'clock-request',scheduled:0,message:'已发送明天 '+policy.plan.alarmTime+' 的免确认请求，可在系统时钟中查看或删除。'};return;}
  if(clockAttempts.has(key))return;clockAttempts.add(key);if(clockAttempts.size>60)clockAttempts.delete(clockAttempts.values().next().value);
  clockAutoBusy=true;
  try{const result=await callNative('openClockAlarm',{plan:policy.plan,automatic:true});rememberClock(result);nativeStatus=result;}
  catch(error){nativeStatus={mode:'error',scheduled:0,message:error.message};}
  finally{clockAutoBusy=false;if(route==='home'||route==='alarms')render();}
}
async function sync(force=false) {
  const plans=planAlarms(state);const fingerprint=JSON.stringify([androidClockMode(),dateParts().date,plans.map(p=>[p.id,p.fireAt,p.course])]);
  if(!force&&fingerprint===syncFingerprint){await autoSystemClock();return;}
  if(syncRunning){syncAgain=true;return;}
  syncRunning=true;nativeStatus={mode:'pending',scheduled:0,message:'正在更新起床计划…'};if(route==='home'||route==='alarms')render();
  try{nativeStatus=await dispatchAlarms(plans,androidClockMode()?'clock':'app');rememberClock(nativeStatus);updateNativeCaps(nativeStatus);if(!nativeStatus.failed)syncFingerprint=fingerprint;}
  catch(error){nativeStatus={mode:'error',scheduled:0,message:error.message};}
  finally{syncRunning=false;await autoSystemClock();if(route==='alarms'||route==='home')render();if(syncAgain){syncAgain=false;sync();}}
}
function dateLabel(date,short=false){const d=new Date(`${date}T12:00:00Z`);return `${d.getUTCMonth()+1}${short?'/':'月'}${d.getUTCDate()}${short?'':'日'}`;}
function weekLabel(){const w=weekNumber(selected,state.settings.week1);return w<1?'学期开始前':w>state.settings.totalWeeks?'学期已结束':`第 ${w} 周`;}
function header(){return `<header class="topbar"><a class="brand" href="#home" aria-label="晨课课表主页"><span class="brand-mark">${icon('calendar')}</span><strong>晨课</strong></a></header>`;}
function nav(){return `<nav class="bottom-nav" aria-label="主导航">${[['home','calendar','课表'],['import','upload','导入'],['alarms','clock','闹钟'],['settings','settings','设置']].map(([id,i,t])=>`<button data-route="${id}" class="nav-item ${route===id?'active':''}" ${route===id?'aria-current="page"':''}>${icon(i)}<span>${t}</span></button>`).join('')}</nav>`;}
function demoBanner(){return state.demo?`<div class="demo-strip">${icon('book')}<span>演示课表 · 不会设置闹钟</span><button class="text-button" data-action="new">开始自己的课表${icon('arrow')}</button></div>`:'';}
function emptyHome(){return `<section class="empty-home"><div class="empty-graphic">${icon('calendar')}</div><h1>把课表放进生活里。</h1><p>导入 PDF、图片，或手动添加课程。</p><button class="button" data-action="import">${icon('upload')}导入我的课表</button><button class="button secondary" data-action="add">${icon('plus')}手动添加课程</button><button class="text-button" data-route="settings">设置学期与节次${icon('arrow')}</button><button class="text-button" data-action="demo">先体验演示课表${icon('arrow')}</button></section>`;}
function wakeStrip(){
  const p=morningPlan(state,addDays(dateParts().date,1)),policy=tomorrowClock(state);
  let status=state.demo?'演示预览':p.status==='rest'?'明天上午无课，不发送':p.status==='review'?'晨课待确认，暂不发送':p.status==='paused'?'明天已暂停自动发送':!state.settings.enabled?'自动安排未开启':platform()==='web'?'网页预览，不设置系统闹钟':androidClockMode()?policy.status==='expired'?'起床时间已过或太接近，暂不发送':policy.status==='deferred'?'等今天该钟点过后再发送':nativeCaps?.clockAvailable===false?'此环境不支持系统时钟':nativeStatus.mode==='error'?'发送未完成':nativeStatus.mode==='clock-changed'?'请处理旧闹钟':clockReceipt?.skipUiRequested&&clockReceipt.fireAt===p.alarmAt?'已发送免确认请求':'将自动安排明日':['alarm','system-reminder'].includes(nativeStatus.mode)&&nativeStatus.scheduled>0?'系统已安排':nativeCaps?.reminderGranted===false?'等待系统授权':'等待系统调度';
  const time=p.alarmTime??(p.status==='review'?'待确认':p.status==='paused'?'暂停':'休息');
  return `<section class="wake-strip"><div class="wake-heading"><h2>明日起床</h2>${icon(p.status==='rest'?'moon':'sun')}</div><button class="wake-time" data-route="alarms" aria-label="查看明早起床计划">${time}${icon('arrow')}</button><div class="wake-copy"><strong>${p.status==='ready'?`${p.firstCourse.start} 首课 · 提前 ${state.settings.leadMinutes} 分钟`:p.status==='review'?'先确认明天的晨课':p.status==='paused'?'课程照常，暂停自动安排':'上午无课，不用赶早'}</strong>${p.firstCourse?`<span>${escape(p.firstCourse.name)}</span>`:''}<small class="wake-status">${status}</small></div></section>`;
}
function home(){if(!state.courses.length)return emptyHome();return homeDashboard({state,selected,view,icon,weekLabel:weekLabel(),demoBanner:demoBanner(),wake:wakeStrip(),weekGrid,dayList,showAllDays});}
function weekGrid(){
  const monday=mondayOf(selected);const cols=showAllDays?7:5;
  const today=dateParts();const todayIndex=(Date.parse(`${today.date}T12:00:00Z`)-Date.parse(`${monday}T12:00:00Z`))/86400000;
  const weekCourses=Array.from({length:cols},(_,i)=>coursesOn(state,addDays(monday,i))).flat();
  const times=weekCourses.flatMap(c=>[minutes(c.start),minutes(c.end)]);const showNow=todayIndex>=0&&todayIndex<cols;
  const first=Math.min(7*60,Math.floor(Math.min(...times,...(showNow?[today.minute]:[]),7*60)/60)*60),last=Math.max(22*60,Math.ceil(Math.max(...times,...(showNow?[today.minute]:[]),22*60)/60)*60);
  const lines=[];for(let t=first;t<=last;t+=60)lines.push(`<div class="hour-row" style="top:${(t-first)/(last-first)*100}%"><span>${clock(t)}</span></div>`);
  const cells=Array.from({length:cols},(_,i)=>{
    const date=addDays(monday,i);const courses=coursesOn(state,date);return `<div class="day-column ${today.date===date?'is-today':''}" style="--day:${i}">${courses.map(c=>{const start=Math.max(first,minutes(c.start)),end=Math.min(last,minutes(c.end));if(end<=start)return '';return `<button class="course-block ${escape(c.color??'mint')} ${c.confirmed?'':'unconfirmed'}" ${c.adjustmentId?`data-adjustment="${escape(c.adjustmentId)}"`:`data-edit="${escape(c.id)}"`} style="top:${(start-first)/(last-first)*100}%;height:${(end-start)/(last-first)*100}%" aria-label="编辑 ${escape(c.name)}，${c.start} 至 ${c.end}"><strong>${escape(c.name)}</strong><span>${escape(c.location||'地点待补充')}</span><small>${c.start}–${c.end}${c.confirmed?'':' · 待确认'}</small></button>`;}).join('')}</div>`;
  }).join('');
  const position=(today.minute-first)/(last-first)*100;
  const pointer=showNow?`<div class="time-pointer" style="top:${position}%;--today:${todayIndex}" aria-label="现在 ${today.time}"><i></i><b></b></div>`:'';
  const timeTag=showNow?`<span class="current-time-tag" style="top:${position}%">${today.time}</span>`:'';
  return `<div class="grid-scroll ${cols===7?'seven-days':''}"><div class="timetable" style="--columns:${cols};--hours:${(last-first)/60};--grid-height:${Math.max(600,(last-first)/60*50)}px"><div class="day-headers"><span class="time-label">时间</span>${Array.from({length:cols},(_,i)=>{const date=addDays(monday,i);return `<button class="day-header ${today.date===date?'today':''}" data-date="${date}"><span>${weekdays[i]}</span><strong>${new Date(`${date}T12:00:00Z`).getUTCDate()}</strong></button>`;}).join('')}</div><div class="grid-body"><div class="hours">${lines.join('')}${timeTag}</div><div class="course-grid">${cells}${pointer}</div></div></div></div>`;
}
function dayList(date,aside=false){return courseTimeline(state,date,icon,aside);}
function importView(){return `<div class="page-heading"><div><h1>导入课表</h1></div></div><ol class="import-steps" aria-label="导入步骤"><li class="${importResult?'complete':'current'}">${icon(importResult?'check':'file')}<span>选择课表</span></li><li class="${importResult?'current':''}">${icon('book')}<span>校对课程</span></li><li>${icon('calendar')}<span>加入课表</span></li></ol><section class="import-layout"><div class="import-main"><label class="dropzone ${importBusy?'busy':''}" for="file-input">${icon('upload')}<strong>${importBusy?escape(progress):'选择 PDF 或课表图片'}</strong><span>${importBusy?'识别在本机进行，请保持页面打开':'最大 30 MB'}</span><span class="button ${importBusy?'disabled':''}">${importBusy?'正在识别…':'选择文件'}</span><input id="file-input" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" ${importBusy?'disabled':''}></label><div class="import-alternative"><div class="section-heading"><h2>粘贴课表文字</h2></div><label class="sr-only" for="paste-text">课表文字</label><textarea id="paste-text" rows="4" placeholder="高等数学&#10;周一 08:30-10:10&#10;1-16周 · 理学楼 A302">${escape(importResult?.rawText??'')}</textarea><button class="button secondary" data-action="parse-text">${icon('book')}识别文字</button></div><details class="usage-help import-help"><summary>导入说明</summary><p>图片请保留完整的星期、节次和周次，避免倾斜与遮挡。</p><p>只有节次的课程会使用学校作息。校对后才会安排闹钟。</p><button class="text-button" data-action="settings-periods">调整节次表${icon('arrow')}</button></details>${importResult?reviewView():''}</div></section>`;}

function reviewView(){const cs=importResult.courses;return `<section class="review-section"><div class="section-heading"><div><h2>识别结果<span>${cs.length} 项待校对</span></h2></div><button class="text-button" data-action="add-import">${icon('plus')}补充课程</button></div><p class="review-description">${escape(importResult.name??'粘贴文字')} · ${escape(importResult.kind==='ocr'?'图片 OCR':'文字提取')}</p>${importResult.warnings.map(w=>`<p class="notice">${escape(w)}</p>`).join('')}<div class="review-list">${cs.map((c,i)=>`<article class="review-row"><span class="review-index">${i+1}</span><div class="review-content"><strong>${escape(c.name)}</strong><p class="review-slot">${weekdays[c.day-1]}<span>${c.start}–${c.end}</span></p><p>${escape(formatWeeks(c.weeks))}${c.location?` · 地点：${escape(c.location)}`:''}</p>${c.reasons?.length?`<small>${escape(c.reasons.join('；'))}</small>`:''}</div><div class="review-row-actions"><button class="button secondary compact" data-review="${escape(c.id)}">校对</button><button class="icon-button" data-remove-review="${escape(c.id)}" aria-label="移除识别项 ${escape(c.name)}">${icon('trash')}</button></div></article>`).join('')}</div>${cs.length?`<div class="review-actions"><p>加入后仍为待确认课程，不会直接设置闹钟。</p><button class="button" data-action="commit-import">${icon('check')}加入课表，继续确认</button></div>`:''}<details class="raw-details"><summary>查看完整识别原文</summary><pre>${escape(importResult.rawText)}</pre></details></section>`;}

function androidClockMode(){return platform()==='android'&&state.settings.androidAlarmMode!=='app';}
function clockModeChooser(){
  if(platform()!=='android')return '';
  return `<label class="clock-mode-label" for="android-alarm-mode">响铃方式<select id="android-alarm-mode"><option value="clock" ${androidClockMode()?'selected':''}>手机系统时钟</option><option value="app" ${androidClockMode()?'':'selected'}>晨课后台提醒</option></select></label>`;
}
function systemClockPanel(){
  const policy=tomorrowClock(state),plan=policy.plan,last=clockReceipt;
  const changed=last&&plan&&last.date===policy.date&&last.fireAt!==plan.fireAt&&Date.parse(last.fireAt)>Date.now();
  const sent=last?.skipUiRequested&&last.date===policy.date&&last.fireAt===plan?.fireAt;
  const message=nativeCaps?.clockAvailable===false?'当前系统或兼容环境没有提供系统时钟接口，无法自动发送。':policy.status==='ready'?(sent?'已发送免确认请求，支持的时钟会直接处理。':'应用在前台时会自动发送明日的一次性闹钟。'):policy.message;
  return `<section class="clock-handoff" aria-labelledby="clock-handoff-title"><div class="section-heading"><h2 id="clock-handoff-title">自动安排明天</h2>${icon('clock')}</div><div class="clock-next"><strong>${policy.morning.alarmTime??(policy.status==='paused'?'暂停':'--:--')}</strong><span>${policy.date} · ${policy.morning.firstCourse?escape(policy.morning.firstCourse.name):'上午无课'}</span></div><p>${escape(message)}</p>${changed?'<p class="clock-last error" role="alert">时间已变更，请先删除系统时钟中的旧闹钟，再重新发送。</p>':''}<div class="alarm-actions"><button class="button secondary" data-action="clock-show">查看或删除闹钟</button><button class="text-button" data-action="clock-next" ${!policy.canSend||clockRequestBusy?'disabled':''}>${clockRequestBusy?'正在发送…':'重新发送'}</button></div><div class="clock-secondary"><button class="text-button" data-action="clock-test" ${clockRequestBusy?'disabled':''}>测试时钟（1–2 分钟）</button><button class="text-button" data-action="clock-pause">${policy.status==='paused'?'恢复明天自动安排':'明天暂停自动发送'}</button></div>${['error','clock-request','clock-changed'].includes(nativeStatus.mode)?`<p class="clock-feedback ${nativeStatus.mode==='error'?'error':''}" role="${nativeStatus.mode==='error'?'alert':'status'}">${escape(nativeStatus.message)}</p>`:''}<details class="clock-help"><summary>自动安排的工作方式</summary><p>开启后，打开或返回晨课时会按明天首课自动发送，不要求在时钟里再次保存。同一计划不会反复创建；只发送日期安全的一次性闹钟。系统时钟不提供保存或手动删除的回执，手动删除后晨课不会自动补回同一条；需要时可重新发送。</p><p>本功能需要手机提供系统时钟接口，部分时钟可能仍显示系统界面。全天不打开晨课时，无法保证后台自动创建时钟闹钟。已发送的闹钟请到时钟中删除；“暂停”仅停止晨课继续发送。修改上课时间后，先删除旧闹钟再重新发送。</p></details></section>`;
}
async function openSystemClock(action){
  if(clockRequestBusy)return;
  const policy=tomorrowClock(state);
  if(action==='openClockAlarm'&&!policy.canSend){toast(policy.message);return;}
  clockRequestBusy=true;render();
  try{const result=await callNative(action,action==='openClockAlarm'?{plan:policy.plan,force:true}:{});rememberClock(result);if(result.mode)nativeStatus=result;else toast(result.message);}
  catch(error){nativeStatus={mode:'error',scheduled:0,message:error.message};}
  finally{clockRequestBusy=false;render();document.querySelector('.clock-feedback')?.scrollIntoView({block:'nearest'});}
}
function alarmExplanation(){
  if(platform()==='harmony')return '获得系统代理提醒授权后，可由鸿蒙系统负责响铃。先检查权限，再测试退出应用和锁屏后的提醒；未通过测试前，请保留手机时钟闹钟。';
  if(androidClockMode())return '开启后，应用在前台时自动为明天发送免确认请求，由支持接口的系统时钟响铃。可在时钟中手动删除；卓易通仍需提供该接口。';
  if(platform()==='android')return '由 Android 系统准确闹钟触发原生响铃。请允许通知、“闹钟和提醒”及锁屏全屏显示，并检查闹钟音量；如手机限制后台运行，请在系统设置中允许晨课自启动，再退出应用做锁屏测试。';
  return '网页只显示起床计划。安装手机原生版后，才能由系统在锁屏和退出应用后负责响铃。';
}
function alarmsView(){
  const today=dateParts().date,next=Array.from({length:7},(_,i)=>morningPlan(state,addDays(today,i+1)));
  const statusTitle={'preview':'网页预览','clock-request':'已请求系统时钟','clock-preview':'等待自动安排','clock-changed':'需要处理旧闹钟','blocked':platform()==='harmony'?'等待系统提醒授权':'系统暂不支持','error':'操作未完成','pending':'正在更新','alarm':'系统已安排','system-reminder':'系统已安排'}[nativeStatus.mode]??'起床预览';
  return `<div class="page-heading"><div><h1>起床计划</h1></div></div><div class="alarm-layout"><section class="alarm-main"><div class="alarm-preferences">${clockModeChooser()}<label class="toggle-row"><span><strong>${androidClockMode()?'自动安排明天的闹钟':'启用自动起床闹钟'}</strong></span><span class="switch"><input id="alarm-enabled" type="checkbox" role="switch" ${state.settings.enabled?'checked':''}><span></span></span></label></div>${androidClockMode()?systemClockPanel():''}${platform()==='harmony'?harmonyAuthorization(nativeCaps,nativeTestFeedback,nativeTestBusy):''}<section class="alarm-rule"><h2>提前多久起床</h2><div class="lead-number"><strong id="lead-value">${state.settings.leadMinutes}</strong><span>分钟</span></div><label class="sr-only" for="lead-slider">调整提前分钟数</label><input id="lead-slider" type="range" min="0" max="180" step="5" value="${Math.min(180,state.settings.leadMinutes)}"><label class="lead-exact">精确提前量<input id="lead-input" type="number" min="0" max="1440" inputmode="numeric" value="${state.settings.leadMinutes}"><span>分钟</span></label><p class="rule-example">例如 08:30 上课，${clock(510-state.settings.leadMinutes)} 起床</p></section><div class="native-status ${['error','blocked'].includes(nativeStatus.mode)?'error':''}" role="status"><strong>${statusTitle}</strong><p>${escape(nativeStatus.message??'等待检查系统能力')}</p></div><div class="alarm-actions"><button class="button secondary" data-action="sync">${androidClockMode()?'重新检查并安排':'检查权限并更新'}</button>${androidClockMode()?'':`<button class="text-button" data-action="test-alarm" ${nativeTestBusy||platform()==='harmony'&&nativeCaps?.reminderGranted===false?'disabled':''}>${nativeTestBusy?'正在提交测试…':'测试 1 分钟后响铃'}</button>`}</div>${androidClockMode()?'':`<details class="usage-help"><summary>闹钟使用说明</summary><p>${escape(alarmExplanation())}</p></details>`}</section><section class="alarm-week"><div class="section-heading"><h2>未来一周</h2><span>从明天开始</span></div>${next.map((p,i)=>`<div class="alarm-day"><div><strong>${i===0?'明天':weekdays[dayOfWeek(p.date)-1]}</strong><small>${dateLabel(p.date,true)}</small></div><div class="alarm-day-course"><strong>${p.firstCourse?escape(p.firstCourse.name):'上午无课'}</strong><small>${p.status==='ready'?`${p.firstCourse.start} 首课 · 提前 ${state.settings.leadMinutes} 分钟`:p.reason}</small></div><span class="alarm-day-time ${p.status==='rest'?'rest':''}">${p.alarmTime??(p.status==='review'?'待确认':p.status==='paused'?'暂停':'休息')}</span></div>`).join('')}</section></div>`;
}
function semesterPreview() {
  const form=$('#settings-form'), date=form?.elements.week1.value??(state.settings.semesterStart??state.settings.week1), total=+(form?.elements.totalWeeks.value??state.settings.totalWeeks);
  if(!validDate(date)||!Number.isInteger(total)||total<1||total>60)return '选择开学日期和总周数，查看学期范围。';
  const monday=mondayOf(date), current=weekNumber(dateParts().date,monday);
  return '第 1 周：'+monday+' 至 '+addDays(monday,6)+'；常规课程从 '+date+' 开始。学期至 '+addDays(monday,total*7-1)+'，'+(current<1?'尚未开学':current>total?'已结束':'今天为第 '+current+' 周')+'。';
}
function settingsView(){
  const s=state.settings;
  if(!periodDraft)periodDraft=structuredClone({...s,periodsByDay:s.periodsByDay??{}});
  const tabs=[['semester','calendar','学期','学期设置'],['periods','clock','节次','节次时间'],['courses','book','课程','课程管理'],['exceptions','sun','调课','例外日期'],['data','download','备份','数据备份']];
  const pane=(id,title,description,body)=>`<section id="settings-pane-${id}" role="tabpanel" aria-labelledby="settings-tab-${id}" class="settings-section settings-pane" ${settingsPanel===id?'':'hidden'}><div class="settings-pane-heading"><h2>${title}</h2>${description?`<p>${description}</p>`:''}</div>${body}</section>`;
  return `<div class="page-heading"><div><h1>设置</h1></div></div><div class="settings-workspace"><div class="settings-tabs" role="tablist" aria-label="设置分类">${tabs.map(([id,i,label,name])=>`<button type="button" role="tab" id="settings-tab-${id}" aria-label="${name}" aria-controls="settings-pane-${id}" aria-selected="${settingsPanel===id}" tabindex="${settingsPanel===id?'0':'-1'}" data-settings-panel="${id}">${icon(i)}<span>${label}</span></button>`).join('')}</div>
  ${pane('semester','学期与时间','',`<form id="settings-form" class="settings-form"><label>第 1 周开始上课的日期<input name="week1" type="date" value="${s.semesterStart??s.week1}" required><small>以该周周一作为第 1 周起点。</small></label><label>学期周数<input name="totalWeeks" type="number" inputmode="numeric" min="1" max="60" value="${s.totalWeeks}" required></label><label>上午结束时间<input name="morningEnd" type="time" value="${s.morningEnd}" required><small>首课早于此刻才计入晨课。</small></label><p id="semester-preview" class="semester-preview">${escape(semesterPreview())}</p><button class="button" type="submit">保存学期设置</button></form>`)}
  ${pane('periods','每天的节次与时间','',`<div id="period-editor">${periodsEditor(periodDraft,periodScope,periodActive)}</div>`)}
  ${pane('courses','课程管理',`${state.courses.length} 门课程`,`<div class="management-toolbar"><button class="button secondary compact" data-action="add">${icon('plus')}添加课程</button></div><div class="course-management">${state.courses.length?[...state.courses].sort((a,b)=>a.day-b.day||minutes(a.start)-minutes(b.start)).map(c=>{const time=resolveCourseTime(c,s);return `<button class="managed-course" data-edit="${escape(c.id)}"><span class="course-color ${escape(c.color??'mint')}"></span><span><strong>${escape(c.name)}</strong><small>${weekdays[c.day-1]} · ${time.start}–${time.end}${c.periodRange?` · 第${c.periodRange.start}–${c.periodRange.end}节`:''}</small><small>${c.date?c.date+' · 单次课程':escape(formatWeeks(c.weeks))}${c.confirmed?'':' · 待确认'}</small></span>${icon('arrow')}</button>`;}).join(''):`<div class="management-empty">${icon('book')}<strong>还没有课程</strong><p>添加一门课程，或导入 PDF 后逐门校对。</p></div>`}</div>`)}
  ${pane('exceptions','停课与调课','',adjustmentsPanel(state,adjustmentDraft??=courseAdjustmentDraft(state,selected),exceptionScope))}
  ${pane('data','数据与备份','课表仅保存在本机，建议定期备份。',`<div class="backup-actions"><button class="backup-action" data-action="backup">${icon('download')}<span><strong>导出课表备份</strong><small>保存课程、学期和节次 · JSON</small></span>${icon('arrow')}</button><label class="backup-action restore-label">${icon('upload')}<span><strong>恢复备份</strong><small>用已有 JSON 备份替换当前课表</small></span>${icon('arrow')}<input id="restore-input" type="file" accept="application/json,.json"></label><button class="backup-action" data-action="ics">${icon('calendar')}<span><strong>导出课程日历</strong><small>ICS 文件 · 不包含起床闹钟</small></span>${icon('arrow')}</button></div><div class="danger-zone"><div><strong>清空本机课表</strong><p>操作前建议导出备份；外部时钟闹钟需单独删除。</p></div><button class="text-button danger" data-action="clear">${icon('trash')}清空课表</button></div>`)}
  </div>`;
}
function selectSettingsPanel(panel,focus=false){
  settingsPanel=panel;
  document.querySelectorAll('[data-settings-panel]').forEach(tab=>{const active=tab.dataset.settingsPanel===panel;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;if(active&&focus)tab.focus();});
  document.querySelectorAll('.settings-pane').forEach(pane=>pane.hidden=pane.id!=='settings-pane-'+panel);
}

function refreshAdjustmentForm(focusName){
  $('#single-course-adjustment').innerHTML=courseAdjustmentForm(state,adjustmentDraft);
  if(focusName)$('#course-adjustment-form').elements[focusName]?.focus();
}
function readAdjustmentDraft(form){
  adjustmentDraft={...adjustmentDraft,...Object.fromEntries(new FormData(form))};
}
function openAdjustment(index){
  const record=state.exceptions[index];if(!record)return;
  adjustmentDraft=courseAdjustmentDraft(state,record.date,record.courseId);
  exceptionScope='course';settingsPanel='exceptions';route='settings';render();window.scrollTo(0,0);
  $('#course-adjustment-form').elements.courseId.focus({preventScroll:true});
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
function externalClockNotice(){
  if(platform()!=='android'||!clockReceipt||Date.parse(clockReceipt.fireAt)<=Date.now())return '';
  const matching=planAlarms(state).find(p=>p.date===clockReceipt.date);
  const needsManagement=!state.settings.enabled||!androidClockMode()||!matching||matching.fireAt!==clockReceipt.fireAt||matching.course!==clockReceipt.course;
  if(!needsManagement)return '';
  return `<aside class="external-clock-notice" aria-label="系统时钟旧闹钟"><div><strong>${escape(clockReceipt.localDate??clockReceipt.date??'')} ${escape(clockReceipt.localTime??'')} 的闹钟可能仍会响</strong><p>关闭自动安排、暂停、切换方式或清空课表，都不会删除已交给系统时钟的闹钟。请到时钟中处理。</p></div><button class="button secondary compact" data-action="clock-show">去系统时钟管理</button></aside>`;
}
function render(){
  const previousScroll=$('.grid-scroll')?.scrollLeft;
  root.innerHTML=`<div class="app-shell">${header()}${externalClockNotice()}<main>${route==='home'?home():route==='import'?importView():route==='alarms'?alarmsView():settingsView()}</main>${nav()}</div>`;
  document.documentElement.dataset.platform=platform();root.dataset.route=route;
  const scroll=$('.grid-scroll');if(scroll){if(previousScroll!==undefined)scroll.scrollLeft=previousScroll;else{const day=$('.day-header.today');if(day)scroll.scrollLeft=Math.max(0,day.offsetLeft-scroll.clientWidth/2+day.clientWidth/2);}}
  const dates=$('.date-strip'),date=$('.date-chip.selected');if(dates&&date){const chips=[...dates.children],visible=+(getComputedStyle(dates).getPropertyValue('--date-visible')||7),index=chips.indexOf(date),step=chips[1]?chips[1].getBoundingClientRect().left-chips[0].getBoundingClientRect().left:0;dates.scrollLeft=Math.max(0,Math.min(chips.length-visible,index-Math.floor(visible/2)))*step;}
  updateNativeNavigation();
}

function openEditor(id=null,review=false){
  const source=review?importResult?.courses:state.courses;
  const original=source?.find(c=>c.id===id)??{id:uid(),name:'',location:'',day:dayOfWeek(selected),start:'08:30',end:'10:10',weeks:parseWeeks('',state.settings.totalWeeks),color:'mint',confirmed:!review,date:''};
  const c=resolveCourseTime(original,state.settings), rule=c.weekRule??inferWeekRule(c.weeks,state.settings.totalWeeks);
  const dialog=$('#course-dialog');dialog.innerHTML=`<form id="course-form" data-id="${escape(c.id)}" data-review="${review}" data-existing="${Boolean(id)}" data-week-rule="${escape(JSON.stringify(rule))}">
    <div class="dialog-heading"><h2 id="course-dialog-title">${id?'校对课程':'添加课程'}</h2><button type="button" class="icon-button" data-action="close-dialog" aria-label="关闭">${icon('close')}</button></div>
    <div class="editor-basics"><label>课程名称<input name="name" value="${escape(c.name)}" maxlength="100" required autofocus></label><label>上课地点<input name="location" value="${escape(c.location)}" maxlength="160" placeholder="例如：信息楼 502"></label>
    <label>星期<select name="day">${weekdays.map((d,i)=>`<option value="${i+1}" ${c.day===i+1?'selected':''}>${d}</option>`).join('')}</select></label></div>
    <section class="course-time-section"><h3>上课时间</h3><input type="hidden" name="timeMode" value="${c.periodRange?'periods':'custom'}"><div class="time-mode-buttons" aria-label="时间填写方式"><button type="button" data-time-mode="periods" aria-pressed="${Boolean(c.periodRange)}">按节次选择</button><button type="button" data-time-mode="custom" aria-pressed="${!c.periodRange}">直接填时间</button></div>
    <div id="course-period-controls" ${c.periodRange?'':'hidden'}>${coursePeriodControls(state.settings,c.day,c.periodRange)}</div>
    <div class="form-pair actual-course-times"><label>开始时间<input name="start" type="time" value="${c.start}" ${c.periodRange?'readonly':''} required></label><label>结束时间<input name="end" type="time" value="${c.end}" ${c.periodRange?'readonly':''} required></label></div></section>
    ${weeksEditor(c,state.settings)}
    <details class="single-date-details" ${c.date?'open':''}><summary>只在某一天上课 / 补课</summary><label>仅某一天补课（可留空）<input name="date" type="date" value="${escape(c.date??'')}"><small>填写后只按这个日期安排，星期与常规周次不再限制这次课程。</small></label></details>
    <fieldset class="color-picker"><legend>课程颜色</legend>${['mint','sky','lavender','peach','rose'].map((v,i)=>`<label class="${v}"><input type="radio" name="color" value="${v}" ${c.color===v?'checked':''} aria-label="${['浅蓝','天空蓝','浅紫','杏色','粉色'][i]}"><span></span></label>`).join('')}</fieldset>
    <label class="confirm-check editor-confirm"><input name="confirmed" type="checkbox" ${c.confirmed?'checked':''}>我已核对星期、周次与时间</label>
    ${c.raw?`<details class="raw-details"><summary>对照识别原文</summary><pre>${escape(c.raw)}</pre></details>`:''}<p id="course-error" class="form-error" role="alert"></p>
    <div class="dialog-actions">${id?`<button type="button" class="text-button danger" data-${review?'remove-review':'delete-course'}="${escape(c.id)}">删除课程</button>`:'<span></span>'}<button class="button" type="submit">保存课程</button></div>
  </form>`;
  dialog.showModal();editorInitial=JSON.stringify([...new FormData($('#course-form'))]);updateNativeNavigation();dialog.querySelector('[name=name]').focus();
}
async function processFile(file){if(!file||importBusy)return;route='import';importBusy=true;progress='正在准备文件…';render();try{const doc=await importDocument(file,text=>{progress=text;const strong=$('.dropzone strong');if(strong)strong.textContent=text;});importResult={...parseTimetable(doc,state.settings),name:doc.name,kind:doc.kind};}catch(e){toast(e.message);}finally{importBusy=false;render();requestAnimationFrame(()=>$('.review-section')?.scrollIntoView({block:'start'}));}}
function download(name,text,type='application/json'){if(platform()!=='web'){callNative('exportFile',{name,text,type}).then(()=>toast('已打开系统分享 / 保存')).catch(e=>toast(e.message));return;}const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

document.addEventListener('click',async event=>{
  const b=event.target.closest('button,a');if(!b)return;
  if(b.dataset.settingsPanel){selectSettingsPanel(b.dataset.settingsPanel);return;}
  if(b.dataset.exceptionScope){exceptionScope=b.dataset.exceptionScope;document.querySelectorAll('[data-exception-scope]').forEach(button=>{const active=button.dataset.exceptionScope===exceptionScope;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});$('#single-course-adjustment').hidden=exceptionScope!=='course';$('#whole-day-adjustment').hidden=exceptionScope!=='day';return;}
  if(b.dataset.editAdjustment!==undefined){openAdjustment(+b.dataset.editAdjustment);return;}
  if(b.dataset.adjustment){openAdjustment(state.exceptions.findIndex(e=>e.id===b.dataset.adjustment));return;}
  if(b.dataset.route){route=b.dataset.route;render();window.scrollTo(0,0);return;}
  if(b.dataset.view){view=b.dataset.view;render();return;}
  if(b.dataset.date){selected=b.dataset.date;view='day';render();return;}
  if(b.dataset.edit){openEditor(b.dataset.edit);return;}
  if(b.dataset.review){openEditor(b.dataset.review,true);return;}
  if(b.dataset.removeReview){importResult.courses=importResult.courses.filter(c=>c.id!==b.dataset.removeReview);$('#course-dialog').close();render();return;}
  if(b.dataset.deleteCourse){if(confirm('删除这门课程？对应的起床计划会重新计算。')){state.courses=state.courses.filter(c=>c.id!==b.dataset.deleteCourse);state.exceptions=state.exceptions.filter(e=>e.courseId!==b.dataset.deleteCourse);adjustmentDraft=null;$('#course-dialog').close();save();}return;}
  if(b.dataset.deleteException!==undefined){const record=state.exceptions.splice(+b.dataset.deleteException,1)[0];if(adjustmentDraft&&record?.courseId===adjustmentDraft.courseId&&record.date===adjustmentDraft.date)adjustmentDraft=courseAdjustmentDraft(state,record.date,record.courseId);save();toast('已撤销调整，课程与起床计划已更新');return;}
  if(b.dataset.weekPattern){updateWeeksFromRange(b.dataset.weekPattern);return;}
  if(b.dataset.week){const form=$('#course-form'),weeks=parseWeeks(form.elements.weeks.value,state.settings.totalWeeks),week=+b.dataset.week;const next=weeks.includes(week)?weeks.filter(w=>w!==week):[...weeks,week].sort((a,b)=>a-b);applyWeekSelection(next,{...inferWeekRule(next,state.settings.totalWeeks),pattern:'custom'});return;}
  if(b.dataset.timeMode){$('#course-form').elements.timeMode.value=b.dataset.timeMode;refreshCourseTiming();return;}
  if(b.dataset.periodActive!==undefined){periodActive=+b.dataset.periodActive;refreshPeriodPreview();$('#period-slider-panel').scrollIntoView({block:'nearest',behavior:'smooth'});return;}
  if(b.dataset.periodCount){const count=periodList().length+(+b.dataset.periodCount);if(count<(periodScope==='common'?1:0)||count>20)return;const periods=resizePeriods(periodList(),count);if(periodScope==='common')periodDraft.periods=periods;else periodDraft.periodsByDay[periodScope]=periods;refreshPeriods();return;}
  switch(b.dataset.action){
    case'import':route='import';render();window.scrollTo(0,0);break;
    case'settings-periods':settingsPanel='periods';route='settings';render();window.scrollTo(0,0);break;
    case'demo':state=makeDemo();periodDraft=null;adjustmentDraft=null;save();break;
    case'new':state=createState();periodDraft=null;adjustmentDraft=null;selected=dateParts().date;save();break;
    case'add':openEditor();break;
    case'add-import':openEditor(null,true);break;
    case'close-dialog':$('#course-dialog').close();break;
    case'previous':selected=addDays(selected,-7);render();break;
    case'next':selected=addDays(selected,7);render();break;
    case'today':selected=dateParts().date;render();requestAnimationFrame(()=>$('.time-pointer')?.scrollIntoView({behavior:'smooth',block:'center'}));break;
    case'all-days':showAllDays=!showAllDays;render();break;
    case'parse-text':{const text=$('#paste-text').value;if(!text.trim()){toast('请先粘贴课表文字');break;}importResult={...parseTimetable({text},state.settings),name:'粘贴文字',kind:'text'};render();requestAnimationFrame(()=>$('.review-section')?.scrollIntoView({block:'start'}));break;}
    case'commit-import':{if(!importResult?.courses.length)break;if(state.demo){state.courses=[];state.exceptions=[];adjustmentDraft=null;state.demo=false;}const keys=new Set(state.courses.map(c=>[c.name,c.day,c.start,c.end,c.weeks.join(',')].join('|')));let added=0;for(const c of importResult.courses){const key=[c.name,c.day,c.start,c.end,c.weeks.join(',')].join('|');if(!keys.has(key)){state.courses.push(c);keys.add(key);added++;}}importResult=null;route='home';save();toast(`已加入 ${added} 门课程，点击课程可校对并确认`);break;}
    case'backup':download(`晨课备份-${dateParts().date}.json`,JSON.stringify(state,null,2));break;
    case'ics':download('晨课课程.ics',icsExport(state,state.settings.week1,state.settings.totalWeeks*7),'text/calendar');break;
    case'clear':if(confirm('将清空所有课程和设置，并请求取消晨课管理的提醒。已经交给系统时钟的闹钟须到时钟中删除。建议先导出备份。')){state=createState();periodDraft=null;adjustmentDraft=null;save();toast('课表已清空');}break;
    case'period-inherit':delete periodDraft.periodsByDay[periodScope];refreshPeriods();break;
    case'sync':try{if(platform()==='harmony'){const c=await callNative('requestPermissions');updateNativeCaps(c);if(c.reminderGranted===false){nativeStatus=c;render();break;}}if(platform()==='android'&&!androidClockMode()){const c=await callNative('requestPermissions');if(!c.exactAllowed||!c.notificationsAllowed){toast(c.message);break;}}await sync(true);render();}catch(e){toast(e.message);}break;
    case'clock-pause':{const date=addDays(dateParts().date,1),dates=state.settings.alarmSkippedDates??[];state.settings.alarmSkippedDates=dates.includes(date)?dates.filter(d=>d!==date):[...dates.filter(d=>d>=dateParts().date).slice(-59),date];save();toast('已更新自动发送设置；已发送的闹钟请在系统时钟中管理');break;}
    case'clock-next':await openSystemClock('openClockAlarm');break;
    case'clock-test':await openSystemClock('testClockAlarm');break;
    case'clock-show':await openSystemClock('showClockAlarms');break;
    case'cancel-test-alarm':await harmonyTest('cancelTestAlarm');break;
    case'test-alarm':if(platform()==='harmony'){await harmonyTest();break;}if(platform()==='web'){toast('网页预览不能设置系统闹钟，请在原生版测试');}else{try{if(platform()==='android'){const c=await callNative('requestPermissions');if(!c.exactAllowed||!c.notificationsAllowed){toast(c.message);break;}}const r=await callNative('testAlarm');toast(r.message);}catch(e){toast(e.message);}}break;
  }
});
document.addEventListener('keydown',event=>{
  const tab=event.target.closest('[data-settings-panel]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const tabs=[...document.querySelectorAll('[data-settings-panel]')],index=tabs.indexOf(tab);const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;selectSettingsPanel(tabs[next].dataset.settingsPanel,true);
});

document.addEventListener('input',event=>{
  const el=event.target;
  if(el.closest('#course-adjustment-form')&&!['date','courseId','type'].includes(el.name)){readAdjustmentDraft(el.form);$('#course-adjustment-preview').innerHTML=adjustmentPreview(state,adjustmentDraft);$('#adjustment-error').textContent='';}
  if(el.id==='lead-slider'){const value=+el.value;$('#lead-value').textContent=value;$('#lead-input').value=value;}
  if(el.closest('#settings-form')&&['week1','totalWeeks'].includes(el.name))$('#semester-preview').textContent=semesterPreview();
  if(el.dataset.periodIndex!==undefined){const periods=periodList(true);periods[+el.dataset.periodIndex][el.dataset.periodPart]=el.value;periodActive=+el.dataset.periodIndex;refreshPeriodPreview();}
  if(el.dataset.periodSlider){const part=el.dataset.periodSlider,periods=periodList(true);periods[periodActive][part]=clock(+el.value);$('#period-'+part+'-output').textContent=clock(+el.value);const input=$('#periods-form [name="p'+periodActive+(part==='start'?'s':'e')+'"]');if(input)input.value=clock(+el.value);refreshPeriodPreview(true);}
});
document.addEventListener('change',async event=>{
  const el=event.target;
  if(el.closest('#course-adjustment-form')){if(el.name==='date'){adjustmentDraft=courseAdjustmentDraft(state,el.value);refreshAdjustmentForm('date');}else if(el.name==='courseId'){adjustmentDraft=courseAdjustmentDraft(state,adjustmentDraft.date,el.value);refreshAdjustmentForm('courseId');}else if(el.name==='type'){adjustmentDraft.type=el.value;refreshAdjustmentForm('type');}return;}
  if(el.closest('#exception-form')&&el.name==='type'){const show=el.value==='replaceDay';$('#exception-day-label').hidden=!show;el.form.elements.day.disabled=!show;return;}
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
  if(el.id==='restore-input'&&el.files[0]){try{if(el.files[0].size>5*1024*1024)throw Error('备份文件超过 5 MB');const next=validateState(JSON.parse(await el.files[0].text()));if(confirm('用备份替换当前课表？请先保存现有记录。')){state=next;periodDraft=null;adjustmentDraft=null;state.settings.enabled=false;save();toast('备份已恢复，请检查后重新启用闹钟');}}catch(e){toast(`恢复失败：${e.message}`);}}
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
  if(form.id==='course-adjustment-form'){readAdjustmentDraft(form);try{state=applyCourseAdjustment(state,adjustmentDraft);save();toast('本次课程已调整，起床计划已更新');}catch(error){$('#adjustment-error').textContent=error.message;$('#course-adjustment-preview .adjustment-instruction')?.remove();}return;}
  if(form.id==='exception-form'){const candidate=structuredClone(state);candidate.exceptions=candidate.exceptions.filter(e=>e.date!==d.date||!['skip','replaceDay'].includes(e.type));candidate.exceptions.push({date:d.date,type:d.type,...(d.type==='replaceDay'?{day:+d.day}:{}),note:d.note});candidate.exceptions.sort((a,b)=>a.date.localeCompare(b.date));try{state=validateState(candidate);save();toast('整天安排已保存，起床计划已更新');}catch(error){$('#exception-error').textContent=error.message;}}
});
document.addEventListener('dragover',event=>{if(event.target.closest('.dropzone'))event.preventDefault();});
document.addEventListener('drop',event=>{if(event.target.closest('.dropzone')){event.preventDefault();processFile(event.dataTransfer.files[0]);}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(route==='home')render();if(platform()==='harmony')globalThis.chenkeNativeResume?.();else sync();}});
setInterval(()=>{if(!document.hidden&&!$('#course-dialog').open){if(route==='home')render();if(androidClockMode())sync();}},60000);
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
  try{const c=await capabilities();nativeCaps=c;rememberClock(c);if(c.message)nativeStatus={...c,mode:c.mode??'pending',scheduled:0};}
  catch(e){nativeStatus={mode:'error',message:e.message};}
  try{const data=await callNative('loadState');if(data?.state)state=validateState(data.state);}
  catch(e){toast(`设备记录读取失败：${e.message}`);}
  render();syncFingerprint='';sync();
};
globalThis.chenkeNativeResume=()=>{
  if(!nativeInitialized||platform()==='web')return;
  clearTimeout(nativeResumeTimer);
  nativeResumeTimer=setTimeout(async()=>{
    try{const c=await capabilities();nativeCaps=c;rememberClock(c);if(c.message)nativeStatus={...c,mode:c.mode??'pending',scheduled:0};}
    catch(e){nativeStatus={mode:'error',message:e.message};}
    await sync(true);
  },100);
};
if(platform()!=='web')globalThis.chenkeNativeReady();else{capabilities().then(c=>nativeCaps=c);sync();}
if(platform()==='web'&&'serviceWorker'in navigator&&/^https?:$/.test(location.protocol)&&!import.meta.env.DEV)navigator.serviceWorker.register('./sw.js').catch(()=>{});

document.addEventListener('change',event=>{if(event.target.id==='android-alarm-mode'){state.settings.androidAlarmMode=event.target.value;syncFingerprint='';save();}});
