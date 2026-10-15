import {cp,mkdir,readdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
const names=[];
async function scan(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await scan(p);else names.push(p.replaceAll('\\','/').replace(/^dist\//,''));}}
await scan('dist');
await writeFile('dist/offline-resources.json',JSON.stringify(names,null,2));
for(const dest of ['native/harmony/entry/src/main/resources/rawfile/web','native/android/app/src/main/assets/web']){
  const target=path.resolve(dest);
  if(!target.startsWith(path.resolve('native')+path.sep))throw Error('原生资源目录超出工程范围');
  await rm(target,{recursive:true,force:true});
  await mkdir(target,{recursive:true});await cp('dist',target,{recursive:true});
}
console.log('已为鸿蒙与 Android 打包共享界面和全部离线资源。');
