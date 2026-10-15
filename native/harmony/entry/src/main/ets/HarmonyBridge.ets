import { webview } from '@kit.ArkWeb';
import { common } from '@kit.AbilityKit';
import { preferences } from '@kit.ArkData';
import { notificationManager } from '@kit.NotificationKit';
import { reminderAgentManager } from '@kit.BackgroundTasksKit';
import { abilityAccessCtrl } from '@kit.AbilityKit';
import { picker, fileIo } from '@kit.CoreFileKit';
import { BusinessError } from '@kit.BasicServicesKit';

interface WakePlan { id: string; fireAt: string; date: string; course: string; courseStart: string; }
interface LedgerItem { key: string; reminderId: number; fireAt: string; course: string; courseStart?: string; }
interface BridgePayload { state?: Object; plans?: WakePlan[]; name?: string; text?: string; type?: string; handled?: boolean; }
interface BridgeMessage { id: string; action: string; payload: BridgePayload; }
interface BridgeResult {
  platform?: string; supported?: boolean; mode?: string; scheduled?: number; message?: string;
  saved?: boolean; state?: Object; exported?: boolean; failed?: boolean; reminderGranted?: boolean;
  notificationsAllowed?: boolean; activeReminders?: number; testScheduled?: boolean;
}
interface BridgeResponse { id: string; data?: BridgeResult; error?: string; }

export class HarmonyBridge {
  private store?: preferences.Preferences;
  private queue: Promise<void> = Promise.resolve();
  private handlesBack: boolean = false;
  private context: common.UIAbilityContext;
  private controller: webview.WebviewController;
  constructor(context: common.UIAbilityContext, controller: webview.WebviewController) {
    this.context = context; this.controller = controller;
  }

  shouldHandleBack(): boolean { return this.handlesBack; }
  postMessage(raw: string): void {
    let message: BridgeMessage;
    try { message = JSON.parse(raw) as BridgeMessage; } catch { return; }
    if (!message.id || !message.action || !message.payload) return;
    // System dialogs must not hold up navigation or turning off course reminders.
    if (message.action === 'exportFile' || message.action === 'setBackState') {
      this.execute(message).catch(() => {}); return;
    }
    this.queue = this.queue.then(() => this.execute(message)).catch(() => {});
  }
  private async execute(message: BridgeMessage): Promise<void> {
    try { this.reply({id: message.id, data: await this.handle(message.action, message.payload)}); }
    catch (e) {
      const error = e as BusinessError;
      this.reply({id: message.id, error: `${error.message || '设备操作失败'}${error.code ? ` (${error.code})` : ''}`});
    }
  }
  private reply(value: BridgeResponse): void {
    try { this.controller.runJavaScript(`window.chenkeNativeResult(${JSON.stringify(value)});`).catch(() => {}); }
    catch { /* State is reconciled when the Web component returns. */ }
  }
  private async getStore(): Promise<preferences.Preferences> {
    if (!this.store) this.store = await preferences.getPreferences(this.context, {name: 'chenke'});
    return this.store;
  }
  private async readLedger(): Promise<LedgerItem[]> {
    const raw = await (await this.getStore()).get('alarmLedger', '[]');
    const rows = JSON.parse(raw as string) as LedgerItem[];
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row.key !== 'string' ||
      !row.key.startsWith('chenke-') || !Number.isInteger(row.reminderId) || row.reminderId < 0 ||
      !Number.isFinite(Date.parse(row.fireAt)))) throw new Error('提醒记录无法读取。请保留课表备份，暂用手机时钟设置闹钟。');
    return rows;
  }
  private async writeLedger(ledger: LedgerItem[]): Promise<void> {
    const store = await this.getStore(); await store.put('alarmLedger', JSON.stringify(ledger)); await store.flush();
  }
  private async inspect(): Promise<BridgeResult> {
    const granted = await abilityAccessCtrl.createAtManager().checkAccessToken(
      this.context.applicationInfo.accessTokenId, 'ohos.permission.PUBLISH_AGENT_REMINDER');
    const reminderGranted = granted === abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED;
    const notificationsAllowed = await notificationManager.isNotificationEnabled();
    if (!reminderGranted) return {platform: 'harmony', supported: true, mode: 'blocked', scheduled: 0,
      failed: true, reminderGranted: false, notificationsAllowed,
      message: '此安装包尚未获得系统代理提醒授权。课表和起床时间预览可正常使用，更新已授权版本后再测试响铃。'};
    const active = await reminderAgentManager.getAllValidReminders();
    return {platform: 'harmony', supported: true, mode: notificationsAllowed ? 'pending' : 'blocked',
      reminderGranted: true, notificationsAllowed, activeReminders: active.length,
      message: notificationsAllowed ? '系统权限已授予。安排提醒后仍需锁屏测试响铃。' : '通知未允许。点击“检查权限并更新”后授权，才能安排系统提醒。'};
  }
  private async ensureNotifications(): Promise<void> {
    if (!await notificationManager.isNotificationEnabled()) await notificationManager.requestEnableNotification(this.context);
    if (!await notificationManager.isNotificationEnabled()) throw new Error('通知权限未开启。请在手机设置中允许晨课通知，再回来更新起床提醒。');
    await notificationManager.addSlot(notificationManager.SlotType.SERVICE_INFORMATION);
  }
  private async cancelOwned(id: number): Promise<void> {
    try { await reminderAgentManager.cancelReminder(id); }
    catch (e) {
      const error = e as BusinessError;
      if (error.code !== 1700003) throw new Error(`${error.message || '取消提醒失败'} (${error.code})`);
    } // May expire after the active-list snapshot.
  }
  private async publish(plan: WakePlan, notificationId: number): Promise<number> {
    const date = new Date(plan.fireAt);
    const request: reminderAgentManager.ReminderRequestCalendar = {
      reminderType: reminderAgentManager.ReminderType.REMINDER_TYPE_CALENDAR,
      dateTime: {year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds()},
      title: '该起床啦', content: plan.courseStart ? `${plan.course} · ${plan.courseStart} 上课` : plan.course,
      expiredContent: '起床提醒已结束', notificationId, slotType: notificationManager.SlotType.SERVICE_INFORMATION,
      ringDuration: 60, ringChannel: reminderAgentManager.RingChannel.RING_CHANNEL_ALARM,
      customRingUri: 'resource://RAWFILE/wake.wav', snoozeTimes: 2, timeInterval: 300,
      snoozeSlotType: notificationManager.SlotType.SERVICE_INFORMATION,
      wantAgent: {pkgName: 'com.andijues.chenke', abilityName: 'EntryAbility'},
      actionButton: [{title: '关闭', type: reminderAgentManager.ActionButtonType.ACTION_BUTTON_TYPE_CLOSE},
        {title: '稍后提醒', type: reminderAgentManager.ActionButtonType.ACTION_BUTTON_TYPE_SNOOZE}]
    };
    return await reminderAgentManager.publishReminder(request);
  }
  private async savePublished(ledger: LedgerItem[], item: LedgerItem): Promise<LedgerItem[]> {
    const next = [...ledger, item];
    try { await this.writeLedger(next); }
    catch (e) { await this.cancelOwned(item.reminderId); throw new Error((e as BusinessError).message || '提醒记录保存失败'); }
    return next;
  }
  private async synchronize(plans: WakePlan[]): Promise<BridgeResult> {
    const now = Date.now();
    if (plans.length > 28 || plans.some(plan => !plan || typeof plan.id !== 'string' ||
      !plan.id.startsWith('chenke-') || plan.id === 'chenke-test' || !/^\d{4}-\d{2}-\d{2}$/.test(plan.date) ||
      !Number.isFinite(Date.parse(plan.fireAt)) || Date.parse(plan.fireAt) <= now ||
      Date.parse(plan.fireAt) > now + 30 * 86400000 || typeof plan.course !== 'string')) throw new Error('起床计划无效、超过 28 个或已过期，请重新计算。');
    const keys: string[] = [];
    for (const plan of plans) { if (keys.includes(plan.id)) throw new Error('起床计划有重复日期，请重新更新'); keys.push(plan.id); }
    const status = await this.inspect();
    if (!status.reminderGranted || (plans.length > 0 && !status.notificationsAllowed)) { status.failed = true; return status; }
    if (plans.length > 0) await notificationManager.addSlot(notificationManager.SlotType.SERVICE_INFORMATION);
    const active = await reminderAgentManager.getAllValidReminders();
    let ledger = (await this.readLedger()).filter(row => active.some(info => info.reminderId === row.reminderId));
    await this.writeLedger(ledger);
    // Remove obsolete course alarms, preserving the separately requested test reminder.
    for (const item of [...ledger]) {
      if (item.key !== 'chenke-test' && !keys.includes(item.key)) {
        await this.cancelOwned(item.reminderId); ledger = ledger.filter(row => row.reminderId !== item.reminderId); await this.writeLedger(ledger);
      }
    }
    let completed = 0;
    for (const plan of plans) {
      const old = ledger.filter(row => row.key === plan.id);
      let saved = old.find(row => row.fireAt === plan.fireAt && row.course === plan.course && row.courseStart === plan.courseStart);
      if (!saved) {
        try {
          const id = await this.publish(plan, Number(plan.date.replace(/-/g, '')));
          saved = {key: plan.id, reminderId: id, fireAt: plan.fireAt, course: plan.course, courseStart: plan.courseStart};
          ledger = await this.savePublished(ledger, saved);
        } catch (e) {
          const error = e as BusinessError;
          const reason = error.code === 1700002 ? '系统拒绝新增提醒（1700002）：提醒配额或安装包的代理提醒授权不可用' : error.message || '系统未接受提醒';
          return {mode: 'error', failed: true, scheduled: completed, reminderGranted: status.reminderGranted,
            notificationsAllowed: status.notificationsAllowed,
            message: `已更新 ${completed}/${plans.length} 个日期。${plan.course} 未更新：${reason}。原有提醒保留，请核对手机时钟或更新已授权版本。`};
        }
      }
      // Persist the replacement before cancelling the old one. A rejected publish must not erase the old alarm.
      for (const item of old) {
        if (item.reminderId === saved.reminderId) continue;
        await this.cancelOwned(item.reminderId); ledger = ledger.filter(row => row.reminderId !== item.reminderId); await this.writeLedger(ledger);
      }
      completed++;
    }
    const confirmed = await reminderAgentManager.getAllValidReminders();
    return {mode: 'system-reminder', scheduled: completed, reminderGranted: true, notificationsAllowed: status.notificationsAllowed, activeReminders: confirmed.length,
      message: completed ? '系统已接受起床代理提醒。请先做锁屏测试，确认声音和退出应用后的响铃。' : '本应用的课程起床提醒已取消或当前无晨课；单独设置的测试提醒不受影响。'};
  }
  private async handle(action: string, payload: BridgePayload): Promise<BridgeResult> {
    switch (action) {
      case 'setBackState': this.handlesBack = payload.handled === true; return {saved: true};
      case 'capabilities': return await this.inspect();
      case 'requestPermissions': {
        const status = await this.inspect();
        if (!status.reminderGranted) return status;
        await this.ensureNotifications(); return await this.inspect();
      }
      case 'saveState': {
        if (!payload.state) throw new Error('课表格式无效');
        const store = await this.getStore(); await store.put('state', JSON.stringify(payload.state)); await store.flush(); return {saved: true};
      }
      case 'loadState': {
        const raw = await (await this.getStore()).get('state', '');
        return raw ? {state: JSON.parse(raw as string) as Object} : {};
      }
      case 'syncAlarms': return await this.synchronize(payload.plans || []);
      case 'testAlarm': {
        const status = await this.inspect(); if (!status.reminderGranted) return status;
        await this.ensureNotifications();
        let ledger = await this.readLedger(); const old = ledger.filter(item => item.key === 'chenke-test');
        const date = new Date(Date.now() + 60000);
        let id: number;
        try { id = await this.publish({id: 'chenke-test', fireAt: date.toISOString(), date: '', course: '一分钟测试', courseStart: ''}, 999999); }
        catch (e) {
          const error = e as BusinessError;
          if (error.code === 1700002) throw new Error(`系统拒绝新增提醒（1700002）。晨课有 ${status.activeReminders} 个有效提醒；请核对代理提醒授权和配额，原有提醒保留。`);
          throw new Error(`${error.message || '系统未接受测试提醒'}${error.code ? ` (${error.code})` : ''}`);
        }
        ledger = await this.savePublished(ledger, {key: 'chenke-test', reminderId: id, fireAt: date.toISOString(), course: '一分钟测试'});
        for (const item of old) { await this.cancelOwned(item.reminderId); ledger = ledger.filter(row => row.reminderId !== item.reminderId); await this.writeLedger(ledger); }
        const confirmed = await reminderAgentManager.getAllValidReminders();
        return {mode: 'system-test', testScheduled: true, reminderGranted: true, notificationsAllowed: true, activeReminders: confirmed.length,
          message: '系统已接受一分钟测试提醒。请退出应用并锁屏，确认是否响铃。'};
      }
      case 'cancelTestAlarm': {
        const status = await this.inspect(); if (!status.reminderGranted) return status;
        let ledger = await this.readLedger();
        for (const item of ledger.filter(row => row.key === 'chenke-test')) {
          await this.cancelOwned(item.reminderId); ledger = ledger.filter(row => row.reminderId !== item.reminderId); await this.writeLedger(ledger);
        }
        const confirmed = await reminderAgentManager.getAllValidReminders();
        return {testScheduled: false, reminderGranted: true, notificationsAllowed: status.notificationsAllowed, activeReminders: confirmed.length,
          message: '测试提醒已取消，课程起床提醒不受影响。'};
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
