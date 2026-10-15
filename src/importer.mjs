import './browser-compat.mjs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import {createWorker} from 'tesseract.js';
import {groupRows,weekdayColumns,tableCells} from './parser.mjs';
import {extractRulings,rotateRulings} from './pdf-layout.mjs';
globalThis.pdfjsWorker=pdfWorker;
const asset = value => new URL(`./vendor/${value}`, document.baseURI).href;
let worker = null;
let ocrProgress=()=>{};
function rotatedCanvas(input,degrees){const swap=degrees===90||degrees===270,canvas=document.createElement('canvas');canvas.width=swap?input.height:input.width;canvas.height=swap?input.width:input.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.translate(degrees===90||degrees===180?canvas.width:0,degrees===180||degrees===270?canvas.height:0);ctx.rotate(degrees*Math.PI/180);ctx.drawImage(input,0,0);return canvas;}
function orientationScore(text){const days=(text.match(/(?:星期|周|礼拜)[一二三四五六日天]/g)??[]).length,times=(text.match(/\d{1,2}[:：]\d{2}\s*[~～至\-–—]\s*\d{1,2}[:：]\d{2}/g)??[]).length,weeks=(text.match(/\d+[\d,，、\-]*周/g)??[]).length;return days*15+times*6+Math.min(weeks,12)*2;}
function imageRulings(canvas){
  const {width,height}=canvas,pixels=canvas.getContext('2d').getImageData(0,0,width,height).data,horizontal=[],vertical=[];
  const ink=(x,y)=>{const i=(y*width+x)*4;return pixels[i+3]>100&&(pixels[i]+pixels[i+1]+pixels[i+2])/3<245;};
  for(let y=0;y<height;y++){let count=0,first=width,last=0;for(let x=0;x<width;x+=3)if(ink(x,y)){count++;first=Math.min(first,x);last=x;}if(count>width/3*.55){const previous=horizontal.at(-1);if(previous&&y-previous.y<=2)previous.y=y;else horizontal.push({x1:first,x2:last,y});}}
  for(let x=0;x<width;x++){let count=0,first=height,last=0;for(let y=0;y<height;y+=3)if(ink(x,y)){count++;first=Math.min(first,y);last=y;}if(count>height/3*.4){const previous=vertical.at(-1);if(previous&&x-previous.x<=2)previous.x=x;else vertical.push({y1:first,y2:last,x});}}
  return {horizontal,vertical};
}
export async function recognizeImage(input, onProgress=()=>{}, preferredRotation=0, options={}) {
  try {
    ocrProgress=onProgress;
    if (!worker) worker=await createWorker('chi_sim+eng',1,{workerPath:asset('ocr/worker.min.js'),corePath:asset('ocr/core'),langPath:asset('ocr/lang'),workerBlobURL:true,gzip:true,logger:m=>ocrProgress(m.status==='recognizing text'?`识别中 ${Math.round((m.progress??0)*100)}%`:'正在加载本机 OCR 资源…')});
    await worker.setParameters({tessedit_pageseg_mode:options.psm??'11',preserve_interword_spaces:'1'});
    let best=null;
    for(const rotation of options.rotate===false?[preferredRotation]:[...new Set([preferredRotation,0,90,270,180])]){
      if(best)onProgress(`正在校正课表方向（${rotation}°）…`);
    // Keep source files untouched. A high-contrast working canvas suppresses pale grid lines.
    const canvas=rotatedCanvas(input,rotation),grid=options.grid===false?{horizontal:[],vertical:[]}:imageRulings(canvas);
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
    let mean=0,count=0;for(let i=0;i<pixels.data.length;i+=160){mean+=(pixels.data[i]+pixels.data[i+1]+pixels.data[i+2])/3;count++;}
    const invert=mean/count<115;
    for(let i=0;i<pixels.data.length;i+=4){let y=.299*pixels.data[i]+.587*pixels.data[i+1]+.114*pixels.data[i+2];if(invert)y=255-y;const value=y<170?0:255;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;}
    ctx.putImageData(pixels,0,0);
    const result=await worker.recognize(canvas,{}, {text:true,blocks:true});
    const data=result.data; const items=[];
    for (const block of data.blocks??[]) for (const paragraph of block.paragraphs??[]) for (const line of paragraph.lines??[]) for (const word of line.words??[]) items.push({text:word.text,x:word.bbox.x0,y:word.bbox.y0,width:word.bbox.x1-word.bbox.x0,height:word.bbox.y1-word.bbox.y0,confidence:word.confidence});
    const candidate={text:data.text,items,rotation,width:canvas.width,height:canvas.height,grid,confidence:data.confidence,score:orientationScore(data.text)};
    if(!best||candidate.score>best.score)best=candidate;
    if(candidate.score>=35)break;
    }
    return best;
  } catch(e) { if(worker){await worker.terminate().catch(()=>{});worker=null;} throw Error(`本机 OCR 未完成：${e.message}。可以换清晰图片，或粘贴课表文字后手动校正。`); }
}
async function refineCells(canvas,page,onProgress,previous){
  const layout=weekdayColumns(page,previous);if(!layout)return null;
  const cells=tableCells(page,layout).cells;if(cells.length>120)return {layout:{...layout,width:page.width}};
  const output=[];
  for(let i=0;i<cells.length;i++){
    const cell=cells[i];
    if(cell.right-cell.left<15||cell.bottom-cell.top<8)continue;
    onProgress(`校对单元格 ${i+1}/${cells.length}…`);
    const crop=document.createElement('canvas'),left=Math.max(0,Math.floor(cell.left)+2),top=Math.max(0,Math.floor(cell.top)+2),right=Math.min(canvas.width,Math.ceil(cell.right)-2),bottom=Math.min(canvas.height,Math.ceil(cell.bottom)-2);
    if(right<=left||bottom<=top)continue;
    crop.width=right-left;crop.height=bottom-top;crop.getContext('2d').drawImage(canvas,left,top,crop.width,crop.height,0,0,crop.width,crop.height);
    const result=await recognizeImage(crop,()=>{},0,{rotate:false,psm:'6',grid:false});
    const items=result.items.map(item=>({...item,x:item.x+left,y:item.y+top}));
    output.push({...cell,text:result.text.trim(),items,confidence:result.confidence});
  }
  return {cells:output,layout:{...layout,width:page.width}};
}
export async function importDocument(file,onProgress=()=>{}) {
  if (file.size>30*1024*1024) throw Error('文件超过 30 MB，请拆分或压缩后导入');
  const isPdf=file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf&&!/^image\//.test(file.type)) throw Error('请选择 PDF、PNG 或 JPG 图片');
  if (!isPdf) {
    const url=URL.createObjectURL(file);
    try {const image=new Image();image.src=url;await image.decode(); const factor=Math.min(1,2600/Math.max(image.width,image.height)); const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*factor);canvas.height=Math.round(image.height*factor);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const result=await recognizeImage(canvas,onProgress);return {text:result.text,pages:[{...result,source:'ocr'}],name:file.name,kind:'ocr'};} finally {URL.revokeObjectURL(url);}
  }
  onProgress('正在读取 PDF 文字…');
  const loading=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),cMapUrl:asset('pdf/cmaps/'),cMapPacked:true,standardFontDataUrl:asset('pdf/standard_fonts/'),wasmUrl:asset('pdf/wasm/'),useSystemFonts:true});
  const doc=await loading.promise;
  try {
    if(doc.numPages>25) throw Error('PDF 超过 25 页，请只保留课表页面后导入');
    const pages=[];let kind='text',preferredRotation=0,previousOCRLayout=null;
    for(let n=1;n<=doc.numPages;n++) {
      onProgress(`读取第 ${n}/${doc.numPages} 页…`);const page=await doc.getPage(n);const viewport=page.getViewport({scale:1});const content=await page.getTextContent();
      let items=content.items.filter(i=>'str'in i && i.str.trim()).map(i=>{const [x,y]=viewport.convertToViewportPoint(i.transform[4],i.transform[5]);return {text:i.str,x,y:y-i.height,width:i.width,height:i.height||12};});
      let text=groupRows(items).map(r=>r.text).join('\n');let width=viewport.width;let height=viewport.height;
      const operators=await page.getOperatorList();let grid=extractRulings(operators,viewport,pdfjs.OPS),rotation=0,source='text',cells=null;
      if(text.replace(/\s/g,'').length<15) {
        kind='ocr';onProgress(`第 ${n} 页是图片，正在本机识别…`);const scale=Math.min(2.2,2600/Math.max(viewport.width,viewport.height));const view=page.getViewport({scale});const canvas=document.createElement('canvas');canvas.width=Math.round(view.width);canvas.height=Math.round(view.height);await page.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;
        const result=await recognizeImage(canvas,m=>onProgress(`第 ${n} 页 · ${m}`),preferredRotation);text=result.text;items=result.items;width=result.width;height=result.height;rotation=result.rotation;source='ocr';preferredRotation=rotation;
        const vectorGrid=rotateRulings(extractRulings(operators,view,pdfjs.OPS),canvas.width,canvas.height,rotation);grid=vectorGrid.horizontal.length?vectorGrid:result.grid;
        const refined=await refineCells(rotatedCanvas(canvas,rotation),{items,text,width,height,grid},m=>onProgress(`第 ${n} 页 · ${m}`),previousOCRLayout);
        if(refined){cells=refined.cells??null;previousOCRLayout=refined.layout;}
      }
      pages.push({items,text,width,height,grid,rotation,source,...(cells?{cells}:{})});page.cleanup();
    }
    return {pages,text:pages.map(p=>p.text).join('\n\n'),name:file.name,kind};
  } finally {await loading.destroy();}
}
