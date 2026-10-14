import {cp,mkdir,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
for(const dest of ['native/ios/Chenke/Web','native/harmony/entry/src/main/resources/rawfile/web']){
  await mkdir(dest,{recursive:true});await cp('dist',dest,{recursive:true});
}
const names=[];
async function scan(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await scan(p);else names.push(p.replaceAll('\\','/').replace(/^dist\//,''));}}
await scan('dist');
await writeFile('dist/offline-resources.json',JSON.stringify(names,null,2));
console.log('已为 iOS 与鸿蒙打包共享界面和全部离线资源。');
