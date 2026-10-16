import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const harmonyOnly=process.argv.includes('--harmony-only');
const localOnly=harmonyOnly||process.argv.includes('--local-only');
const essential=['dist/index.html','dist/app.js','dist/style.css','native/harmony/entry/src/main/ets/pages/Index.ets','native/harmony/entry/src/main/module.json5','native/harmony/entry/src/main/resources/rawfile/wake.wav','native/android/app/build.gradle','native/android/app/src/main/AndroidManifest.xml','native/android/app/src/main/java/com/andijues/chenke/MainActivity.java','native/android/app/src/main/java/com/andijues/chenke/BundledPage.java','native/android/app/src/main/java/com/andijues/chenke/ResourcePolicy.java','native/android/app/src/main/java/com/andijues/chenke/AlarmStore.java','native/android/app/src/main/java/com/andijues/chenke/RingService.java'];
const files=[];
essential.push('src/harmony-ui.mjs','native/harmony/entry/src/main/ets/HarmonyBridge.ets','native/harmony/entry/src/main/ets/entryability/EntryAbility.ets');
essential.push('src/main.mjs','src/home-ui.mjs','src/clock-policy.mjs','native/android/app/src/main/java/com/andijues/chenke/SystemClock.java','native/android/app/src/main/java/com/andijues/chenke/ClockTime.java');
essential.push('src/schedule-ui.mjs','src/core.mjs','src/adjustments-ui.mjs','index.html');
for(const path of essential){const bytes=await readFile(path);files.push({path,bytes:bytes.length,sha256:hash(bytes)});}
const ui=['schedule-desktop-settings','schedule-phone-settings','schedule-user-500-settings','schedule-desktop-course','schedule-phone-course','schedule-user-500-course','schedule-desktop-home','schedule-phone-home','schedule-user-500-home'];
ui.push('redesign-today-desktop','redesign-today-phone','redesign-today-small','redesign-today-dark','clock-phone','clock-user-500','clock-notice-off','clock-notice-pause','clock-notice-switch','clock-notice-clear');
for(const name of ui)await stat('.impeccable/review/'+name+'.png');
async function json(path){return readFile(path,'utf8').then(JSON.parse).catch(e=>{if(e.code==='ENOENT')return null;throw e;});}
const harmony=await json('reports/harmony-build.json');
const signed=await json('reports/harmony-signed.json');
const history=await json('reports/harmony-runtime-0.1.1.json');
const android=await json('reports/android-build.json');
const androidTransfer=await json('reports/android-harmony-download.json');
const currentAndroidTransfer=androidTransfer?.sha256===android?.sha256?androidTransfer:null;
const packageTransferred=Boolean(currentAndroidTransfer?.requests?.some(r=>r.method==='GET'&&r.start===0&&r.end===android.bytes-1));
const packageInfo=await json('package.json');
const compatibility=await json('reports/android-compatibility-test.json');
const androidDevice=compatibility?.attempts?.find(attempt=>attempt.sha256===android?.sha256)??null;
const inlineStartup=await json('reports/android-inline-startup.json');
const browserCompatibility=await json('reports/android-browser-compatibility.json');
const clockReview=await json('reports/clock-ui-review.json');
const reminderReview=await json('reports/harmony-reminder-review-latest.json');
const harmonyBridgeTests=await json('reports/harmony-bridge-tests.json');
const harmonyUIReview=await json('reports/harmony-ui-review.json');
const harmonyCaptures=await json('reports/harmony-ui-captures.json');
const timetableImportValidation=await json('reports/timetable-import-validation.json');
const wholeReview=await json('reports/whole-ui-review.json');
const priorTodayReview=await json('reports/today-design-review.json');
const copyReview=await json('reports/copy-review.json');
const navigationReview=await json('reports/navigation-review.json');
const adjustmentsReview=await json('reports/adjustments-review.json');
const refinementReview=[adjustmentsReview,copyReview,navigationReview].find(review=>review?.version===packageInfo.version);
const refinementOnly=Boolean(refinementReview),refinementPrefix=refinementReview===adjustmentsReview?'adjustments':refinementReview===copyReview?'copy':'navigation';
const courseAdjustments=refinementOnly&&refinementPrefix==='adjustments';
const refinementChecks=refinementOnly?await json(`reports/${refinementPrefix}-ui-checks.json`):null;
if(refinementOnly&&(!refinementChecks?.passed||refinementChecks.failed))throw Error('局部界面检查缺失或失败');
const todayReview=refinementOnly?refinementReview:wholeReview?.version===packageInfo.version?wholeReview:priorTodayReview?.version===packageInfo.version?priorTodayReview:null;
const wholeCapturePacket=await json('reports/whole-ui-captures.json');
const documentationReport=refinementOnly?`reports/${refinementPrefix}-documentation.md`:todayReview===wholeReview?'reports/whole-ui-documentation.md':'reports/today-design-documentation.md';
const wholeScope=await json('reports/whole-ui-update-scope.json');
const priorTodayScope=await json('reports/today-update-scope.json');
const refinementScope=refinementOnly?await json(`reports/${refinementPrefix}-update-scope.json`):null;
const todayScope=refinementOnly?refinementScope:wholeScope?.version===packageInfo.version?wholeScope:priorTodayScope?.version===packageInfo.version?priorTodayScope:null;
const extraUICaptures=await Promise.all(['reports/whole-ui-surface-captures.json','reports/whole-ui-harmony-captures.json'].map(async path=>({path,stats:(await json(path))?.stats??null})));
if(todayReview===wholeReview){for(const report of extraUICaptures){if(!report.stats?.expected||report.stats.unexpected||report.stats.flaky||report.stats.skipped)throw Error('补充界面截图检查缺失或未通过：'+report.path);}}
if(todayReview){
  if(todayReview.disposition!=='ship')throw Error('今日界面修正项尚未全部通过审阅');
  for(const source of todayReview.sourceFiles??[]){if(hash(await readFile(source.path))!==source.sha256)throw Error('今日界面审阅记录与源码不一致：'+source.path);}
  for(const capture of todayReview.captures??[]){if(hash(await readFile(capture.path))!==capture.sha256)throw Error('今日界面截图审阅后发生变化：'+capture.path);}
  await stat(documentationReport);await stat('DESIGN.md');await stat('.impeccable/design.json');
}
if(!todayReview)throw Error('当前版本缺少独立界面审阅记录，不能沿用旧版结论');
if(timetableImportValidation){
  for(const source of timetableImportValidation.sourceFiles){if(hash(await readFile(source.path))!==source.sha256)throw Error('课表识别核对记录与当前源码不一致：'+source.path);}
}
if(harmonyOnly){
  if(harmony?.build!=='success'||harmonyBridgeTests?.failed!==0||harmonyUIReview?.disposition!=='ship')throw Error('鸿蒙构建、桥接逻辑测试或共享界面审阅记录未通过');
  for(const source of harmonyBridgeTests.sourceFiles){if(hash(await readFile(source.path))!==source.sha256)throw Error('鸿蒙桥接测试记录与当前源码不一致：'+source.path);}
}
for(const record of [signed,android]){
  if(record&&hash(await readFile(record.artifact))!==record.sha256)throw Error('安装包哈希不一致：'+record.artifact);
}
if(history&&hash(await readFile(history.artifact))!==history.artifactSHA256)throw Error('历史鸿蒙启动包哈希不一致');
// A previous device success must never be attached to a newly built, uninstalled package.
const currentHarmonyLaunch=Boolean(history?.launchVerified&&signed?.sha256===history.artifactSHA256);
if(signed?.deviceInstalled&&!currentHarmonyLaunch)throw Error('新版 HAP 不能继承旧版安装结论');
if(android?.deviceInstalled&&!androidDevice?.installed)throw Error('Android 安装结论需要对应安装包的用户确认');
if(android?.lockScreenAlarmTested&&!androidDevice?.lockScreenAlarmTested)throw Error('Android 响铃结论需要对应安装包的设备验收');
if(android?.lockScreenAlarmPassed&&!androidDevice?.lockScreenAlarmPassed)throw Error('Android 响铃通过需要对应安装包的成功测试');
const uiReport=await json(courseAdjustments?'reports/adjustments-functional-results.json':'reports/ui-results.json');
function specifications(suites){return suites.flatMap(s=>[...(s.specs??[]),...specifications(s.suites??[])]);}
const specs=specifications(uiReport.suites);
const capture=specs.filter(s=>s.title.startsWith('界面证据：'));
const functional=specs.filter(s=>!s.title.startsWith('界面证据：'));
if(uiReport.stats.unexpected||uiReport.stats.flaky||uiReport.stats.skipped)throw Error('浏览器检查存在未通过项');
const bytes=await readFile('reports/core-results.log');
const coreText=bytes.toString(bytes[0]===0xff&&bytes[1]===0xfe?'utf16le':'utf8');
const corePassed=Number(coreText.match(/\bpass (\d+)/)?.[1]),coreFailed=Number(coreText.match(/\bfail (\d+)/)?.[1]);
if(!corePassed||coreFailed!==0)throw Error('规则检查记录缺失或失败');
const summary={
  date:new Date().toISOString(),version:packageInfo.version,build:'passed',
  supportedPlatforms:['android','harmony'],
  scope:courseAdjustments?'Current per-course scheduling rules, full shared-browser functional regression and responsive captures, both native compilations and JVM checks; no device certification':refinementOnly?'Current scoped UI refinement browser checks and both native compilations/JVM checks; prior full functional/core checks explicitly retained as history':harmonyOnly?'Current Harmony native compilation, actual ArkTS bridge logic with stubbed OS services and shared web browser tests; Android package and device results retained as historical evidence':'Shared interface browser checks, simulated native bridges, JVM Android startup/resource/alarm checks and native compilation; phone compatibility results recorded per APK hash',
  updateTarget:harmonyOnly?'harmony':'android-harmony',
  coreTests:{passed:corePassed,failed:coreFailed,historical:refinementOnly&&!courseAdjustments},
  harmonyBridgeTests:harmonyBridgeTests?{...harmonyBridgeTests,historical:refinementOnly}:null,
  androidJvmTests:{runThisUpdate:!harmonyOnly,passed:(android?.jvmRuleTests??0)+(android?.jvmStartupTests??0)+(android?.jvmResourceTests??0)+(android?.jvmClockTests??0),alarmTime:android?.jvmRuleTests??0,startupPage:android?.jvmStartupTests??0,resourcePolicy:android?.jvmResourceTests??0,systemClockDates:android?.jvmClockTests??0,scope:'Alarm date validation, bundled HTML startup, local resource handling and safe next-occurrence Clock handoff'},
  uiFunctionalTests:refinementOnly?{passed:refinementChecks.passed,failed:0,scope:refinementChecks.scope,cases:refinementChecks.checks,existingFunctionalTests:refinementChecks.existingFunctionalTests??null}:{passed:functional.length,failed:0,cases:functional.map(s=>s.title)},
  uiCaptureTests:refinementOnly?{passed:refinementChecks.captures.length,failed:0,unit:'viewport screenshots'}:{passed:capture.length,failed:0},screenshots:refinementOnly?refinementChecks.captures.map(c=>c.path):wholeCapturePacket?.version===packageInfo.version?wholeCapturePacket.captures.map(c=>c.path):ui.map(n=>'.impeccable/review/'+n+'.png'),
  previousUIRegression:refinementOnly?{historical:!courseAdjustments,report:courseAdjustments?'reports/adjustments-functional-results.json':'reports/ui-results.json',stats:uiReport.stats}:null,
  additionalUICaptureReports:extraUICaptures.map(r=>({...r,historical:refinementOnly})),
  designReview:todayReview??{...(harmonyOnly?harmonyUIReview:clockReview??{disposition:'pending'}),historical:true,currentUpdate:'Historical interface review; no current daily-home verdict available'},
  harmonyPreviewCaptures:harmonyCaptures?{...harmonyCaptures,historical:true}:null,
  designDocumentation:todayReview?{historical:false,scope:'Current shared interface and task-screen components; no device UI or ringing certification',files:['DESIGN.md','.impeccable/design.json'],report:documentationReport}:{incumbentVisualSystemPreserved:true,historical:true,scope:'Historical interface documentation',report:harmonyOnly?'reports/harmony-ui-documentation.md':'reports/clock-ui-documentation.md'},
  native:{
    harmony:harmony?.build==='success'?`${harmony.version??'unknown'} compiled; current build signed=${Boolean(signed?.signatureVerified&&signed?.unsignedSHA256===harmony.sha256)}; current build not installed or ringing-tested; previous signed package retained separately`:'not compiled',
    android:android?.officialSignatureVerification==='passed'?`${android.version} compiled, lint checked and debug signature/content verified; current APK installed=${Boolean(androidDevice?.installed)}, home confirmed=${Boolean(androidDevice?.homepageVerified)}, ringing tested=${Boolean(androidDevice?.lockScreenAlarmTested)}, ringing passed=${Boolean(androidDevice?.lockScreenAlarmPassed)}`:'not verified',
  },
  harmonyBuild:harmony,harmonySigned:signed,harmonyRuntimeHistory:history,androidBuild:android,
  androidCompatibility:compatibility,currentAndroidDeviceResult:androidDevice,harmonyReminderReview:reminderReview,
  androidInlineStartup:inlineStartup?.sha256===android?.sha256?inlineStartup:null,
  androidBrowserCompatibility:browserCompatibility?.sha256===android?.sha256?browserCompatibility:null,
  externalActions:{githubPublished:true,huaweiReminderCapabilityApplied:history?.reminderDiagnostics?.submitted===true,paidServicesEnabled:false,deviceCommandsRunThisUpdate:Boolean(todayScope?.deviceDiscoveryQueried)||packageTransferred||!localOnly&&Boolean(compatibility),androidPackageTransferredThisUpdate:packageTransferred,userRequestedLocalOnly:Boolean(todayScope?.userRequestedLocalOnly),installationAttemptedThisUpdate:Boolean(todayScope?.installationAttempted),harmonySignatureUpdatedThisUpdate:!localOnly&&signed?.unsignedSHA256===harmony?.sha256},
  timetableImportValidation,realUserPDFReceived:Boolean(timetableImportValidation?.realDocumentsValidated),lockScreenAlarmTestedThisUpdate:!localOnly&&Boolean(androidDevice?.lockScreenAlarmTested),lockScreenAlarmPassedThisUpdate:!localOnly&&Boolean(androidDevice?.lockScreenAlarmPassed),files
};
await writeFile('reports/validation.json',JSON.stringify(summary,null,2));
console.log(courseAdjustments?'单门调课验证已保存：规则 '+corePassed+' 项、浏览器功能 '+functional.length+' 项、'+refinementChecks.captures.length+' 张截图、Android JVM '+summary.androidJvmTests.passed+' 项；两端编译通过，未安装、未实测响铃。':refinementOnly?'界面局部验证已保存：'+refinementChecks.passed+' 项局部检查、'+refinementChecks.captures.length+' 张截图、Android JVM '+summary.androidJvmTests.passed+' 项；旧版全量规则和界面检查保留为历史。':harmonyOnly?'鸿蒙验证记录已保存：规则 '+corePassed+' 项，桥接逻辑 '+harmonyBridgeTests.passed+' 项，浏览器功能 '+functional.length+' 项与截图检查 '+capture.length+' 项；鸿蒙不签名、不安装，响铃未实测。':'验证记录已保存：规则 '+corePassed+' 项，浏览器功能 '+functional.length+' 项，截图记录 '+capture.length+' 项，Android JVM '+summary.androidJvmTests.passed+' 项；设备结论按 APK 哈希单独记录。');
