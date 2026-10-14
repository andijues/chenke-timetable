import {uid} from './core.mjs';
const pending = new Map();
globalThis.chenkeNativeResult = result => {
  if (typeof result==='string') {try {result=JSON.parse(result);} catch{return;}}
  const p=pending.get(result.id);if(!p)return;pending.delete(result.id);clearTimeout(p.timer);
  result.error?p.reject(Error(result.error)):p.resolve(result.data);
};
export function platform() {return globalThis.__chenkePlatform??(globalThis.webkit?.messageHandlers?.chenke?'ios':globalThis.HarmonyBridge?'harmony':'web');}
export function callNative(action,payload={}) {
  if(platform()==='web') return Promise.reject(Error('当前是网页预览，不能直接设置手机系统闹钟'));
  const id=uid();
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('设备操作尚未完成，请返回应用检查权限并重试'));},60000);
    pending.set(id,{resolve,reject,timer});
    try {const message={id,action,payload};if(globalThis.webkit?.messageHandlers?.chenke)globalThis.webkit.messageHandlers.chenke.postMessage(message);else globalThis.HarmonyBridge.postMessage(JSON.stringify(message));}catch(e){pending.delete(id);clearTimeout(timer);reject(e);}
  });
}
export async function capabilities() {
  return platform()==='web'?{platform:'web',supported:false,mode:'preview',message:'网页可计算起床时间；系统闹钟需要原生版或 iOS 快捷指令。'}:callNative('capabilities');
}
export async function dispatchAlarms(plans) {
  if(platform()==='web')return {mode:'preview',scheduled:0,message:'已更新起床预览，尚未设置系统闹钟。'};
  return callNative('syncAlarms',{plans});
}
export function shortcutURL(plans) {return `shortcuts://run-shortcut?name=${encodeURIComponent('晨课闹钟')}&input=text&text=${encodeURIComponent(JSON.stringify({version:1,generatedAt:new Date().toISOString(),plans}))}`;}
