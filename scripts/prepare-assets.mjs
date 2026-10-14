import {mkdir, cp, copyFile, readdir, writeFile, access} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import path from 'node:path';
const root = process.cwd();
const out = path.join(root, 'public/vendor');
await mkdir(out, {recursive:true});
for (const name of ['cmaps','standard_fonts','wasm']) await cp(`node_modules/pdfjs-dist/${name}`, `${out}/pdf/${name}`, {recursive:true});
await mkdir(`${out}/ocr/core`, {recursive:true});
await copyFile('node_modules/tesseract.js/dist/worker.min.js', `${out}/ocr/worker.min.js`);
for (const f of await readdir('node_modules/tesseract.js-core')) if (f.endsWith('.wasm.js') || f.endsWith('.wasm')) await copyFile(`node_modules/tesseract.js-core/${f}`, `${out}/ocr/core/${f}`);
await mkdir(`${out}/ocr/lang`, {recursive:true});
for (const lang of ['chi_sim','eng']) {
  const dest = `${out}/ocr/lang/${lang}.traineddata.gz`;
  try {await access(dest); console.log(`${lang}: 已存在`);} catch {
    const url = `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/${lang}.traineddata`;
    const r = await fetch(url); if (!r.ok) throw Error(`${url}: ${r.status}`);
    const data = new Uint8Array(await r.arrayBuffer()); if (data.length < 100000) throw Error('语言文件下载不完整');
    await writeFile(dest, gzipSync(data)); console.log(`${lang}: ${data.length} 字节，已压缩并打包`);
  }
}
await cp('node_modules/pdfjs-dist/LICENSE', `${out}/pdf/LICENSE`);
await cp('node_modules/tesseract.js/LICENSE.md', `${out}/ocr/LICENSE`);
await cp('node_modules/tesseract.js-core/LICENSE', `${out}/ocr/core/LICENSE`);
await writeFile(`${out}/ocr/lang/LICENSE.txt`, 'tessdata_fast language models: Apache-2.0. Source: https://github.com/tesseract-ocr/tessdata_fast\n');
console.log('离线识别资源已就绪。手机运行不请求 CDN。');
