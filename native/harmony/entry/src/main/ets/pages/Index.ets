import { webview } from '@kit.ArkWeb';
import { common } from '@kit.AbilityKit';
import { preferences } from '@kit.ArkData';
import { notificationManager } from '@kit.NotificationKit';
import { reminderAgentManager } from '@kit.BackgroundTasksKit';
import { picker, fileIo } from '@kit.CoreFileKit';
import { BusinessError } from '@kit.BasicServicesKit';

interface WakePlan { id: string; fireAt: string; date: string; course: string; courseStart: string; }
interface LedgerItem { key: string; reminderId: number; fireAt: string; course: string; }
interface BridgePayload { state?: Object; plans?: WakePlan[]; name?: string; text?: string; type?: string; }
interface BridgeMessage { id: string; action: string; payload: BridgePayload; }
interface BridgeResponse { id: string; data?: Object; error?: string; }
interface SyncResult { mode: string; scheduled: number; message: string; }

class HarmonyBridge {
  private store?: preferences.Preferences;
  private queue: Promise<void> = Promise.resolve();
  private context: common.UIAbilityContext;
  private controller: webview.WebviewController;
  constructor(context: common.UIAbilityContext, controller: webview.WebviewController) {
    this.context = context; this.controller = controller;
  }
  postMessage(raw: string): void {
    // Serialize mutations: an older alarm plan cannot overtake a more recent edit.
    this.queue = this.queue.then(async () => {
      let message: BridgeMessage;
      try { message = JSON.parse(raw) as BridgeMessage; } catch { return; }
      try {
        const data = await this.handle(message.action, message.payload);
        this.reply({ id: message.id, data: data });
      } catch (e) {
        const error = e as BusinessError;
        this.reply({ id: message.id, error: `${error.message || '设备操作失败'}${error.code ? ` (${error.code})` : ''}` });
      }
    }).catch(() => {});
  }
  private reply(value: BridgeResponse): void {
    this.controller.runJavaScript(`window.chenkeNativeResult(${JSON.stringify(value)});`).catch(() => {});
  }
  private async getStore(): Promise<preferences.Preferences> {
    if (!this.store) this.store = await preferences.getPreferences(this.context, {name: 'chenke'});
    return this.store;
  }
  private async readLedger(): Promise<LedgerItem[]> {
    const store = await this.getStore();
    const raw = await store.get('alarmLedger', '[]');
    return JSON.parse(raw as string) as LedgerItem[];
  }
  private async writeLedger(ledger: LedgerItem[]): Promise<void> {
    const store = await this.getStore(); await store.put('alarmLedger', JSON.stringify(ledger)); await store.flush();
  }
  private async publish(plan: WakePlan, notificationId: number): Promise<number> {
    const date = new Date(plan.fireAt);
    // Plans contain absolute ISO instants. The system calendar API accepts local components.
    const request: reminderAgentManager.ReminderRequestCalendar = {
      reminderType: reminderAgentManager.ReminderType.REMINDER_TYPE_CALENDAR,
      dateTime: { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds() },
      title: '该起床啦', content: `${plan.course} · ${plan.courseStart} 上课`, expiredContent: '起床提醒已结束',
      notificationId: notificationId, slotType: notificationManager.SlotType.SERVICE_INFORMATION,
      ringDuration: 60, customRingUri: 'resource://RAWFILE/wake.wav', snoozeTimes: 2, timeInterval: 300,
      wantAgent: {pkgName: 'com.personal.chenke', abilityName: 'EntryAbility'},
      actionButton: [{title: '关闭', type: reminderAgentManager.ActionButtonType.ACTION_BUTTON_TYPE_CLOSE}, {title: '稍后提醒', type: reminderAgentManager.ActionButtonType.ACTION_BUTTON_TYPE_SNOOZE}]
    };
    return await reminderAgentManager.publishReminder(request);
  }
  private async synchronize(plans: WakePlan[]): Promise<SyncResult> {
    if (plans.length > 28) throw new Error('起床计划超过 28 个');
    if (plans.some(plan => !plan.id.startsWith('chenke-') || !Number.isFinite(Date.parse(plan.fireAt)) || Date.parse(plan.fireAt) <= Date.now() || Date.parse(plan.fireAt) > Date.now() + 30 * 86400000)) throw new Error('起床计划无效或已过期');
    if (plans.length) await notificationManager.requestEnableNotification(this.context);
    let ledger = await this.readLedger();
    const active = await reminderAgentManager.getValidReminders();
    for (const item of ledger) {
      const desired = plans.find(plan => plan.id === item.key);
      if (!desired || desired.fireAt !== item.fireAt || desired.course !== item.course) {
        if (active.some(info => info.reminderId === item.reminderId)) await reminderAgentManager.cancelReminder(item.reminderId);
        ledger = ledger.filter(row => row.key !== item.key); await this.writeLedger(ledger);
      }
    }
    for (let index = 0; index < plans.length; index++) {
      const plan = plans[index];
      const saved = ledger.find(row => row.key === plan.id);
      if (saved && active.some(info => info.reminderId === saved.reminderId)) continue;
      ledger = ledger.filter(row => row.key !== plan.id);
      const notificationId = Number(plan.date.replace(/-/g, ''));
      const id = await this.publish(plan, notificationId);
      ledger.push({key: plan.id, reminderId: id, fireAt: plan.fireAt, course: plan.course}); await this.writeLedger(ledger);
    }
    return {mode: 'system-reminder', scheduled: plans.length, message: plans.length ? '系统已接受起床代理提醒。请先做锁屏测试，确认声音、通知和后台设置。' : '本应用的起床提醒已取消或当前无晨课。'};
  }
  private async handle(action: string, payload: BridgePayload): Promise<Object> {
    switch (action) {
      case 'capabilities': return {platform: 'harmony', supported: true, mode: 'pending', message: '鸿蒙系统代理提醒就绪，启用后请求通知权限。'};
      case 'saveState': {
        if (!payload.state) throw new Error('课表格式无效');
        const store = await this.getStore(); await store.put('state', JSON.stringify(payload.state)); await store.flush(); return {saved: true};
      }
      case 'loadState': {
        const store = await this.getStore(); const raw = await store.get('state', '');
        return raw ? {state: JSON.parse(raw as string) as Object} : {};
      }
      case 'syncAlarms': return await this.synchronize(payload.plans || []);
      case 'testAlarm': {
        await notificationManager.requestEnableNotification(this.context);
        let ledger = await this.readLedger(); const old = ledger.find(item => item.key === 'chenke-test');
        if (old) { try { await reminderAgentManager.cancelReminder(old.reminderId); } catch {} }
        const date = new Date(Date.now() + 60000);
        const id = await this.publish({id: 'chenke-test', fireAt: date.toISOString(), date: '', course: '一分钟测试', courseStart: ''}, 999999);
        ledger = ledger.filter(item => item.key !== 'chenke-test'); ledger.push({key: 'chenke-test', reminderId: id, fireAt: date.toISOString(), course: '一分钟测试'}); await this.writeLedger(ledger);
        return {message: '系统已接受一分钟测试提醒，请锁屏验证响铃。'};
      }
      case 'exportFile': {
        if (!payload.text || !payload.name || payload.text.length > 5000000) throw new Error('导出内容无效');
        const dialog = new picker.DocumentViewPicker(this.context); const options = new picker.DocumentSaveOptions(); options.newFileNames = [payload.name.replace(/[\\/]/g, '_')];
        const uris = await dialog.save(options); if (!uris.length) throw new Error('已取消保存');
        const file = fileIo.openSync(uris[0], fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.CREATE | fileIo.OpenMode.TRUNC);
        try { fileIo.writeSync(file.fd, payload.text); } finally { fileIo.closeSync(file); }
        return {exported: true};
      }
      default: throw new Error('未支持的设备操作');
    }
  }
}

@Entry
@Component
struct Index {
  private controller: webview.WebviewController = new webview.WebviewController();
  private bridge: HarmonyBridge = new HarmonyBridge(getContext(this) as common.UIAbilityContext, this.controller);
  private localResponse(url: string): WebResourceResponse {
    const response = new WebResourceResponse();
    const context = getContext(this) as common.UIAbilityContext;
    try {
      const path = decodeURIComponent(url.replace('https://chenke.local/', '').split('?')[0]);
      if (path.includes('..') || path.includes('\\')) throw new Error('路径无效');
      const bytes = context.resourceManager.getRawFileContentSync(`web/${path || 'index.html'}`);
      response.setResponseData(bytes.buffer);
      response.setResponseEncoding('UTF-8');
      response.setResponseMimeType(path.endsWith('.html') ? 'text/html' : path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.svg') ? 'image/svg+xml' : path.endsWith('.wasm') ? 'application/wasm' : path.endsWith('.json') || path.endsWith('.webmanifest') ? 'application/json' : 'application/octet-stream');
      response.setResponseHeader([{headerKey: 'Access-Control-Allow-Origin', headerValue: '*'}]);
      response.setResponseCode(200); response.setReasonMessage('OK');
    } catch {
      response.setResponseData(''); response.setResponseCode(404); response.setReasonMessage('Not Found');
    }
    return response;
  }
  build() {
    Column() {
      // Virtual HTTPS origin is entirely served from bundled raw files. No website/server is contacted.
      Web({src: 'https://chenke.local/index.html', controller: this.controller})
        .javaScriptAccess(true).domStorageAccess(true).fileAccess(true)
        .javaScriptProxy({object: this.bridge, name: 'HarmonyBridge', methodList: ['postMessage'], controller: this.controller})
        .onInterceptRequest(event => {
          if (!event) return new WebResourceResponse();
          return this.localResponse(event.request.getRequestUrl());
        })
        .onShowFileSelector(event => {
          if (!event) return false;
          const dialog = new picker.DocumentViewPicker(getContext(this) as common.UIAbilityContext);
          const options = new picker.DocumentSelectOptions(); options.maxSelectNumber = 1;
          dialog.select(options).then(uris => event.result.handleFileList(uris)).catch(() => event.result.handleFileList([]));
          return true;
        })
        .onPageEnd(() => {
          this.controller.runJavaScript("window.__chenkePlatform='harmony';window.chenkeNativeReady&&window.chenkeNativeReady();").catch(() => {});
        })
        .width('100%').height('100%')
    }.width('100%').height('100%').backgroundColor('#F5F7F6')
  }
}
