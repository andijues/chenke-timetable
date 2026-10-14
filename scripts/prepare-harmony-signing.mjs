import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {randomBytes,createHash,X509Certificate} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
function arg(name){const i=args.indexOf(name);return i<0?null:args[i+1];}
if(args.includes('--help')){
  console.log('node scripts/prepare-harmony-signing.mjs --java "D:/JDK17/bin/java.exe" [--directory "D:/ChenkeHarmonySigning"]');
  console.log('仅在本机生成专用 P12 和公开 CSR，不申请或上传证书。');process.exit(0);
}
const java=arg('--java');if(!java)throw Error('请指定 JDK java.exe 的完整路径');
const keytool=path.join(path.dirname(path.resolve(java)),process.platform==='win32'?'keytool.exe':'keytool');await access(keytool);
const parent=path.resolve(arg('--directory')??'D:/ChenkeHarmonySigning');
if(parent.startsWith(root+path.sep)||parent===root)throw Error('个人签名资料请保存在课表项目目录之外');
const directory=path.join(parent,`chenke-${Date.now()}`);await mkdir(directory,{recursive:true});
if(process.platform==='win32'){
  const account=`${process.env.USERDOMAIN}\\${process.env.USERNAME}`;
  execFileSync('icacls.exe',[directory,'/inheritance:r','/grant:r',`${account}:(OI)(CI)F`,'*S-1-5-18:(OI)(CI)F'],{windowsHide:true,stdio:'pipe'});
}
const password=randomBytes(24).toString('base64url');const alias='chenke-personal';
const env={...process.env,CHENKE_SIGN_PASSWORD:password};
const keystore=path.join(directory,'chenke.p12');const csr=path.join(directory,'chenke.csr');const publicCertificate=path.join(directory,'public-key.cer');
function run(values){execFileSync(keytool,values,{cwd:directory,env,windowsHide:true,stdio:'pipe'});}
const credentials=['-keystore',keystore,'-storetype','PKCS12','-storepass:env','CHENKE_SIGN_PASSWORD'];
run(['-genkeypair','-alias',alias,'-keyalg','EC','-groupname','secp256r1','-sigalg','SHA256withECDSA','-dname','CN=Chenke Personal Debug','-validity','365','-keypass:env','CHENKE_SIGN_PASSWORD',...credentials]);
run(['-certreq','-alias',alias,'-sigalg','SHA256withECDSA','-file',csr,...credentials]);
run(['-exportcert','-alias',alias,'-file',publicCertificate,...credentials]);
await writeFile(path.join(directory,'private-signing.json'),JSON.stringify({alias,keystore,password},null,2),{mode:0o600});
const cert=new X509Certificate(await readFile(publicCertificate));
const receipt={preparedAt:new Date().toISOString(),directory,keystore,csr,alias,publicKeySHA256:createHash('sha256').update(cert.publicKey.export({type:'spki',format:'der'})).digest('hex'),csrSHA256:createHash('sha256').update(await readFile(csr)).digest('hex'),privateFilesUploaded:false};
await mkdir(path.join(root,'reports'),{recursive:true});await writeFile(path.join(root,'reports/harmony-signing-prepared.json'),JSON.stringify(receipt,null,2));
console.log(JSON.stringify(receipt,null,2));
