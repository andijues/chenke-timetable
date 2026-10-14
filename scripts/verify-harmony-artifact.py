from pathlib import Path
import hashlib
import json
import zipfile

root=Path(__file__).resolve().parent.parent
record=json.loads((root/'reports/harmony-build.json').read_text(encoding='utf-8'))
package=root/record['artifact']
assert hashlib.sha256(package.read_bytes()).hexdigest()==record['sha256']
with zipfile.ZipFile(package) as hap:
    assert hap.testzip() is None
    names=hap.namelist()
    manifest=json.loads(hap.read('module.json'))
    assert manifest['app']['bundleName']=='com.andijues.chenke'
    assert manifest['module']['name']=='entry'
    assert 'ohos.permission.PUBLISH_AGENT_REMINDER' in json.dumps(manifest)
    assert 'ets/modules.abc' in names
    bytecode=hap.read('ets/modules.abc')
    assert bytecode.startswith(b'PANDA') and len(bytecode)>100
    for resource in ['wake.wav','web/index.html','web/app.js','web/style.css',
                     'web/vendor/ocr/lang/chi_sim.traineddata.gz','web/vendor/ocr/lang/eng.traineddata.gz']:
        assert 'resources/rawfile/'+resource in names,resource
    assert not any(n.lower().endswith(('.p12','.p7b','.jks','.keystore','.pem','.csr')) for n in names)
    count=len([n for n in names if n.startswith('resources/rawfile/web/') and not n.endswith('/')])
record.update({'zipIntegrity':'passed','compiledArkTSBytecode':True,'bundleName':'com.andijues.chenke',
               'offlineWebFiles':count,'signed':False,'deviceInstalled':False,'lockScreenAlarmTested':False})
(root/'reports/harmony-build.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(record,ensure_ascii=False,indent=2))
