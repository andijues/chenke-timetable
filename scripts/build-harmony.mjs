import {cp, copyFile, mkdir, readdir, readFile, writeFile, access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const argv=process.argv.slice(2);
if(argv.includes('--help')){
  console.log('node scripts/build-harmony.mjs --tools "D:/command-line-tools" [--java "D:/JDK17"] [--stage "D:/ChenkeHarmonyBuild"]');
  console.log('使用官方工具编译未签名 HAP；签名文件和个人密码不会写入源码。');
  process.exit(0);
}
function argument(name){const i=argv.indexOf(name);return i<0?null:argv[i+1];}
async function exists(file){try{await access(file);return true;}catch{return false;}}
async function find(dir,filename,depth=0){
  if(depth>5||!await exists(dir))return null;
  const entries=await readdir(dir,{withFileTypes:true});
  const file=entries.find(e=>e.isFile()&&e.name.toLowerCase()===filename.toLowerCase());
  if(file)return path.join(dir,file.name);
  for(const entry of entries){
    if(!entry.isDirectory()||['node_modules','sdk','openharmony','hms','oh_modules'].includes(entry.name))continue;
    const result=await find(path.join(dir,entry.name),filename,depth+1);if(result)return result;
  }
  return null;
}
const requested=argument('--tools')??process.env.CHENKE_HARMONY_TOOLS;
const candidates=requested?[path.resolve(requested)]:[
  path.join(root,'.tools/harmony'),
  'D:/Plugin/HarmonyOS26',
  'C:/Program Files/Huawei/DevEco Studio',
];
let tools=null,hvigor=null;
for(const candidate of candidates){
  const found=await find(candidate,process.platform==='win32'?'hvigorw.bat':'hvigorw');
  if(found){tools=candidate;hvigor=found;break;}
}
if(!hvigor)throw Error('尚未找到官方 HarmonyOS 26 命令行工具。请解压工具 ZIP，再用 --tools 指定其目录。');
const executableRoot=path.dirname(path.dirname(hvigor));
let sdk=null;
for(const candidate of [path.join(executableRoot,'sdk'),path.join(tools,'sdk')]){
  if(await exists(path.join(candidate,'default','openharmony'))){sdk=candidate;break;}
}
if(!sdk)throw Error('工具包中未找到 sdk/default/openharmony；请使用完整官方工具包。');
// Windows restool resolves its transcoder dependencies beside the executable.
// CLI 26 ships those DLLs elsewhere in the same SDK. Add only absent files.
if(process.platform==='win32'){
  const dlls=['libimage_transcoder_shared.dll','libtextureSuperCompress.dll','libhilog.dll','libsec_shared.dll','liblz4_shared.dll','libastc_encoder_shared.dll','libcjson.dll','libskia_canvaskit.dll','libexpat.dll','libjsoncpp.dll','libhmicuuc.dll'];
  let added=0;
  for(const name of dlls){
    const destination=path.join(sdk,'default/openharmony/toolchains',name);
    if(await exists(destination))continue;
    for(const directory of ['default/hms/toolchains/lib','default/openharmony/previewer/common/bin']){
      const source=path.join(sdk,directory,name);
      if(await exists(source)){await copyFile(source,destination,1);added++;break;}
    }
  }
  if(added)console.log(`已用同一官方 SDK 补齐 ${added} 个资源编译依赖。`);
}
const javaRoot=argument('--java')??process.env.JAVA_HOME;
const java=javaRoot?await find(path.resolve(javaRoot),process.platform==='win32'?'java.exe':'java'):await find(tools,process.platform==='win32'?'java.exe':'java');
if(!java)throw Error('未找到 JDK。官方命令行工具可能不含 Java，请用 --java 指定免费 JDK 17 目录。');
const bundledNode=await find(tools,process.platform==='win32'?'node.exe':'node');
const env={...process.env,JAVA_HOME:path.dirname(path.dirname(java)),DEVECO_SDK_HOME:sdk};
if(bundledNode)env.DEVECO_NODE_HOME=path.dirname(bundledNode);
const pathKeys=Object.keys(env).filter(key=>key.toLowerCase()==='path');
const originalPath=env[pathKeys[0]]??'';
for(const key of pathKeys)delete env[key];
env[process.platform==='win32'?'Path':'PATH']=[path.dirname(java),bundledNode?path.dirname(bundledNode):path.dirname(process.execPath),path.dirname(hvigor),path.join(sdk,'default/openharmony/previewer/common/bin'),path.join(sdk,'default/hms/toolchains/lib'),originalPath].join(path.delimiter);
if(bundledNode)env.NODE_HOME=path.dirname(bundledNode);
const stageParent=path.resolve(argument('--stage')??path.join(os.tmpdir(),'chenke-harmony-build'));
if(process.platform==='win32'&&/[^\x00-\x7F]/.test(stageParent))throw Error('鸿蒙构建目录请使用不含中文的路径，例如 --stage D:/Plugin/HarmonyOSBuild。');
const stage=path.join(stageParent,`chenke-${Date.now()}`);
await mkdir(stage,{recursive:true});
const source=path.join(root,'native/harmony');
const skip=new Set(['.hvigor','.hvigor-cache','oh_modules','build','local.properties','node_modules']);
await cp(source,stage,{recursive:true,filter:file=>!file.split(path.sep).some(part=>skip.has(part))&&!/\.(p12|p7b|cer|jks|keystore|pem|csr)$/i.test(file)});
const profileFile=path.join(stage,'build-profile.json5');
const profile=JSON.parse(await readFile(profileFile,'utf8'));
profile.app.signingConfigs=[];
for(const product of profile.app.products)delete product.signingConfig;
await writeFile(profileFile,JSON.stringify(profile,null,2));
// Always copy the current built interface; never reuse an older packaged timetable.
if(!await exists(path.join(root,'dist/index.html')))throw Error('共享界面尚未构建，请先运行 npm.cmd run build。');
await cp(path.join(root,'dist'),path.join(stage,'entry/src/main/resources/rawfile/web'),{recursive:true});
await mkdir(path.join(root,'reports'),{recursive:true});
const logFile=path.join(root,'reports/harmony-build.log');
let log='';
async function run(command,args){
  console.log(`运行 ${path.basename(command)} ${args.join(' ')}`);
  return await new Promise((resolve,reject)=>{
    let child;
    if(process.platform==='win32'&&/\.(bat|cmd)$/i.test(command)){
      if(/["%&|<>^\r\n]/.test(command))return reject(Error('官方工具目录请避免特殊字符。'));
      const cmdLine=`"${command}" ${args.join(' ')}`;
      child=spawn(process.env.ComSpec??'cmd.exe',['/d','/s','/c',`"${cmdLine}"`],{cwd:stage,env,windowsVerbatimArguments:true,windowsHide:true});
    }else child=spawn(command,args,{cwd:stage,env,windowsHide:true});
    child.stdout.on('data',data=>{const text=data.toString();log+=text;process.stdout.write(text);});
    child.stderr.on('data',data=>{const text=data.toString();log+=text;process.stderr.write(text);});
    child.once('error',reject);child.once('close',code=>code===0?resolve():reject(Error(`鸿蒙构建工具退出码 ${code}`)));
  });
}
console.log(`官方 SDK：${sdk}\n独立构建目录：${stage}`);
try{
  const ohpm=await find(tools,process.platform==='win32'?'ohpm.bat':'ohpm');
  if(ohpm)await run(ohpm,['install','--all']);
  await run(hvigor,['--mode','module','-p','product=default','-p','module=entry@default','-p','buildMode=debug','assembleHap','--no-daemon']);
}finally{await writeFile(logFile,log);}
const output=path.join(stage,'entry/build/default/outputs/default');
const haps=(await readdir(output)).filter(name=>name.endsWith('-unsigned.hap'));
if(haps.length!==1)throw Error('没有找到唯一的未签名 HAP，请查看 reports/harmony-build.log。');
const bytes=await readFile(path.join(output,haps[0]));
const destination=path.join(root,'output/晨课-鸿蒙-未签名.hap');
await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,bytes);
const report={compiledAt:new Date().toISOString(),build:'success',sdk,stage,artifact:path.relative(root,destination).replaceAll('\\','/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),signed:false,deviceInstalled:false,lockScreenAlarmTested:false};
await writeFile(path.join(root,'reports/harmony-build.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
