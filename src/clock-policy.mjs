import {addDays,dateParts,morningPlan,planAlarms} from './core.mjs';

// A public Clock intent names a time of day, so send only its actual next occurrence.
export function tomorrowClock(state,now=new Date()){
  const today=dateParts(now).date,date=addDays(today,1),morning=morningPlan(state,date);
  const base={date,morning,plan:null,canSend:false};
  if(state.demo)return {...base,status:'demo',message:'演示课表不会设置闹钟'};
  if(!state.settings.enabled)return {...base,status:'off',message:'开启自动安排后，按明天首课计算'};
  if(morning.status!=='ready')return {...base,status:morning.status,message:morning.reason};
  const plan=planAlarms(state,now).find(p=>p.date===date);
  if(!plan)return {...base,status:'expired',message:'起床时间已过，请核对提前量'};
  const at=Date.parse(plan.fireAt),clockToday=Date.parse(`${today}T${plan.alarmTime}:00+08:00`);
  const next=clockToday>now.getTime()?clockToday:clockToday+86400000;
  if(at!==next)return {...base,plan,status:'deferred',message:`今天 ${plan.alarmTime} 之后再打开晨课，会为明天发送；现在发送会被时钟理解为今天`};
  if(at-now.getTime()<60000)return {...base,plan,status:'expired',message:'距离起床不足1分钟，请直接核对系统时钟'};
  return {...base,plan,status:'ready',canSend:true,message:'将自动请求明日的一次性系统闹钟'};
}

export function clockRequestKey(plan){return plan?JSON.stringify([plan.date,plan.fireAt,plan.course]):'';}
