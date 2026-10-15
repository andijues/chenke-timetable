import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';

// Execute the actual ArkTS bridge with OS services stubbed. This does not emulate system ringing.
const source=stripTypeScriptTypes(readFileSync(new URL('../../native/harmony/entry/src/main/ets/HarmonyBridge.ets',import.meta.url),'utf8')
  .replace(/^import .*;\r?\n/gm,'').replace('export class HarmonyBridge','class HarmonyBridge'));
const now=Date.parse('2026-10-15T12:00:00+08:00');
const plan={id:'chenke-2026-10-16',date:'2026-10-16',fireAt:'2026-10-15T23:00:00.000Z',course:'晨课',courseStart:'08:30'};
const item={key:plan.id,reminderId:10,fireAt:plan.fireAt,course:plan.course,courseStart:plan.courseStart};

function harness({granted=true,notifications=true,ledger=[],active=ledger.map(x=>({reminderId:x.reminderId})),publishError=null,cancelRace=false}={}){
  const data=new Map([['alarmLedger',JSON.stringify(ledger)]]),calls=[],pending=new Map();
  let next=100,sequence=0;
  const state={granted,notifications,active:[...active]};
  const manager={
    ReminderType:{REMINDER_TYPE_CALENDAR:1},RingChannel:{RING_CHANNEL_ALARM:1},ActionButtonType:{ACTION_BUTTON_TYPE_CLOSE:0,ACTION_BUTTON_TYPE_SNOOZE:1},
    async getAllValidReminders(){calls.push(['active']);return [...state.active];},
    async publishReminder(request){calls.push(['publish',request]);if(publishError)throw publishError;const id=next++;state.active.push({reminderId:id});return id;},
    async cancelReminder(id){calls.push(['cancel',id]);state.active=state.active.filter(x=>x.reminderId!==id);if(cancelRace)throw {code:1700003,message:'expired'};}
  };
  const bindings={
    Date:class extends Date {static now(){return now;}},console,
    abilityAccessCtrl:{GrantStatus:{PERMISSION_GRANTED:0},createAtManager:()=>({checkAccessToken:async()=>state.granted?0:-1})},
    preferences:{getPreferences:async()=>({get:async(k,f)=>data.get(k)??f,put:async(k,v)=>{data.set(k,v);calls.push(['persist',k]);},flush:async()=>{}})},
    notificationManager:{SlotType:{SERVICE_INFORMATION:1},isNotificationEnabled:async()=>state.notifications,
      requestEnableNotification:async()=>{calls.push(['permission']);state.notifications=true;},addSlot:async()=>{calls.push(['slot']);}},
    reminderAgentManager:manager,picker:{},fileIo:{}
  };
  vm.createContext(bindings);vm.runInContext(source+'\nglobalThis.BridgeUnderTest=HarmonyBridge;',bindings);
  const bridge=new bindings.BridgeUnderTest({applicationInfo:{accessTokenId:1}},{runJavaScript:async script=>{
    const result=JSON.parse(script.slice('window.chenkeNativeResult('.length,-2));
    const resolve=pending.get(result.id);pending.delete(result.id);resolve(result);
  }});
  return {state,calls,data,bridge,ledger:()=>JSON.parse(data.get('alarmLedger')),async call(action,payload={}){
    const id=String(++sequence);const promise=new Promise(resolve=>pending.set(id,resolve));
    bridge.postMessage(JSON.stringify({id,action,payload}));return await promise;
  }};
}

test('pending capability never publishes or prompts; local timetable still saves and reloads',async()=>{
  const h=harness({granted:false});
  assert.equal((await h.call('capabilities')).data.mode,'blocked');
  assert.equal((await h.call('syncAlarms',{plans:[plan]})).data.failed,true);
  assert.equal((await h.call('requestPermissions')).data.reminderGranted,false);
  assert.equal((await h.call('testAlarm')).data.mode,'blocked');
  await h.call('saveState',{state:{courses:['local-only']}});
  assert.deepEqual((await h.call('loadState')).data.state,{courses:['local-only']});
  assert.equal(h.calls.some(x=>['active','publish','permission'].includes(x[0])),false);
});
test('automatic reconciliation never asks for notification permission; explicit action can request it',async()=>{
  const h=harness({notifications:false});
  assert.equal((await h.call('syncAlarms',{plans:[plan]})).data.mode,'blocked');
  assert.equal(h.calls.some(x=>x[0]==='permission'),false);
  assert.equal((await h.call('requestPermissions')).data.notificationsAllowed,true);
  assert.equal(h.calls.filter(x=>x[0]==='permission').length,1);
});
test('unchanged course is not duplicated',async()=>{
  const h=harness({ledger:[item]});const r=await h.call('syncAlarms',{plans:[plan]});
  assert.equal(r.data.scheduled,1);assert.equal(h.calls.some(x=>x[0]==='publish'),false);
});
test('a rejected replacement preserves the previously active reminder',async()=>{
  const h=harness({ledger:[item],publishError:{code:1700002,message:'limit'}});
  const r=await h.call('syncAlarms',{plans:[{...plan,fireAt:'2026-10-15T23:30:00.000Z'}]});
  assert.equal(r.data.failed,true);assert.match(r.data.message,/1700002/);
  assert.deepEqual(h.ledger(),[item]);assert.equal(h.calls.some(x=>x[0]==='cancel'),false);
});
test('replacement is published and persisted before the old reminder is cancelled',async()=>{
  const h=harness({ledger:[item]});
  const r=await h.call('syncAlarms',{plans:[{...plan,courseStart:'09:00'}]});
  assert.equal(r.data.scheduled,1);const pub=h.calls.findIndex(x=>x[0]==='publish'),cancel=h.calls.findIndex(x=>x[0]==='cancel');
  assert.ok(pub>=0&&cancel>pub);assert.equal(h.calls[pub+1][0],'persist');
  assert.equal(h.ledger().length,1);assert.equal(h.ledger()[0].reminderId,100);
  assert.equal(h.calls.find(x=>x[0]==='publish')[1].ringChannel,1);
});
test('turning off courses cancels only ledger-owned course reminders and retains the test',async()=>{
  const testItem={...item,key:'chenke-test',reminderId:11};
  const h=harness({ledger:[item,testItem],active:[{reminderId:10},{reminderId:11},{reminderId:999}]});
  await h.call('syncAlarms',{plans:[]});
  assert.deepEqual(h.calls.filter(x=>x[0]==='cancel').map(x=>x[1]),[10]);assert.deepEqual(h.ledger(),[testItem]);
});
test('expired reminder between snapshot and cancellation does not block cancellation',async()=>{
  const h=harness({ledger:[item],cancelRace:true});const r=await h.call('syncAlarms',{plans:[]});
  assert.equal(r.data.scheduled,0);assert.deepEqual(h.ledger(),[]);
});
test('a separately requested test can be cancelled without touching course alarms',async()=>{
  const h=harness({ledger:[item]});const r=await h.call('testAlarm');assert.equal(r.data.testScheduled,true);
  assert.equal((await h.call('cancelTestAlarm')).data.testScheduled,false);
  assert.deepEqual(h.ledger(),[item]);assert.equal(h.calls.filter(x=>x[0]==='cancel').length,1);
});
test('interrupted replacement with two owned rows is reconciled to one matching reminder',async()=>{
  const h=harness({ledger:[item,{...item,reminderId:12,courseStart:'09:00'}]});
  await h.call('syncAlarms',{plans:[{...plan,courseStart:'09:00'}]});
  assert.deepEqual(h.ledger().map(x=>x.reminderId),[12]);assert.equal(h.calls.some(x=>x[0]==='publish'),false);
});
test('invalid dates and duplicate plans are rejected before OS publication',async()=>{
  for(const plans of [[{...plan,fireAt:'invalid'}],[plan,plan],[{...plan,id:'chenke-test'}]]){
    const h=harness();assert.ok((await h.call('syncAlarms',{plans})).error);
    assert.equal(h.calls.some(x=>x[0]==='publish'),false);
  }
});
test('malformed alarm ledger does not prevent independent course-state recovery',async()=>{
  const h=harness();h.data.set('alarmLedger','{}');
  assert.ok((await h.call('syncAlarms',{plans:[plan]})).error);
  await h.call('saveState',{state:{courses:[]}});assert.deepEqual((await h.call('loadState')).data.state,{courses:[]});
});
test('system Back state is updated immediately, independent of reminder queue',async()=>{
  const h=harness();await h.call('setBackState',{handled:true});assert.equal(h.bridge.shouldHandleBack(),true);
  await h.call('setBackState',{handled:false});assert.equal(h.bridge.shouldHandleBack(),false);
});
