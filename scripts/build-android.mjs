import {cp,mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
function arg(name){const i=args.indexOf(name);return i<0?null:args[i+1];}
if(args.includes('--help')){
  console.log('node scripts/build-android.mjs --sdk D:/Android/Sdk --gradle D:/gradle-8.13/bin/gradle.bat --java D:/jdk17 [--stage D:/ChenkeAndroidBuild] [--keystore D:/ChenkeAndroidSigning/chenke-debug.keystore]');
  console.log('仅编译和验证 APK，不启动或安装到设备。使用免费的 Android SDK 36 / Build Tools 35、Gradle 8.13 和 JDK 17。');
  process.exit(0);
}
async function exists(p){try{await access(p);return true;}catch{return false;}}
const sdk=path.resolve(arg('--sdk')??process.env.ANDROID_HOME??'D:/ChenkeAndroidBuild/sdk');
const java=path.resolve(arg('--java')??process.env.JAVA_HOME??'D:/ChenkeHarmonyBuild/tools/jdk17/jdk-17.0.20.1+1');
const gradle=path.resolve(arg('--gradle')??'D:/ChenkeAndroidBuild/tools/gradle-8.13/bin/gradle.bat');
const parent=path.resolve(arg('--stage')??path.join(os.tmpdir(),'chenke-android-build'));
const keystore=path.resolve(arg('--keystore')??path.join(parent,'private','chenke-debug.keystore'));
if(process.platform==='win32'&&/[^\x00-\x7f]/.test(parent))throw Error('安卓构建目录请使用英文路径');
for(const p of [path.join(sdk,'platforms/android-36/android.jar'),path.join(sdk,'build-tools/35.0.0'),gradle,path.join(java,'bin',process.platform==='win32'?'java.exe':'java')])
  if(!await exists(p))throw Error('缺少构建工具：'+p);
if(!await exists(path.join(root,'dist/app.js')))throw Error('请先执行 npm.cmd run build');
if(keystore.startsWith(root+path.sep))throw Error('调试密钥请放在工程之外，避免随源码发布');
const stage=path.join(parent,'chenke-'+Date.now());await mkdir(stage,{recursive:true});await mkdir(path.dirname(keystore),{recursive:true});
const env={...process.env,JAVA_HOME:java,ANDROID_HOME:sdk,ANDROID_SDK_ROOT:sdk,GRADLE_USER_HOME:path.join(parent,'gradle-cache'),CHENKE_ANDROID_DEBUG_KEYSTORE:keystore};
const keys=Object.keys(env).filter(k=>k.toLowerCase()==='path');const old=env[keys[0]]??'';for(const k of keys)delete env[k];
env[process.platform==='win32'?'Path':'PATH']=path.join(java,'bin')+path.delimiter+old;
let log='';
async function run(command,parameters,cwd=stage){
 return new Promise((resolve,reject)=>{
  let child;
  if(process.platform==='win32'&&/\.(bat|cmd)$/.test(command)){
   const quote=value=>{if(/["%&|<>^\r\n]/.test(value))throw Error('构建参数包含特殊字符');return '"'+value+'"';};
   const line=[command,...parameters].map(quote).join(' ');
   child=spawn(process.env.ComSpec??'cmd.exe',['/d','/s','/c','"'+line+'"'],{cwd,env,windowsVerbatimArguments:true,windowsHide:true});
  }else child=spawn(command,parameters,{cwd,env,windowsHide:true});
  for(const output of [child.stdout,child.stderr])output.on('data',b=>{const t=b.toString();log+=t;process.stdout.write(t);});
  child.once('error',reject);child.once('close',c=>c===0?resolve():reject(Error('Android 工具退出码 '+c)));
 });
}
const skip=new Set(['.gradle','build','local.properties','node_modules']);
const appGradle=await readFile(path.join(root,'native/android/app/build.gradle'),'utf8');
const version=appGradle.match(/versionName\s+'([^']+)'/)?.[1],versionCode=Number(appGradle.match(/versionCode\s+(\d+)/)?.[1]);
if(!version||!versionCode)throw Error('Android 版本信息缺失');
await cp(path.join(root,'native/android'),stage,{recursive:true,filter:p=>!p.split(path.sep).some(s=>skip.has(s))&&!/\.(jks|keystore|p12|pem)$/i.test(p)});
await cp(path.join(root,'dist'),path.join(stage,'app/src/main/assets/web'),{recursive:true});
await writeFile(path.join(stage,'local.properties'),'sdk.dir='+sdk.replaceAll('\\','/').replaceAll(':','\\:')+'\n');
await mkdir(path.join(root,'reports'),{recursive:true});
try {
 if(!await exists(keystore))await run(path.join(java,'bin',process.platform==='win32'?'keytool.exe':'keytool'),
  ['-genkeypair','-keystore',keystore,'-storepass','android','-keypass','android','-alias','androiddebugkey','-keyalg','RSA','-keysize','2048','-validity','3650','-dname','CN=Chenke Personal Debug,O=Personal,C=CN']);
 await run(path.join(java,'bin',process.platform==='win32'?'javac.exe':'javac'),['-encoding','UTF-8','-d',path.join(stage,'jvm-tests'),path.join(root,'native/android/app/src/main/java/com/andijues/chenke/AlarmTime.java'),path.join(root,'tests/android/AlarmTimeTest.java'),path.join(root,'native/android/app/src/main/java/com/andijues/chenke/BundledPage.java'),path.join(root,'tests/android/BundledPageTest.java'),path.join(root,'native/android/app/src/main/java/com/andijues/chenke/ResourcePolicy.java'),path.join(root,'tests/android/ResourcePolicyTest.java')]);
 await run(path.join(java,'bin',process.platform==='win32'?'java.exe':'java'),['-cp',path.join(stage,'jvm-tests'),'com.andijues.chenke.AlarmTimeTest']);
 await run(path.join(java,'bin',process.platform==='win32'?'java.exe':'java'),['-cp',path.join(stage,'jvm-tests'),'com.andijues.chenke.BundledPageTest']);
 await run(path.join(java,'bin',process.platform==='win32'?'java.exe':'java'),['-cp',path.join(stage,'jvm-tests'),'com.andijues.chenke.ResourcePolicyTest']);
 await run(path.join(java,'bin',process.platform==='win32'?'javac.exe':'javac'),['-encoding','UTF-8','-d',path.join(stage,'jvm-tests'),path.join(root,'native/android/app/src/main/java/com/andijues/chenke/ClockTime.java'),path.join(root,'tests/android/ClockTimeTest.java')]);
 await run(path.join(java,'bin',process.platform==='win32'?'java.exe':'java'),['-cp',path.join(stage,'jvm-tests'),'com.andijues.chenke.ClockTimeTest']);
 await run(gradle,['--no-daemon','--console=plain',':app:assembleDebug',':app:lintDebug']);
 const apk=await readFile(path.join(stage,'app/build/outputs/apk/debug/app-debug.apk'));
 const dest=path.join(root,'output/晨课-Android-调试.apk');await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,apk);
 const report={build:'success',compiledAt:new Date().toISOString(),version,versionCode,minSdk:26,targetSdk:36,compileSdk:36,gradle:'8.13',agp:'8.13.2',java:'17',javaHome:java,artifact:path.relative(root,dest).replaceAll('\\','/'),bytes:apk.length,sha256:createHash('sha256').update(apk).digest('hex'),stage,sdk,debugSigned:true,lint:'passed',jvmRuleTests:7,jvmStartupTests:6,jvmResourceTests:13,jvmClockTests:11,deviceInstalled:false,lockScreenAlarmTested:false,lockScreenAlarmPassed:false};
 await writeFile(path.join(root,'reports/android-build.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await writeFile(path.join(root,'reports/android-build.log'),log);}
