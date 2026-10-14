from pathlib import Path
import zipfile
import hashlib
import json

root=Path(__file__).resolve().parent.parent
out=root/'output'
out.mkdir(exist_ok=True)
excluded={'node_modules','.git','output','test-results','playwright-report','.vite','.hvigor','oh_modules','build'}
local_helpers={'github-personal.mjs','debug-import.mjs','debug-ocr.mjs','check-apple-api.mjs','finish-ui.mjs'}
archive=out/'晨课-完整项目.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in root.rglob('*'):
        rel=p.relative_to(root)
        if not p.is_file() or any(part in excluded for part in rel.parts) or p.suffix in {'.p12','.p7b','.cer','.mobileprovision','.log','.traineddata','.pyc'} or (rel.parts[0]=='scripts' and p.name in local_helpers): continue
        z.write(p, str(Path('晨课')/rel))
web=out/'晨课-网页预览.zip'
with zipfile.ZipFile(web,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in (root/'dist').rglob('*'):
        if p.is_file(): z.write(p,p.relative_to(root/'dist'))
manifest=[]
ipa=out/'晨课-iOS-未签名.ipa'
for p in [archive,web]+([ipa] if ipa.exists() else []):
    digest=hashlib.sha256(p.read_bytes()).hexdigest()
    with zipfile.ZipFile(p) as z:
        assert z.testzip() is None
        count=len(z.namelist())
    manifest.append({'file':p.name,'bytes':p.stat().st_size,'entries':count,'sha256':digest,'zip_integrity':'passed'})
(out/'交付文件校验.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
for m in manifest: print(m['file'],f"{m['bytes']/1024/1024:.1f} MiB",m['entries'],'files, integrity passed')
