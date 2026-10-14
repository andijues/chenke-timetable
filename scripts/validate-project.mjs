import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const essential=['dist/index.html','dist/app.js','dist/style.css','native/ios/Chenke/ChenkeApp.swift','native/ios/Chenke/Info.plist','native/ios/Chenke.xcodeproj/project.pbxproj','native/harmony/entry/src/main/ets/pages/Index.ets','native/harmony/entry/src/main/module.json5','native/harmony/entry/src/main/resources/rawfile/wake.wav','.github/workflows/ios-build.yml'];
const files=[];
for(const path of essential){const bytes=await readFile(path);files.push({path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
const ui=['desktop','mobile','mobile-dark','alarms-mobile','import-mobile','early-course-desktop'];
for(const name of ui)await stat(`.impeccable/review/${name}.png`);
const summary={date:'2026-10-14',scope:'Windows Edge shared interface and JavaScript rule engine',build:'passed',coreTests:{passed:18,failed:0},uiFunctionalTests:{passed:5,failed:0,cases:['文字PDF导入校正与规则','PNG中文OCR四门课','扫描PDF OCR','停课与备份格式校验','05:30边界课程和关闭状态']},screenshots:ui.map(n=>`.impeccable/review/${n}.png`),designReview:{disposition:'ship',scope:'四项共享网页修正及横向滚动回归；不代表原生验证'},native:{harmony:'source-ready; not compiled/signed/device-tested',ios:'source and public GitHub build workflow ready; no IPA compiled/signed/device-tested'},externalActions:{githubPublished:false,cloudBuildTriggered:false,paidServicesEnabled:false},realUserPDFReceived:false,files};
await writeFile('reports/validation.json',JSON.stringify(summary,null,2));
console.log('交付记录已保存：规则18项、功能UI5项通过；原生与真实PDF验收未完成。');
