import './browser-compat.mjs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import {createWorker} from 'tesseract.js';
import {groupRows} from './parser.mjs';
globalThis.pdfjsWorker=pdfWorker;
const asset = value => new URL(`./vendor/${value}`, document.baseURI).href;
let worker = null;
export async function recognizeImage(input, onProgress=()=>{}) {
  try {
    if (!worker) worker=await createWorker('chi_sim+eng',1,{workerPath:asset('ocr/worker.min.js'),corePath:asset('ocr/core'),langPath:asset('ocr/lang'),workerBlobURL:true,gzip:true,logger:m=>onProgress(m.status==='recognizing text'?`识别中 ${Math.round((m.progress??0)*100)}%`:'正在加载本机 OCR 资源…')});
    await worker.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1'});
    // Keep source files untouched. A high-contrast working canvas suppresses pale grid lines.
    const canvas=document.createElement('canvas');canvas.width=input.width;canvas.height=input.height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(input,0,0);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
    let mean=0,count=0;for(let i=0;i<pixels.data.length;i+=160){mean+=(pixels.data[i]+pixels.data[i+1]+pixels.data[i+2])/3;count++;}
    const invert=mean/count<115;
    for(let i=0;i<pixels.data.length;i+=4){let y=.299*pixels.data[i]+.587*pixels.data[i+1]+.114*pixels.data[i+2];if(invert)y=255-y;const value=y<170?0:255;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;}
    ctx.putImageData(pixels,0,0);
    const result=await worker.recognize(canvas,{}, {text:true,blocks:true});
    const data=result.data; const items=[];
    for (const block of data.blocks??[]) for (const paragraph of block.paragraphs??[]) for (const line of paragraph.lines??[]) for (const word of line.words??[]) items.push({text:word.text,x:word.bbox.x0,y:word.bbox.y0,width:word.bbox.x1-word.bbox.x0,height:word.bbox.y1-word.bbox.y0});
    return {text:data.text,items};
  } catch(e) { if(worker){await worker.terminate().catch(()=>{});worker=null;} throw Error(`本机 OCR 未完成：${e.message}。可以换清晰图片，或粘贴课表文字后手动校正。`); }
}
export async function importDocument(file,onProgress=()=>{}) {
  if (file.size>30*1024*1024) throw Error('文件超过 30 MB，请拆分或压缩后导入');
  const isPdf=file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf&&!/^image\//.test(file.type)) throw Error('请选择 PDF、PNG 或 JPG 图片');
  if (!isPdf) {
    const url=URL.createObjectURL(file);
    try {const image=new Image();image.src=url;await image.decode(); const factor=Math.min(1,2600/Math.max(image.width,image.height)); const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*factor);canvas.height=Math.round(image.height*factor);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const result=await recognizeImage(canvas,onProgress);return {text:result.text,pages:[{...result,width:canvas.width,height:canvas.height}],name:file.name,kind:'ocr'};} finally {URL.revokeObjectURL(url);}
  }
  onProgress('正在读取 PDF 文字…');
  const loading=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),cMapUrl:asset('pdf/cmaps/'),cMapPacked:true,standardFontDataUrl:asset('pdf/standard_fonts/'),wasmUrl:asset('pdf/wasm/'),useSystemFonts:true});
  const doc=await loading.promise;
  try {
    if(doc.numPages>25) throw Error('PDF 超过 25 页，请只保留课表页面后导入');
    const pages=[];let kind='text';
    for(let n=1;n<=doc.numPages;n++) {
      onProgress(`读取第 ${n}/${doc.numPages} 页…`);const page=await doc.getPage(n);const viewport=page.getViewport({scale:1});const content=await page.getTextContent();
      let items=content.items.filter(i=>'str'in i && i.str.trim()).map(i=>{const [x,y]=viewport.convertToViewportPoint(i.transform[4],i.transform[5]);return {text:i.str,x,y:y-i.height,width:i.width,height:i.height||12};});
      let text=groupRows(items).map(r=>r.text).join('\n');let width=viewport.width;let height=viewport.height;
      if(text.replace(/\s/g,'').length<15) {
        kind='ocr';onProgress(`第 ${n} 页是图片，正在本机识别…`);const scale=Math.min(2.2,2600/Math.max(viewport.width,viewport.height));const view=page.getViewport({scale});const canvas=document.createElement('canvas');canvas.width=Math.round(view.width);canvas.height=Math.round(view.height);await page.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;
        const result=await recognizeImage(canvas,m=>onProgress(`第 ${n} 页 · ${m}`));text=result.text;items=result.items;width=canvas.width;height=canvas.height;
      }
      pages.push({items,text,width,height});page.cleanup();
    }
    return {pages,text:pages.map(p=>p.text).join('\n\n'),name:file.name,kind};
  } finally {await loading.destroy();}
}
