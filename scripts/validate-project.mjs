import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const essential=['dist/index.html','dist/app.js','dist/style.css','native/ios/Chenke/ChenkeApp.swift','native/ios/Chenke/Info.plist','native/ios/Chenke.xcodeproj/project.pbxproj','native/harmony/entry/src/main/ets/pages/Index.ets','native/harmony/entry/src/main/module.json5','native/harmony/entry/src/main/resources/rawfile/wake.wav','.github/workflows/ios-build.yml'];
const files=[];
for(const path of essential){const bytes=await readFile(path);files.push({path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
const ui=['desktop','mobile','mobile-dark','alarms-mobile','import-mobile','early-course-desktop'];
for(const name of ui)await stat(`.impeccable/review/${name}.png`);
const cloud=await readFile('reports/ios-cloud-build.json','utf8').then(JSON.parse).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
const harmony=await readFile('reports/harmony-build.json','utf8').then(JSON.parse).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
const runtime=await readFile('reports/harmony-runtime.json','utf8').then(JSON.parse).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
const signed=await readFile('reports/harmony-signed.json','utf8').then(JSON.parse).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
if(signed&&runtime){const bytes=await readFile(signed.artifact);if(createHash('sha256').update(bytes).digest('hex')!==signed.sha256||signed.sha256!==runtime.artifactSHA256)throw Error('鸿蒙运行记录和当前安装包不一致');}
const uiReport=JSON.parse(await readFile('reports/ui-results.json','utf8'));
function specifications(suites){return suites.flatMap(s=>[...(s.specs??[]),...specifications(s.suites??[])]);}
const specs=specifications(uiReport.suites);
const capture=specs.filter(s=>s.title.startsWith('界面证据：'));
const functional=specs.filter(s=>!s.title.startsWith('界面证据：'));
if(uiReport.stats.unexpected||uiReport.stats.flaky||uiReport.stats.skipped)throw Error('浏览器测试存在未通过项');
const coreBytes=await readFile('reports/core-results.log');
const coreText=coreBytes.toString(coreBytes[0]===0xff&&coreBytes[1]===0xfe?'utf16le':'utf8');
const corePassed=Number(coreText.match(/\bpass (\d+)/)?.[1]);
const coreFailed=Number(coreText.match(/\bfail (\d+)/)?.[1]);
if(!corePassed||coreFailed!==0)throw Error('规则测试记录缺失或失败');
const summary={date:new Date().toISOString(),scope:'Windows Edge shared interface, simulated native bridges, JavaScript rule engine, official native compilation and Harmony device startup',build:'passed',coreTests:{passed:corePassed,failed:coreFailed},uiFunctionalTests:{passed:functional.length,failed:0,cases:functional.map(s=>s.title)},uiCaptureTests:{passed:capture.length,failed:0},screenshots:ui.map(n=>`.impeccable/review/${n}.png`),designReview:{disposition:'ship',scope:'移动竖屏、横屏、触控、输入与短视口功能检查；不代表手机响铃'},native:{harmony:runtime?.launchVerified?'official SDK compilation, verified debug signing, replacement installation and home launch passed; agent-powered reminder capability under review; real ringing not accepted':harmony?.zipIntegrity==='passed'?'SDK compilation and unsigned HAP integrity passed; device startup not verified':'not compiled/device-tested',ios:cloud?.build==='success'?'cloud compilation and unsigned IPA integrity passed; not Apple-account-signed/device-tested':'source and public GitHub build workflow ready; no IPA compilation recorded'},iosCloudBuild:cloud,harmonyBuild:harmony,harmonySigned:signed,harmonyRuntime:runtime,externalActions:{githubPublished:cloud?.build==='success',cloudBuildTriggered:cloud?.build==='success',huaweiReminderCapabilityApplied:runtime?.reminderDiagnostics?.submitted===true,paidServicesEnabled:false},realUserPDFReceived:false,files};
await writeFile('reports/validation.json',JSON.stringify(summary,null,2));
console.log(`交付记录已保存：规则${corePassed}项、功能UI${functional.length}项和截图${capture.length}项通过；鸿蒙${runtime?.launchVerified?'编译、签名、安装与主页启动通过':'尚未验证启动'}；代理提醒能力${runtime?.reminderDiagnostics?.capabilityRequestStatus??'尚未记录'}，手机响铃未验收。`);
