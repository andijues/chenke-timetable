const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function harmonyAuthorization(caps,feedback,busy=false){
  const granted=caps?.reminderGranted;
  const waiting=granted===false;
  return `<section class="harmony-authorization" aria-labelledby="harmony-authorization-title"><h2 id="harmony-authorization-title">系统提醒授权</h2><dl><div><dt>代理提醒</dt><dd>${granted===true?'已授予':waiting?'等待授权':'正在检查'}</dd></div><div><dt>通知权限</dt><dd>${caps?.notificationsAllowed===true?'已允许':caps?.notificationsAllowed===false?'未允许':'正在检查'}</dd></div>${Number.isInteger(caps?.activeReminders)?`<div><dt>本应用有效提醒</dt><dd>${caps.activeReminders} 个</dd></div>`:''}</dl><p>${waiting?'课表、导入和起床时间计算都可正常使用。此安装包尚未获准发布系统提醒，请在更新已授权版本后测试响铃。':'权限状态来自手机系统。先安排一次测试，再退出应用并锁屏确认响铃。'}</p>${feedback?`<div class="harmony-feedback ${feedback.failed?'error':''}" role="${feedback.failed?'alert':'status'}"><p>${escape(feedback.message)}</p>${feedback.testScheduled?`<button class="text-button" data-action="cancel-test-alarm" ${busy?'disabled':''}>取消测试提醒</button>`:''}</div>`:''}</section>`;
}
