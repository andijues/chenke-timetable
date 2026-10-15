import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const harmonyOnly=process.argv.includes('--harmony-only');
const localOnly=harmonyOnly||process.argv.includes('--local-only');
const essential=['dist/index.html','dist/app.js','dist/style.css','native/harmony/entry/src/main/ets/pages/Index.ets','native/harmony/entry/src/main/module.json5','native/harmony/entry/src/main/resources/rawfile/wake.wav','native/android/app/build.gradle','native/android/app/src/main/AndroidManifest.xml','native/android/app/src/main/java/com/andijues/chenke/MainActivity.java','native/android/app/src/main/java/com/andijues/chenke/BundledPage.java','native/android/app/src/main/java/com/andijues/chenke/ResourcePolicy.java','native/android/app/src/main/java/com/andijues/chenke/AlarmStore.java','native/android/app/src/main/java/com/andijues/chenke/RingService.java'];
const files=[];
essential.push('src/harmony-ui.mjs','native/harmony/entry/src/main/ets/HarmonyBridge.ets','native/harmony/entry/src/main/ets/entryability/EntryAbility.ets');
for(const path of essential){const bytes=await readFile(path);files.push({path,bytes:bytes.length,sha256:hash(bytes)});}
const ui=['schedule-desktop-settings','schedule-phone-settings','schedule-user-500-settings','schedule-desktop-course','schedule-phone-course','schedule-user-500-course','schedule-desktop-home','schedule-phone-home','schedule-user-500-home'];
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
const uiReport=await json('reports/ui-results.json');
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
  scope:harmonyOnly?'Current Harmony native compilation, actual ArkTS bridge logic with stubbed OS services and shared web browser tests; Android package and device results retained as historical evidence':'Shared interface browser checks, simulated native bridges, JVM Android startup/resource/alarm checks and native compilation; phone compatibility results recorded per APK hash',
  updateTarget:harmonyOnly?'harmony':'android-harmony',
  coreTests:{passed:corePassed,failed:coreFailed},
  harmonyBridgeTests,
  androidJvmTests:{runThisUpdate:!harmonyOnly,passed:(android?.jvmRuleTests??0)+(android?.jvmStartupTests??0)+(android?.jvmResourceTests??0)+(android?.jvmClockTests??0),alarmTime:android?.jvmRuleTests??0,startupPage:android?.jvmStartupTests??0,resourcePolicy:android?.jvmResourceTests??0,systemClockDates:android?.jvmClockTests??0,scope:'Alarm date validation, bundled HTML startup, local resource handling and safe next-occurrence Clock handoff'},
  uiFunctionalTests:{passed:functional.length,failed:0,cases:functional.map(s=>s.title)},
  uiCaptureTests:{passed:capture.length,failed:0},screenshots:ui.map(n=>'.impeccable/review/'+n+'.png'),
  designReview:{...(harmonyOnly?harmonyUIReview:clockReview??{disposition:'pending'}),historical:true,currentUpdate:'Timetable import parsing and review metadata; previous design review retained as history, not a new visual approval'},
  harmonyPreviewCaptures:harmonyCaptures,
  designDocumentation:{incumbentVisualSystemPreserved:true,historical:true,scope:'Previous interface documentation retained; current change improves import parsing and review metadata',report:harmonyOnly?'reports/harmony-ui-documentation.md':'reports/clock-ui-documentation.md'},
  native:{
    harmony:harmony?.build==='success'?`${harmony.version??'unknown'} compiled; current build signed=${Boolean(signed?.signatureVerified&&signed?.unsignedSHA256===harmony.sha256)}; current build not installed or ringing-tested; previous signed package retained separately`:'not compiled',
    android:android?.officialSignatureVerification==='passed'?`${android.version} compiled, lint checked and debug signature/content verified; current APK installed=${Boolean(androidDevice?.installed)}, home confirmed=${Boolean(androidDevice?.homepageVerified)}, ringing tested=${Boolean(androidDevice?.lockScreenAlarmTested)}, ringing passed=${Boolean(androidDevice?.lockScreenAlarmPassed)}`:'not verified',
  },
  harmonyBuild:harmony,harmonySigned:signed,harmonyRuntimeHistory:history,androidBuild:android,
  androidCompatibility:compatibility,currentAndroidDeviceResult:androidDevice,harmonyReminderReview:reminderReview,
  androidInlineStartup:inlineStartup?.sha256===android?.sha256?inlineStartup:null,
  androidBrowserCompatibility:browserCompatibility?.sha256===android?.sha256?browserCompatibility:null,
  externalActions:{githubPublished:true,huaweiReminderCapabilityApplied:history?.reminderDiagnostics?.submitted===true,paidServicesEnabled:false,deviceCommandsRunThisUpdate:packageTransferred||!localOnly&&Boolean(compatibility),androidPackageTransferredThisUpdate:packageTransferred,harmonySignatureUpdatedThisUpdate:!localOnly&&signed?.unsignedSHA256===harmony?.sha256},
  timetableImportValidation,realUserPDFReceived:Boolean(timetableImportValidation?.realDocumentsValidated),lockScreenAlarmTestedThisUpdate:!localOnly&&Boolean(androidDevice?.lockScreenAlarmTested),lockScreenAlarmPassedThisUpdate:!localOnly&&Boolean(androidDevice?.lockScreenAlarmPassed),files
};
await writeFile('reports/validation.json',JSON.stringify(summary,null,2));
console.log(harmonyOnly?'鸿蒙验证记录已保存：规则 '+corePassed+' 项，桥接逻辑 '+harmonyBridgeTests.passed+' 项，浏览器功能 '+functional.length+' 项与截图检查 '+capture.length+' 项；鸿蒙不签名、不安装，响铃未实测。':'验证记录已保存：规则 '+corePassed+' 项，浏览器功能 '+functional.length+' 项，截图记录 '+capture.length+' 项，Android JVM '+summary.androidJvmTests.passed+' 项；设备结论按 APK 哈希单独记录。');
