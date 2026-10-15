import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const essential=['dist/index.html','dist/app.js','dist/style.css','native/ios/Chenke/ChenkeApp.swift','native/ios/Chenke/Info.plist','native/ios/Chenke.xcodeproj/project.pbxproj','native/harmony/entry/src/main/ets/pages/Index.ets','native/harmony/entry/src/main/module.json5','native/harmony/entry/src/main/resources/rawfile/wake.wav','native/android/app/build.gradle','native/android/app/src/main/AndroidManifest.xml','native/android/app/src/main/java/com/andijues/chenke/MainActivity.java','native/android/app/src/main/java/com/andijues/chenke/BundledPage.java','native/android/app/src/main/java/com/andijues/chenke/ResourcePolicy.java','native/android/app/src/main/java/com/andijues/chenke/AlarmStore.java','native/android/app/src/main/java/com/andijues/chenke/RingService.java','.github/workflows/ios-build.yml'];
const files=[];
for(const path of essential){const bytes=await readFile(path);files.push({path,bytes:bytes.length,sha256:hash(bytes)});}
const ui=['schedule-desktop-settings','schedule-phone-settings','schedule-user-500-settings','schedule-desktop-course','schedule-phone-course','schedule-user-500-course','schedule-desktop-home','schedule-phone-home','schedule-user-500-home'];
for(const name of ui)await stat('.impeccable/review/'+name+'.png');
async function json(path){return readFile(path,'utf8').then(JSON.parse).catch(e=>{if(e.code==='ENOENT')return null;throw e;});}
const cloud=await json('reports/ios-cloud-build.json');
const harmony=await json('reports/harmony-build.json');
const signed=await json('reports/harmony-signed.json');
const history=await json('reports/harmony-runtime-0.1.1.json');
const android=await json('reports/android-build.json');
const packageInfo=await json('package.json');
const compatibility=await json('reports/android-compatibility-test.json');
const androidDevice=compatibility?.attempts?.find(attempt=>attempt.sha256===android?.sha256)??null;
const inlineStartup=await json('reports/android-inline-startup.json');
const browserCompatibility=await json('reports/android-browser-compatibility.json');
for(const record of [signed,android]){
  if(record&&hash(await readFile(record.artifact))!==record.sha256)throw Error('安装包哈希不一致：'+record.artifact);
}
if(history&&hash(await readFile(history.artifact))!==history.artifactSHA256)throw Error('历史鸿蒙启动包哈希不一致');
// A previous device success must never be attached to a newly built, uninstalled package.
const currentHarmonyLaunch=Boolean(history?.launchVerified&&signed?.sha256===history.artifactSHA256);
if(signed?.deviceInstalled&&!currentHarmonyLaunch)throw Error('新版 HAP 不能继承旧版安装结论');
if(android?.deviceInstalled&&!androidDevice?.installed)throw Error('Android 安装结论需要对应安装包的用户确认');
if(android?.lockScreenAlarmTested&&!androidDevice?.lockScreenAlarmTested)throw Error('Android 响铃结论需要对应安装包的设备验收');
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
  scope:'Shared interface browser checks, simulated native bridges, JVM Android startup/resource/alarm checks and native compilation; phone compatibility results recorded per APK hash',
  coreTests:{passed:corePassed,failed:coreFailed},
  androidJvmTests:{passed:(android?.jvmRuleTests??0)+(android?.jvmStartupTests??0)+(android?.jvmResourceTests??0),alarmTime:android?.jvmRuleTests??0,startupPage:android?.jvmStartupTests??0,resourcePolicy:android?.jvmResourceTests??0,scope:'Alarm date validation, bundled HTML startup and local resource origin/path handling'},
  uiFunctionalTests:{passed:functional.length,failed:0,cases:functional.map(s=>s.title)},
  uiCaptureTests:{passed:capture.length,failed:0},screenshots:ui.map(n=>'.impeccable/review/'+n+'.png'),
  designReview:{disposition:'ship',scope:'Shared web timetable editing at desktop, 390px and 500px; no native ringing screen capture'},
  designDocumentation:{incumbentSystemPreserved:true,scope:'Shared web extension; existing unrelated context drift reported without repair'},
  native:{
    harmony:signed?.signatureVerified?'0.2.0 compiled and debug-signed; not installed or device-tested; old 0.1.1 startup evidence kept separately':'not signed',
    android:android?.officialSignatureVerification==='passed'?`${android.version} compiled, lint checked and debug signature/content verified; current APK installed=${Boolean(androidDevice?.installed)}, home confirmed=${Boolean(androidDevice?.homepageVerified)}, ringing confirmed=${Boolean(androidDevice?.lockScreenAlarmTested)}`:'not verified',
    ios:cloud?.build==='success'?'Cloud compilation and unsigned IPA checked; not Apple-account-signed or device-tested':'no current IPA recorded'
  },
  iosCloudBuild:cloud,harmonyBuild:harmony,harmonySigned:signed,harmonyRuntimeHistory:history,androidBuild:android,
  androidCompatibility:compatibility,currentAndroidDeviceResult:androidDevice,
  androidInlineStartup:inlineStartup?.sha256===android?.sha256?inlineStartup:null,
  androidBrowserCompatibility:browserCompatibility?.sha256===android?.sha256?browserCompatibility:null,
  externalActions:{githubPublished:true,cloudBuildTriggered:true,huaweiReminderCapabilityApplied:history?.reminderDiagnostics?.submitted===true,paidServicesEnabled:false,deviceCommandsRunThisUpdate:Boolean(compatibility)},
  realUserPDFReceived:false,lockScreenAlarmTestedThisUpdate:Boolean(androidDevice?.lockScreenAlarmTested),files
};
await writeFile('reports/validation.json',JSON.stringify(summary,null,2));
console.log('验证记录已保存：规则 '+corePassed+' 项，浏览器功能 '+functional.length+' 项，截图记录 '+capture.length+' 项，Android JVM '+summary.androidJvmTests.passed+' 项；设备结论按 APK 哈希单独记录。');
