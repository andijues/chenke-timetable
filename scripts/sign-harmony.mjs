import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {X509Certificate,createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);function arg(n){const i=args.indexOf(n);return i<0?null:args[i+1];}
if(args.includes('--help')){console.log('node scripts/sign-harmony.mjs --java "D:/JDK17/bin/java.exe" --tools "D:/command-line-tools" --signing "D:/ChenkeHarmonySigning/chenke-..."');process.exit(0);}
const java=arg('--java'),tools=arg('--tools'),folder=arg('--signing');
if(!java||!tools||!folder)throw Error('请指定 Java、官方 SDK 工具目录及个人签名目录');
const directory=path.resolve(folder);if(directory===root||directory.startsWith(root+path.sep))throw Error('个人签名资料必须位于项目目录之外');
const secret=JSON.parse(await readFile(path.join(directory,'private-signing.json'),'utf8'));
const device=JSON.parse(await readFile(path.join(directory,'device.json'),'utf8'));
const signer=path.resolve(tools,'sdk/default/openharmony/toolchains/lib/hap-sign-tool.jar');await access(signer);
const certFile=path.join(directory,'app-debug.cer'),profileFile=path.join(directory,'debug-profile.p7b');
const certificates=(await readFile(certFile,'utf8')).match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g)?.map(p=>new X509Certificate(p))??[];
const localKey=new X509Certificate(await readFile(path.join(directory,'public-key.cer'))).publicKey.export({type:'spki',format:'der'});
if(!certificates.some(c=>c.publicKey.export({type:'spki',format:'der'}).equals(localKey)&&Date.parse(c.validTo)>Date.now()))throw Error('证书不匹配本机私钥，或证书已失效');
function run(values){
  try{return execFileSync(java,['-Dfile.encoding=UTF-8','-jar',signer,...values],{cwd:directory,windowsHide:true,encoding:'utf8',stdio:'pipe'});}
  catch(error){const message=String(error.stdout??'')+'\n'+String(error.stderr??'');throw Error('华为签名工具未完成：'+message.replaceAll(secret.password,'[密码已隐藏]').slice(-4000));}
}
const decoded=path.join(directory,'verified-profile.json');run(['verify-profile','-inFile',profileFile,'-outFile',decoded]);
const profile=JSON.parse(await readFile(decoded,'utf8'));
const ids=profile['debug-info']?.['device-ids'];
if(profile.type!=='debug'||profile['bundle-info']?.['bundle-name']!=='com.andijues.chenke'||!Array.isArray(ids)||ids.length!==1||ids[0]!==device.udid)throw Error('Profile 必须是晨课专用、仅绑定当前手机的调试文件');
const input=path.join(root,'output/晨课-鸿蒙-未签名.hap'),output=path.join(root,'output/晨课-鸿蒙-已签名.hap');
console.log('已核对证书与单设备 Profile，开始签名。');
run(['sign-app','-mode','localSign','-keyAlias',secret.alias,'-keyPwd',secret.password,'-appCertFile',certFile,'-profileFile',profileFile,'-inFile',input,'-signAlg','SHA256withECDSA','-keystoreFile',secret.keystore,'-keystorePwd',secret.password,'-outFile',output,'-compatibleVersion','20']);
run(['verify-app','-inFile',output,'-outCertChain',path.join(directory,'verified-app-chain.cer'),'-outProfile',path.join(directory,'verified-app-profile.p7b')]);
const bytes=await readFile(output);const record={signedAt:new Date().toISOString(),artifact:'output/晨课-鸿蒙-已签名.hap',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),signatureVerified:true,bundleName:'com.andijues.chenke',singleDeviceProfile:true,deviceInstalled:false,lockScreenAlarmTested:false};
await mkdir(path.join(root,'reports'),{recursive:true});await writeFile(path.join(root,'reports/harmony-signed.json'),JSON.stringify(record,null,2));console.log(JSON.stringify(record,null,2));
